import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';

// eslint-disable-next-line no-unused-vars
import TinyMCE, { utils as tinyMceUtils } from './editors/TinyMCE';
import PlainEditor, { utils as plainEditorUtils }  from './editors/PlainEditor';
import { connect } from 'react-redux';
import AsyncActionQueue from '../lib/AsyncActionQueue';
import MultiNoteActions from './MultiNoteActions';

// eslint-disable-next-line no-unused-vars
import { DefaultEditorState, OnChangeEvent, TextEditorUtils, EditorCommand } from './utils/NoteText';
const { themeStyle, buildStyle } = require('../theme.js');
const { reg } = require('lib/registry.js');
const { time } = require('lib/time-utils.js');
const markupLanguageUtils = require('lib/markupLanguageUtils');
const HtmlToHtml = require('lib/joplin-renderer/HtmlToHtml');
const Setting = require('lib/models/Setting');
const { MarkupToHtml } = require('lib/joplin-renderer');
const HtmlToMd = require('lib/HtmlToMd');
const { _ } = require('lib/locale');
const Note = require('lib/models/Note.js');
const BaseModel = require('lib/BaseModel.js');
const Resource = require('lib/models/Resource.js');
const { shim } = require('lib/shim');
const TemplateUtils = require('lib/TemplateUtils');
const { bridge } = require('electron').remote.require('./bridge');
const { urlDecode } = require('lib/string-utils');
const ResourceFetcher = require('lib/services/ResourceFetcher.js');
const DecryptionWorker = require('lib/services/DecryptionWorker.js');

interface NoteTextProps {
	style: any,
	noteId: string,
	theme: number,
	dispatch: Function,
	selectedNoteIds: string[],
	notes:any[],
	watchedNoteFiles:string[],
	isProvisional: boolean,
	editorNoteStatuses: any,
	syncStarted: boolean,
	editor: string,
	windowCommand: any,
}

interface FormNote {
	id: string,
	title: string,
	parent_id: string,
	is_todo: number,
	bodyEditorContent?: any,
	markup_language: number,

	hasChanged: boolean,

	// Getting the content from the editor can be a slow process because that content
	// might need to be serialized first. For that reason, the wrapped editor (eg TinyMCE)
	// first emits onWillChange when there is a change. That event does not include the
	// editor content. After a few milliseconds (eg if the user stops typing for long
	// enough), the editor emits onChange, and that event will include the editor content.
	//
	// Both onWillChange and onChange events include a changeId property which is used
	// to link the two events together. It is used for example to detect if a new note
	// was loaded before the current note was saved - in that case the changeId will be
	// different. The two properties bodyWillChangeId and bodyChangeId are used to save
	// this info with the currently loaded note.
	//
	// The willChange/onChange events also allow us to handle the case where the user
	// types something then quickly switch a different note. In that case, bodyWillChangeId
	// is set, thus we know we should save the note, even though we won't receive the
	// onChange event.
	bodyWillChangeId: number
	bodyChangeId: number,

	saveActionQueue: AsyncActionQueue,

	// Note with markup_language = HTML have a block of CSS at the start, which is used
	// to preserve the style from the original (web-clipped) page. When sending the note
	// content to TinyMCE, we only send the actual HTML, without this CSS. The CSS is passed
	// via a file in pluginAssets. This is because TinyMCE would not render the style otherwise.
	// However, when we get back the HTML from TinyMCE, we need to reconstruct the original note.
	// Since the CSS used by TinyMCE has been lost (since it's in a temp CSS file), we keep that
	// original CSS here. It's used in formNoteToNote to rebuild the note body.
	// We can keep it here because we know TinyMCE will not modify it anyway.
	originalCss: string,
}

const defaultNote = ():FormNote => {
	return {
		id: '',
		parent_id: '',
		title: '',
		is_todo: 0,
		markup_language: 1,
		bodyWillChangeId: 0,
		bodyChangeId: 0,
		saveActionQueue: null,
		originalCss: '',
		hasChanged: false,
	};
};

