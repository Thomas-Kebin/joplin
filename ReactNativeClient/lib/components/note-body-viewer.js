import Async from 'react-async';

const React = require('react');
const Component = React.Component;
const { Platform, View, Text, ToastAndroid } = require('react-native');
const { WebView } = require('react-native-webview');
const { themeStyle } = require('lib/components/global-style.js');
const Setting = require('lib/models/Setting').default;
const { _ } = require('lib/locale.js');
const { reg } = require('lib/registry.js');
const shim = require('lib/shim').default;
const { assetsToHeaders } = require('lib/joplin-renderer');
const shared = require('lib/components/shared/note-screen-shared.js');
const markupLanguageUtils = require('lib/markupLanguageUtils');
const { dialogs } = require('lib/dialogs.js');
const BackButtonDialogBox = require('lib/components/BackButtonDialogBox').default;
const Resource = require('lib/models/Resource.js');
const Share = require('react-native-share').default;

class NoteBodyViewer extends Component {
	constructor() {
		super();
		this.state = {
			resources: {},
			webViewLoaded: false,
			bodyHtml: '',
		};

		this.forceUpdate_ = false;

		this.isMounted_ = false;

		this.markupToHtml_ = markupLanguageUtils.newMarkupToHtml();

		this.reloadNote = this.reloadNote.bind(this);
		this.watchFn = this.watchFn.bind(this);
	}

	componentDidMount() {
		this.isMounted_ = true;
	}

	componentWillUnmount() {
		this.markupToHtml_ = null;
		this.isMounted_ = false;
	}

