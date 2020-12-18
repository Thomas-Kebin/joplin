import { useEffect, useState, useMemo, useRef } from 'react';
import shim from '@joplin/lib/shim';
import Setting from '@joplin/lib/models/Setting';
const { themeStyle } = require('../../global-style.js');
const markupLanguageUtils = require('@joplin/lib/markupLanguageUtils').default;
const { assetsToHeaders } = require('@joplin/renderer');

interface Source {
	uri: string;
	baseUrl: string;
}

interface UseSourceResult {
	source: Source;
	injectedJs: string[];
}

function usePrevious(value: any, initialValue: any = null): any {
	const ref = useRef(initialValue);
	useEffect(() => {
		ref.current = value;
	});
	return ref.current;
}

export default function useSource(noteBody: string, noteMarkupLanguage: number, themeId: number, highlightedKeywords: string[], noteResources: any, paddingBottom: number, noteHash: string): UseSourceResult {
	const [source, setSource] = useState<Source>(undefined);
	const [injectedJs, setInjectedJs] = useState<string[]>([]);
	const [resourceLoadedTime, setResourceLoadedTime] = useState(0);
	const [isFirstRender, setIsFirstRender] = useState(true);

	const rendererTheme = useMemo(() => {
		return {
			bodyPaddingTop: '.8em', // Extra top padding on the rendered MD so it doesn't touch the border
			bodyPaddingBottom: paddingBottom, // Extra bottom padding to make it possible to scroll past the action button (so that it doesn't overlap the text)
			...themeStyle(themeId),
		};
	}, [themeId, paddingBottom]);

	const markupToHtml = useMemo(() => {
		return markupLanguageUtils.newMarkupToHtml();
	}, [isFirstRender]);

	// To address https://github.com/laurent22/joplin/issues/433
	//
	// If a checkbox in a note is ticked, the body changes, which normally
	// would trigger a re-render of this component, which has the
	// unfortunate side effect of making the view scroll back to the top.
	// This re-rendering however is uncessary since the component is
	// already visually updated via JS. So here, if the note has not
	// changed, we prevent the component from updating. This fixes the
	// above issue. A drawback of this is if the note is updated via sync,
	// this change will not be displayed immediately.
	//
	// IMPORTANT: KEEP noteBody AS THE FIRST dependency in the array as the
	// below logic rely on this.
	const effectDependencies = [noteBody, resourceLoadedTime, noteMarkupLanguage, themeId, rendererTheme, highlightedKeywords, noteResources, noteHash, isFirstRender, markupToHtml];
	const previousDeps = usePrevious(effectDependencies, []);
	const changedDeps = effectDependencies.reduce((accum: any, dependency: any, index: any) => {
		if (dependency !== previousDeps[index]) {
			return { ...accum, [index]: true };
		}
		return accum;
	}, {});
	const onlyNoteBodyHasChanged = Object.keys(changedDeps).length === 1 && changedDeps[0];

	useEffect(() => {
		if (onlyNoteBodyHasChanged) return () => {};

		let cancelled = false;

		async function renderNote() {
			const theme = themeStyle(themeId);

			const bodyToRender = noteBody || '';

			const mdOptions = {
				onResourceLoaded: () => {
					setResourceLoadedTime(Date.now());
				},
				highlightedKeywords: highlightedKeywords,
				resources: noteResources,
				codeTheme: theme.codeThemeCss,
				postMessageSyntax: 'window.joplinPostMessage_',
				// Disabled for now as it causes issues when zooming in or out
				// https://github.com/laurent22/joplin/pull/3939#issuecomment-734260166
				enableLongPress: false, // shim.mobilePlatform() === 'android', // On iOS, there's already a built-on open/share menu
			};

			// Whenever a resource state changes, for example when it goes from "not downloaded" to "downloaded", the "noteResources"
			// props changes, thus triggering a render. The **content** of this noteResources array however is not changed because
			// it doesn't contain info about the resource download state. Because of that, if we were to use the markupToHtml() cache
			// it wouldn't re-render at all. We don't need this cache in any way because this hook is only triggered when we know
			// something has changed.
			markupToHtml.clearCache(noteMarkupLanguage);

			const result = await markupToHtml.render(
				noteMarkupLanguage,
				bodyToRender,
				rendererTheme,
				mdOptions
			);

			if (cancelled) return;

			let html = result.html;

			const resourceDownloadMode = Setting.value('sync.resourceDownloadMode');

			const js = [];
			js.push('try {');
			js.push(shim.injectedJs('webviewLib'));
			// Note that this postMessage function accepts two arguments, for compatibility with the desktop version, but
			// the ReactNativeWebView actually supports only one, so the second arg is ignored (and currently not needed for the mobile app).
			js.push('window.joplinPostMessage_ = (msg, args) => { return window.ReactNativeWebView.postMessage(msg); };');
			js.push('webviewLib.initialize({ postMessage: msg => { return window.ReactNativeWebView.postMessage(msg); } });');
			js.push(`
				const readyStateCheckInterval = setInterval(function() {
					if (document.readyState === "complete") {
						clearInterval(readyStateCheckInterval);
						if ("${resourceDownloadMode}" === "manual") webviewLib.setupResourceManualDownload();
						const hash = "${noteHash}";
						// Gives it a bit of time before scrolling to the anchor
						// so that images are loaded.
						if (hash) {
							setTimeout(() => { 
								const e = document.getElementById(hash);
								if (!e) {
									console.warn('Cannot find hash', hash);
									return;
								}
								e.scrollIntoView();
							}, 500);
						}
					}
				}, 10);
			`);
			js.push('} catch (e) {');
			js.push('	window.ReactNativeWebView.postMessage("error:" + e.message + ": " + JSON.stringify(e))');
			js.push('	true;');
			js.push('}');
			js.push('true;');

			html =
				`
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1">
						${assetsToHeaders(result.pluginAssets, { asHtml: true })}
					</head>
					<body>
						${html}
					</body>
				</html>
			`;

			const tempFile = `${Setting.value('resourceDir')}/NoteBodyViewer.html`;
			await shim.fsDriver().writeFile(tempFile, html, 'utf8');

			if (cancelled) return;

			// Now that we are sending back a file instead of an HTML string, we're always sending back the
			// same file. So we add a cache busting query parameter to it, to make sure that the WebView re-renders.
			//
			// `baseUrl` is where the images will be loaded from. So images must use a path relative to resourceDir.
			setSource({
				uri: `file://${tempFile}?r=${Math.round(Math.random() * 100000000)}`,
				baseUrl: `file://${Setting.value('resourceDir')}/`,
			});

			setInjectedJs(js);
		}

		// When mounted, we need to render the webview in two stages;
		// - First without any source, so that all webview props are setup properly
		// - Secondly with the source to actually render the note
		// This is necessary to prevent a race condition that could cause an ERR_ACCESS_DENIED error
		// https://github.com/react-native-webview/react-native-webview/issues/656#issuecomment-551312436

		if (isFirstRender) {
			setIsFirstRender(false);
			setSource(undefined);
			setInjectedJs([]);
		} else {
			void renderNote();
		}

		return () => {
			cancelled = true;
		};
	}, effectDependencies);

	return { source, injectedJs };
}