function styles_(props:NoteTextProps) {
	return buildStyle('NoteText', props.theme, (theme:any) => {
		return {
			titleInput: {
				flex: 1,
				display: 'inline-block',
				paddingTop: 5,
				paddingBottom: 5,
				paddingLeft: 8,
				paddingRight: 8,
				marginRight: theme.paddingLeft,
				color: theme.textStyle.color,
				fontSize: theme.textStyle.fontSize * 1.25 * 1.5,
				backgroundColor: theme.backgroundColor,
				border: '1px solid',
				borderColor: theme.dividerColor,
			},
			warningBanner: {
				background: theme.warningBackgroundColor,
				fontFamily: theme.fontFamily,
				padding: 10,
				fontSize: theme.fontSize,
			},
			tinyMCE: {
				width: '100%',
				height: '100%',
			},
		};
	});
}

let textEditorUtils_:TextEditorUtils = null;

function usePrevious(value:any):any {
	const ref = useRef();
	useEffect(() => {
		ref.current = value;
	});
	return ref.current;
}

async function initNoteState(n:any, setFormNote:Function, setDefaultEditorState:Function) {
	let originalCss = '';
	if (n.markup_language === MarkupToHtml.MARKUP_LANGUAGE_HTML) {
		const htmlToHtml = new HtmlToHtml();
		const splitted = htmlToHtml.splitHtml(n.body);
		originalCss = splitted.css;
	}

	setFormNote({
		id: n.id,
		title: n.title,
		is_todo: n.is_todo,
		parent_id: n.parent_id,
		bodyWillChangeId: 0,
		bodyChangeId: 0,
		markup_language: n.markup_language,
		saveActionQueue: new AsyncActionQueue(1000),
		originalCss: originalCss,
		hasChanged: false,
	});

	setDefaultEditorState({
		value: n.body,
		markupLanguage: n.markup_language,
		resourceInfos: await attachedResources(n.body),
	});

	await handleResourceDownloadMode(n.body);
}

async function handleResourceDownloadMode(noteBody:string) {
	if (noteBody && Setting.value('sync.resourceDownloadMode') === 'auto') {
		const resourceIds = await Note.linkedResourceIds(noteBody);
		await ResourceFetcher.instance().markForDownload(resourceIds);
	}
}

async function htmlToMarkdown(html:string):Promise<string> {
	const htmlToMd = new HtmlToMd();
	let md = htmlToMd.parse(html, { preserveImageTagsWithSize: true });
	md = await Note.replaceResourceExternalToInternalLinks(md, { useAbsolutePaths: true });
	return md;
}

async function formNoteToNote(formNote:FormNote):Promise<any> {
	const newNote:any = Object.assign({}, formNote);

	if ('bodyEditorContent' in formNote) {
		const html = await textEditorUtils_.editorContentToHtml(formNote.bodyEditorContent);
		if (formNote.markup_language === MarkupToHtml.MARKUP_LANGUAGE_MARKDOWN) {
			newNote.body = await htmlToMarkdown(html);
		} else {
			newNote.body = html;
			newNote.body = await Note.replaceResourceExternalToInternalLinks(newNote.body, { useAbsolutePaths: true });
			if (formNote.originalCss) newNote.body = `<style>${formNote.originalCss}</style>\n${newNote.body}`;
		}
	}

	delete newNote.bodyEditorContent;

	return newNote;
}

let resourceCache_:any = {};

function clearResourceCache() {
	resourceCache_ = {};
}

async function attachedResources(noteBody:string):Promise<any> {
	if (!noteBody) return {};
	const resourceIds = await Note.linkedItemIdsByType(BaseModel.TYPE_RESOURCE, noteBody);

	const output:any = {};
	for (let i = 0; i < resourceIds.length; i++) {
		const id = resourceIds[i];

		if (resourceCache_[id]) {
			output[id] = resourceCache_[id];
		} else {
			const resource = await Resource.load(id);
			const localState = await Resource.localState(resource);

			const o = {
				item: resource,
				localState: localState,
			};

			// eslint-disable-next-line require-atomic-updates
			resourceCache_[id] = o;
			output[id] = o;
		}
	}

	return output;
}