	async reloadNote() {
		this.forceUpdate_ = false;

		const note = this.props.note;
		const theme = themeStyle(this.props.themeId);

		const bodyToRender = note ? note.body : '';

		const mdOptions = {
			onResourceLoaded: () => {
				if (this.resourceLoadedTimeoutId_) {
					shim.clearTimeout(this.resourceLoadedTimeoutId_);
					this.resourceLoadedTimeoutId_ = null;
				}

				this.resourceLoadedTimeoutId_ = shim.setTimeout(() => {
					this.resourceLoadedTimeoutId_ = null;
					this.forceUpdate();
				}, 100);
			},
			highlightedKeywords: this.props.highlightedKeywords,
			resources: this.props.noteResources,
			codeTheme: theme.codeThemeCss,
			postMessageSyntax: 'window.joplinPostMessage_',
			enableLongPress: shim.isReactNative(),
			longPressDelay: 500, // TODO use system value
		};

		const result = await this.markupToHtml_.render(
			note.markup_language,
			bodyToRender,
			{
				bodyPaddingTop: '.8em', // Extra top padding on the rendered MD so it doesn't touch the border
				bodyPaddingBottom: this.props.paddingBottom, // Extra bottom padding to make it possible to scroll past the action button (so that it doesn't overlap the text)
				...this.props.webViewStyle,
			},
			mdOptions
		);
		let html = result.html;

		const resourceDownloadMode = Setting.value('sync.resourceDownloadMode');

		const injectedJs = [];
		injectedJs.push(shim.injectedJs('webviewLib'));
		// Note that this postMessage function accepts two arguments, for compatibility with the desktop version, but
		// the ReactNativeWebView actually supports only one, so the second arg is ignored (and currently not needed for the mobile app).
		injectedJs.push('window.joplinPostMessage_ = (msg, args) => { return window.ReactNativeWebView.postMessage(msg); };');
		injectedJs.push('webviewLib.initialize({ postMessage: msg => { return window.ReactNativeWebView.postMessage(msg); } });');
		injectedJs.push(`
			const readyStateCheckInterval = shim.setInterval(function() {
			    if (document.readyState === "complete") {
			    	shim.clearInterval(readyStateCheckInterval);
			    	if ("${resourceDownloadMode}" === "manual") webviewLib.setupResourceManualDownload();

			    	const hash = "${this.props.noteHash}";
			    	// Gives it a bit of time before scrolling to the anchor
			    	// so that images are loaded.
			    	if (hash) {
				    	shim.setTimeout(() => { 
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

		html =
			`
			<!DOCTYPE html>
			<html>
				<head>
					<meta name="viewport" content="width=device-width, initial-scale=1">
					${assetsToHeaders(result.pluginAssets, { asHtml: true })}
				</head>
				<body>
					${html}
				</body>
			</html>
		`;

		// On iOS scalesPageToFit work like this:
		//
		// Find the widest image, resize it *and everything else* by x% so that
		// the image fits within the viewport. The problem is that it means if there's
		// a large image, everything is going to be scaled to a very small size, making
		// the text unreadable.
		//
		// On Android:
		//
		// Find the widest elements and scale them (and them only) to fit within the viewport
		// It means it's going to scale large images, but the text will remain at the normal
		// size.
		//
		// That means we can use scalesPageToFix on Android but not on iOS.
		// The weird thing is that on iOS, scalesPageToFix=false along with a CSS
		// rule "img { max-width: 100% }", works like scalesPageToFix=true on Android.
		// So we use scalesPageToFix=false on iOS along with that CSS rule.

		// `baseUrl` is where the images will be loaded from. So images must use a path relative to resourceDir.
		return {
			source: {
				html: html,
				baseUrl: `file://${Setting.value('resourceDir')}/`,
			},
			injectedJs: injectedJs,
		};
	}

	onLoadEnd() {
		shim.setTimeout(() => {
			if (this.props.onLoadEnd) this.props.onLoadEnd();
		}, 100);

		if (this.state.webViewLoaded) return;

		// Need to display after a delay to avoid a white flash before
		// the content is displayed.
		shim.setTimeout(() => {
			if (!this.isMounted_) return;
			this.setState({ webViewLoaded: true });
		}, 100);
	}

	shouldComponentUpdate(nextProps, nextState) {
		const safeGetNoteProp = (props, propName) => {
			if (!props) return null;
			if (!props.note) return null;
			return props.note[propName];
		};

		// To address https://github.com/laurent22/joplin/issues/433
		// If a checkbox in a note is ticked, the body changes, which normally would trigger a re-render
		// of this component, which has the unfortunate side effect of making the view scroll back to the top.
		// This re-rendering however is uncessary since the component is already visually updated via JS.
		// So here, if the note has not changed, we prevent the component from updating.
		// This fixes the above issue. A drawback of this is if the note is updated via sync, this change
		// will not be displayed immediately.
		const currentNoteId = safeGetNoteProp(this.props, 'id');
		const nextNoteId = safeGetNoteProp(nextProps, 'id');

		if (currentNoteId !== nextNoteId || nextState.webViewLoaded !== this.state.webViewLoaded) return true;

		// If the length of the body has changed, then it's something other than a checkbox that has changed,
		// for example a resource that has been attached to the note while in View mode. In that case, update.
		return (`${safeGetNoteProp(this.props, 'body')}`).length !== (`${safeGetNoteProp(nextProps, 'body')}`).length;
	}

	rebuildMd() {
		this.forceUpdate_ = true;
		this.forceUpdate();
	}

	watchFn() {
		// react-async will not fetch the data again after the first render
		// so we use this watchFn function to force it to reload in certain
		// cases. It is used in particular when re-rendering the note when
		// a resource has been downloaded in auto mode.
		return this.forceUpdate_;
	}

	async onResourceLongPress(msg) {
		try {
			const resourceId = msg.split(':')[1];
			const resource = await Resource.load(resourceId);
			const name = resource.title ? resource.title : resource.file_name;

			const action = await dialogs.pop(this, name, [
				{ text: _('Open'), id: 'open' },
				{ text: _('Share'), id: 'share' },
			]);

			if (action === 'open') {
				this.props.onJoplinLinkClick(`joplin://${resourceId}`);
			} else if (action === 'share') {
				const filename = resource.file_name ?
					`${resource.file_name}.${resource.file_extension}` :
					resource.title;
				const targetPath = `${Setting.value('resourceDir')}/${filename}`;

				await shim.fsDriver().copy(Resource.fullPath(resource), targetPath);

				await Share.open({
					type: resource.mime,
					filename: resource.title,
					url: `file://${targetPath}`,
					failOnCancel: false,
				});

				await shim.fsDriver().remove(targetPath);
			}
		} catch (e) {
			reg.logger().error('Could not handle link long press', e);
			ToastAndroid.show('An error occurred, check log for details', ToastAndroid.SHORT);
		}
	}

	render() {
		// Note: useWebKit={false} is needed to go around this bug:
		// https://github.com/react-native-community/react-native-webview/issues/376
		// However, if we add the <meta> tag as described there, it is no longer necessary and WebKit can be used!
		// https://github.com/react-native-community/react-native-webview/issues/312#issuecomment-501991406
		//
		// However, on iOS, due to the bug below, we cannot use WebKit:
		// https://github.com/react-native-community/react-native-webview/issues/312#issuecomment-503754654


		const webViewStyle = { backgroundColor: this.props.webViewStyle.backgroundColor };
		// On iOS, the onLoadEnd() event is never fired so always
		// display the webview (don't do the little trick
		// to avoid the white flash).
		if (Platform.OS !== 'ios') {
			webViewStyle.opacity = this.state.webViewLoaded ? 1 : 0.01;
		}

		return (
			<View style={this.props.style}>
				<Async promiseFn={this.reloadNote} watchFn={this.watchFn}>
					{({ data, error, isPending }) => {
						if (error) {
							console.error(error);
							return <Text>{error.message}</Text>;
						}

						if (isPending) return null;

						return (
							<WebView
								useWebKit={Platform.OS !== 'ios'}
								style={webViewStyle}
								source={data.source}
								injectedJavaScript={data.injectedJs.join('\n')}
								originWhitelist={['file://*', './*', 'http://*', 'https://*']}
								mixedContentMode="always"
								allowFileAccess={true}
								onLoadEnd={() => this.onLoadEnd()}
								onError={() => reg.logger().error('WebView error')}
								onMessage={event => {
									// Since RN 58 (or 59) messages are now escaped twice???
									let msg = unescape(unescape(event.nativeEvent.data));

									console.info('Got IPC message: ', msg);

									if (msg.indexOf('checkboxclick:') === 0) {
										const newBody = shared.toggleCheckbox(msg, this.props.note.body);
										if (this.props.onCheckboxChange) this.props.onCheckboxChange(newBody);
									} else if (msg.indexOf('markForDownload:') === 0) {
										msg = msg.split(':');
										const resourceId = msg[1];
										if (this.props.onMarkForDownload) this.props.onMarkForDownload({ resourceId: resourceId });
									} else if (msg.startsWith('longclick:')) {
										this.onResourceLongPress(msg);
									} else if (msg.startsWith('joplin:')) {
										this.props.onJoplinLinkClick(msg);
									}
								}}
							/>
						);
					}}
				</Async>
				<BackButtonDialogBox
					ref={dialogbox => {
						this.dialogbox = dialogbox;
					}}
				/>
			</View>
		);
	}
}

module.exports = { NoteBodyViewer };