function installResourceHandling(refreshResourceHandler:Function) {
	ResourceFetcher.instance().on('downloadComplete', refreshResourceHandler);
	ResourceFetcher.instance().on('downloadStarted', refreshResourceHandler);
	DecryptionWorker.instance().on('resourceDecrypted', refreshResourceHandler);
}

function uninstallResourceHandling(refreshResourceHandler:Function) {
	ResourceFetcher.instance().off('downloadComplete', refreshResourceHandler);
	ResourceFetcher.instance().off('downloadStarted', refreshResourceHandler);
	DecryptionWorker.instance().off('resourceDecrypted', refreshResourceHandler);
}

async function attachResources() {
	const filePaths = bridge().showOpenDialog({
		properties: ['openFile', 'createDirectory', 'multiSelections'],
	});
	if (!filePaths || !filePaths.length) return [];

	const output = [];

	for (const filePath of filePaths) {
		try {
			const resource = await shim.createResourceFromPath(filePath);
			output.push({
				item: resource,
				markdownTag: Resource.markdownTag(resource),
			});
		} catch (error) {
			bridge().showErrorMessageBox(error.message);
		}
	}

	return output;
}

function scheduleSaveNote(formNote:FormNote, dispatch:Function) {
	if (!formNote.saveActionQueue) throw new Error('saveActionQueue is not set!!'); // Sanity check

	reg.logger().debug('Scheduling...', formNote);

	const makeAction = (formNote:FormNote) => {
		return async function() {
			const note = await formNoteToNote(formNote);
			reg.logger().debug('Saving note...', note);
			await Note.save(note);

			dispatch({
				type: 'EDITOR_NOTE_STATUS_REMOVE',
				id: formNote.id,
			});
		};
	};

	formNote.saveActionQueue.push(makeAction(formNote));
}

function saveNoteIfWillChange(formNote:FormNote, editorRef:any, dispatch:Function) {
	if (!formNote.id || !formNote.bodyWillChangeId) return;

	scheduleSaveNote({
		...formNote,
		bodyEditorContent: editorRef.current.content(),
		bodyWillChangeId: 0,
		bodyChangeId: 0,
	}, dispatch);
}

function useWindowCommand(windowCommand:any, dispatch:Function, formNote:FormNote, titleInputRef:React.MutableRefObject<any>, editorRef:React.MutableRefObject<any>) {
	useEffect(() => {
		const command = windowCommand;
		if (!command || !formNote) return;

		const editorCmd:EditorCommand = { name: command.name, value: { ...command.value } };
		let fn:Function = null;

		if (command.name === 'exportPdf') {
			// TODO
		} else if (command.name === 'print') {
			// TODO
		} else if (command.name === 'insertDateTime') {
			editorCmd.name = 'insertText',
			editorCmd.value = time.formatMsToLocal(new Date().getTime());
		} else if (command.name === 'commandStartExternalEditing') {
			// TODO
		} else if (command.name === 'commandStopExternalEditing') {
			// TODO
		} else if (command.name === 'showLocalSearch') {
			editorCmd.name = 'search';
		} else if (command.name === 'textCode') {
			// TODO
		} else if (command.name === 'insertTemplate') {
			editorCmd.name = 'insertText',
			editorCmd.value = TemplateUtils.render(command.value);
		}

		if (command.name === 'focusElement' && command.target === 'noteTitle') {
			fn = () => {
				if (!titleInputRef.current) return;
				titleInputRef.current.focus();
			};
		}

		if (command.name === 'focusElement' && command.target === 'noteBody') {
			editorCmd.name = 'focus';
		}

		if (!editorCmd.name && !fn) return;

		dispatch({
			type: 'WINDOW_COMMAND',
			name: null,
		});

		requestAnimationFrame(() => {
			if (fn) {
				fn();
			} else {
				if (!editorRef.current.execCommand) {
					reg.logger().warn('Received command, but editor cannot execute commands', editorCmd);
				} else {
					editorRef.current.execCommand(editorCmd);
				}
			}
		});
	}, [windowCommand, dispatch, formNote]);
}

function NoteText2(props:NoteTextProps) {
	const [formNote, setFormNote] = useState<FormNote>(defaultNote());
	const [defaultEditorState, setDefaultEditorState] = useState<DefaultEditorState>({ value: '', markupLanguage: MarkupToHtml.MARKUP_LANGUAGE_MARKDOWN, resourceInfos: {} });
	const prevSyncStarted = usePrevious(props.syncStarted);

	const editorRef = useRef<any>();
	const titleInputRef = useRef<any>();
	const formNoteRef = useRef<FormNote>();
	formNoteRef.current = { ...formNote };
	const isMountedRef = useRef(true);

	useWindowCommand(props.windowCommand, props.dispatch, formNote, titleInputRef, editorRef);

	// If the note has been modified in another editor, wait for it to be saved
	// before loading it in this editor.
	const waitingToSaveNote = props.noteId && formNote.id !== props.noteId && props.editorNoteStatuses[props.noteId] === 'saving';

	const styles = styles_(props);

	const markupToHtml = useCallback(async (markupLanguage:number, md:string, options:any = null):Promise<any> => {
		md = md || '';

		const theme = themeStyle(props.theme);

		md = await Note.replaceResourceInternalToExternalLinks(md, { useAbsolutePaths: true });

		const markupToHtml = markupLanguageUtils.newMarkupToHtml({
			resourceBaseUrl: `file://${Setting.value('resourceDir')}/`,
		});

		const result = await markupToHtml.render(markupLanguage, md, theme, Object.assign({}, {
			codeTheme: theme.codeThemeCss,
			// userCss: this.props.customCss ? this.props.customCss : '',
			// resources: await shared.attachedResources(noteBody),
			resources: [],
			postMessageSyntax: 'ipcProxySendToHost',
			splitted: true,
			externalAssetsOnly: true,
		}, options));

		return result;
	}, [props.theme]);

	const allAssets = useCallback(async (markupLanguage:number):Promise<any[]> => {
		const theme = themeStyle(props.theme);

		const markupToHtml = markupLanguageUtils.newMarkupToHtml({
			resourceBaseUrl: `file://${Setting.value('resourceDir')}/`,
		});

		return markupToHtml.allAssets(markupLanguage, theme);
	}, [props.theme]);

	const joplinHtml = useCallback(async (type:string) => {
		if (type === 'checkbox') {
			const result = await markupToHtml(MarkupToHtml.MARKUP_LANGUAGE_MARKDOWN, '- [ ] xxxxxREMOVExxxxx', {
				bodyOnly: true,
				externalAssetsOnly: true,
			});
			const html = result.html
				.replace(/xxxxxREMOVExxxxx/m, ' ')
				.replace(/<ul.*?>/, '')
				.replace(/<\/ul>/, '');
			return { ...result, html: html };
		}

		throw new Error(`Invalid type:${type}`);
	}, [markupToHtml]);

	const handleProvisionalFlag = useCallback(() => {
		if (props.isProvisional) {
			props.dispatch({
				type: 'NOTE_PROVISIONAL_FLAG_CLEAR',
				id: formNote.id,
			});
		}
	}, [props.isProvisional, formNote.id]);

	const refreshResource = useCallback(async function(event) {
		if (!defaultEditorState.value) return;

		const resourceIds = await Note.linkedResourceIds(defaultEditorState.value);
		if (resourceIds.indexOf(event.id) >= 0) {
			clearResourceCache();
			const e = {
				...defaultEditorState,
				resourceInfos: await attachedResources(defaultEditorState.value),
			};
			setDefaultEditorState(e);
		}
	}, [defaultEditorState]);

	useEffect(() => {
		installResourceHandling(refreshResource);

		return () => {
			uninstallResourceHandling(refreshResource);
		};
	}, [defaultEditorState]);

	useEffect(() => {
		// This is not exactly a hack but a bit ugly. If the note was changed (willChangeId > 0) but not
		// yet saved, we need to save it now before the component is unmounted. However, we can't put
		// formNote in the dependency array or that effect will run every time the note changes. We only
		// want to run it once on unmount. So because of that we need to use that formNoteRef.
		return () => {
			isMountedRef.current = false;
			saveNoteIfWillChange(formNoteRef.current, editorRef, props.dispatch);
		};
	}, []);

	useEffect(() => {
		// Check that synchronisation has just finished - and
		// if the note has never been changed, we reload it.
		// If the note has already been changed, it's a conflict
		// that's already been handled by the synchronizer.

		if (!prevSyncStarted) return () => {};
		if (props.syncStarted) return () => {};
		if (formNote.hasChanged) return () => {};

		reg.logger().debug('Sync has finished and note has never been changed - reloading it');

		let cancelled = false;

		const loadNote = async () => {
			const n = await Note.load(props.noteId);
			if (cancelled) return;

			// Normally should not happened because if the note has been deleted via sync
			// it would not have been loaded in the editor (due to note selection changing
			// on delete)
			if (!n) {
				reg.logger().warn('Trying to reload note that has been deleted:', props.noteId);
				return;
			}

			await initNoteState(n, setFormNote, setDefaultEditorState);
		};

		loadNote();

		return () => {
			cancelled = true;
		};
	}, [prevSyncStarted, props.syncStarted, formNote]);

	useEffect(() => {
		if (!props.noteId) return () => {};

		if (formNote.id === props.noteId) return () => {};

		if (waitingToSaveNote) return () => {};

		let cancelled = false;

		reg.logger().debug('Loading existing note', props.noteId);

		saveNoteIfWillChange(formNote, editorRef, props.dispatch);

		function handleAutoFocus(noteIsTodo:boolean) {
			if (!props.isProvisional) return;

			const focusSettingName = noteIsTodo ? 'newTodoFocus' : 'newNoteFocus';

			requestAnimationFrame(() => {
				if (Setting.value(focusSettingName) === 'title') {
					if (titleInputRef.current) titleInputRef.current.focus();
				} else {
					if (editorRef.current) editorRef.current.execCommand({ name: 'focus' });
				}
			});
		}

		async function loadNote() {
			const n = await Note.load(props.noteId);
			if (cancelled) return;
			if (!n) throw new Error(`Cannot find note with ID: ${props.noteId}`);
			reg.logger().debug('Loaded note:', n);
			await initNoteState(n, setFormNote, setDefaultEditorState);

			handleAutoFocus(!!n.is_todo);
		}

		loadNote();

		return () => {
			cancelled = true;
		};
	}, [props.noteId, props.isProvisional, formNote, waitingToSaveNote]);

	const onFieldChange = useCallback((field:string, value:any, changeId: number = 0) => {
		if (!isMountedRef.current) {
			// When the component is unmounted, various actions can happen which can
			// trigger onChange events, for example the textarea might be cleared.
			// We need to ignore these events, otherwise the note is going to be saved
			// with an invalid body.
			reg.logger().debug('Skipping change event because the component is unmounted');
			return;
		}

		handleProvisionalFlag();

		const change = field === 'body' ? {
			bodyEditorContent: value,
		} : {
			title: value,
		};

		const newNote = {
			...formNote,
			...change,
			bodyWillChangeId: 0,
			bodyChangeId: 0,
			hasChanged: true,
		};

		if (changeId !== null && field === 'body' && formNote.bodyWillChangeId !== changeId) {
			// Note was changed, but another note was loaded before save - skipping
			// The previously loaded note, that was modified, will be saved via saveNoteIfWillChange()
		} else {
			setFormNote(newNote);
			scheduleSaveNote(newNote, props.dispatch);
		}
	}, [handleProvisionalFlag, formNote]);

	const onBodyChange = useCallback((event:OnChangeEvent) => onFieldChange('body', event.content, event.changeId), [onFieldChange]);

	const onTitleChange = useCallback((event:any) => onFieldChange('title', event.target.value), [onFieldChange]);

	const onBodyWillChange = useCallback((event:any) => {
		handleProvisionalFlag();

		setFormNote(prev => {
			return {
				...prev,
				bodyWillChangeId: event.changeId,
				hasChanged: true,
			};
		});

		props.dispatch({
			type: 'EDITOR_NOTE_STATUS_SET',
			id: formNote.id,
			status: 'saving',
		});
	}, [formNote, handleProvisionalFlag]);

	const onMessage = useCallback((event:any) => {
		const msg = event.name;
		const args = event.args;

		console.info('onMessage', msg, args);

		if (msg === 'setMarkerCount') {
			// const ls = Object.assign({}, this.state.localSearch);
			// ls.resultCount = arg0;
			// ls.searching = false;
			// this.setState({ localSearch: ls });
		} else if (msg.indexOf('markForDownload:') === 0) {
			// const s = msg.split(':');
			// if (s.length < 2) throw new Error(`Invalid message: ${msg}`);
			// ResourceFetcher.instance().markForDownload(s[1]);
		} else if (msg === 'percentScroll') {
			// this.ignoreNextEditorScroll_ = true;
			// this.setEditorPercentScroll(arg0);
		} else if (msg === 'contextMenu') {
			// const itemType = arg0 && arg0.type;

			// const menu = new Menu();

			// if (itemType === 'image' || itemType === 'resource') {
			// 	const resource = await Resource.load(arg0.resourceId);
			// 	const resourcePath = Resource.fullPath(resource);

			// 	menu.append(
			// 		new MenuItem({
			// 			label: _('Open...'),
			// 			click: async () => {
			// 				const ok = bridge().openExternal(`file://${resourcePath}`);
			// 				if (!ok) bridge().showErrorMessageBox(_('This file could not be opened: %s', resourcePath));
			// 			},
			// 		})
			// 	);

			// 	menu.append(
			// 		new MenuItem({
			// 			label: _('Save as...'),
			// 			click: async () => {
			// 				const filePath = bridge().showSaveDialog({
			// 					defaultPath: resource.filename ? resource.filename : resource.title,
			// 				});
			// 				if (!filePath) return;
			// 				await fs.copy(resourcePath, filePath);
			// 			},
			// 		})
			// 	);

			// 	menu.append(
			// 		new MenuItem({
			// 			label: _('Copy path to clipboard'),
			// 			click: async () => {
			// 				clipboard.writeText(toSystemSlashes(resourcePath));
			// 			},
			// 		})
			// 	);
			// } else if (itemType === 'text') {
			// 	menu.append(
			// 		new MenuItem({
			// 			label: _('Copy'),
			// 			click: async () => {
			// 				clipboard.writeText(arg0.textToCopy);
			// 			},
			// 		})
			// 	);
			// } else if (itemType === 'link') {
			// 	menu.append(
			// 		new MenuItem({
			// 			label: _('Copy Link Address'),
			// 			click: async () => {
			// 				clipboard.writeText(arg0.textToCopy);
			// 			},
			// 		})
			// 	);
			// } else {
			// 	reg.logger().error(`Unhandled item type: ${itemType}`);
			// 	return;
			// }

			// menu.popup(bridge().window());
		} else if (msg.indexOf('joplin://') === 0) {
			// const resourceUrlInfo = urlUtils.parseResourceUrl(msg);
			// const itemId = resourceUrlInfo.itemId;
			// const item = await BaseItem.loadItemById(itemId);

			// if (!item) throw new Error(`No item with ID ${itemId}`);

			// if (item.type_ === BaseModel.TYPE_RESOURCE) {
			// 	const localState = await Resource.localState(item);
			// 	if (localState.fetch_status !== Resource.FETCH_STATUS_DONE || !!item.encryption_blob_encrypted) {
			// 		if (localState.fetch_status === Resource.FETCH_STATUS_ERROR) {
			// 			bridge().showErrorMessageBox(`${_('There was an error downloading this attachment:')}\n\n${localState.fetch_error}`);
			// 		} else {
			// 			bridge().showErrorMessageBox(_('This attachment is not downloaded or not decrypted yet'));
			// 		}
			// 		return;
			// 	}
			// 	const filePath = Resource.fullPath(item);
			// 	bridge().openItem(filePath);
			// } else if (item.type_ === BaseModel.TYPE_NOTE) {
			// 	this.props.dispatch({
			// 		type: 'FOLDER_AND_NOTE_SELECT',
			// 		folderId: item.parent_id,
			// 		noteId: item.id,
			// 		hash: resourceUrlInfo.hash,
			// 		historyAction: 'goto',
			// 	});
			// } else {
			// 	throw new Error(`Unsupported item type: ${item.type_}`);
			// }
		} else if (msg.indexOf('#') === 0) {
			// This is an internal anchor, which is handled by the WebView so skip this case
		} else if (msg === 'openExternal') {
			if (args.url.indexOf('file://') === 0) {
				// When using the file:// protocol, openExternal doesn't work (does nothing) with URL-encoded paths
				bridge().openExternal(urlDecode(args.url));
			} else {
				bridge().openExternal(args.url);
			}
		} else {
			bridge().showErrorMessageBox(_('Unsupported link or message: %s', msg));
		}
	}, []);

	const introductionPostLinkClick = useCallback(() => {
		bridge().openExternal('https://www.patreon.com/posts/34246624');
	}, []);

	if (props.selectedNoteIds.length > 1) {
		return <MultiNoteActions
			theme={props.theme}
			selectedNoteIds={props.selectedNoteIds}
			notes={props.notes}
			dispatch={props.dispatch}
			watchedNoteFiles={props.watchedNoteFiles}
			style={props.style}
		/>;
	}

	const editorProps = {
		ref: editorRef,
		style: styles.tinyMCE,
		onChange: onBodyChange,
		onWillChange: onBodyWillChange,
		onMessage: onMessage,
		defaultEditorState: defaultEditorState,
		markupToHtml: markupToHtml,
		allAssets: allAssets,
		attachResources: attachResources,
		disabled: waitingToSaveNote,
		joplinHtml: joplinHtml,
		theme: props.theme,
	};

	let editor = null;

	if (props.editor === 'TinyMCE') {
		editor = <TinyMCE {...editorProps}/>;
		textEditorUtils_ = tinyMceUtils;
	} else if (props.editor === 'PlainEditor') {
		editor = <PlainEditor {...editorProps}/>;
		textEditorUtils_ = plainEditorUtils;
	} else {
		throw new Error(`Invalid editor: ${props.editor}`);
	}

	return (
		<div style={props.style}>
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				<div style={styles.warningBanner}>
					This is an experimental WYSIWYG editor for evaluation only. Please do not use with important notes as you may lose some data! See the <a style={styles.urlColor} onClick={introductionPostLinkClick} href="#">introduction post</a> for more information.
				</div>
				<div style={{ display: 'flex' }}>
					<input
						type="text"
						ref={titleInputRef}
						disabled={waitingToSaveNote}
						placeholder={props.isProvisional ? _('Creating new %s...', formNote.is_todo ? _('to-do') : _('note')) : ''}
						style={styles.titleInput}
						onChange={onTitleChange}
						value={formNote.title}
					/>
				</div>
				<div style={{ display: 'flex', flex: 1 }}>
					{editor}
				</div>
			</div>
		</div>

	);
}

export {
	NoteText2 as NoteText2Component,
};

const mapStateToProps = (state:any) => {
	const noteId = state.selectedNoteIds.length === 1 ? state.selectedNoteIds[0] : null;

	return {
		noteId: noteId,
		notes: state.notes,
		selectedNoteIds: state.selectedNoteIds,
		isProvisional: state.provisionalNoteIds.includes(noteId),
		editorNoteStatuses: state.editorNoteStatuses,
		syncStarted: state.syncStarted,
		theme: state.settings.theme,
		watchedNoteFiles: state.watchedNoteFiles,
		windowCommand: state.windowCommand,
	};
};

export default connect(mapStateToProps)(NoteText2);
