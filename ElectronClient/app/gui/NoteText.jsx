const React = require('react');
const { Note } = require('lib/models/note.js');
const { IconButton } = require('./IconButton.min.js');
const { connect } = require('react-redux');
const { _ } = require('lib/locale.js');
const { reg } = require('lib/registry.js');
const MdToHtml = require('lib/MdToHtml');
const shared = require('lib/components/shared/note-screen-shared.js');
const { bridge } = require('electron').remote.require('./bridge');
const { themeStyle } = require('../theme.js');
const AceEditor = require('react-ace').default;
const Menu = bridge().Menu;
const MenuItem = bridge().MenuItem;
const { shim } = require('lib/shim.js');

require('brace/mode/markdown');
// https://ace.c9.io/build/kitchen-sink.html
// https://highlightjs.org/static/demo/
require('brace/theme/chrome');

class NoteTextComponent extends React.Component {

	constructor() {
		super();

		this.state = {
			note: null,
			noteMetadata: '',
			showNoteMetadata: false,
			folder: null,
			lastSavedNote: null,
			isLoading: true,
			webviewReady: false,
			scrollHeight: null,
			editorScrollTop: 0,
		};

		this.lastLoadedNoteId_ = null;

		this.webviewListeners_ = null;
		this.ignoreNextEditorScroll_ = false;
		this.scheduleSaveTimeout_ = null;
		this.restoreScrollTop_ = null;

		// Complicated but reliable method to get editor content height
		// https://github.com/ajaxorg/ace/issues/2046
		this.editorMaxScrollTop_ = 0;
		this.onAfterEditorRender_ = () => {
			const r = this.editor_.editor.renderer;
			this.editorMaxScrollTop_ = Math.max(0, r.layerConfig.maxHeight - r.$size.scrollerHeight);

			if (this.restoreScrollTop_) {
				this.editorSetScrollTop(this.restoreScrollTop_);
				this.restoreScrollTop_ = null;
			}
		}
	}

	mdToHtml() {
		if (this.mdToHtml_) return this.mdToHtml_;
		this.mdToHtml_ = new MdToHtml();
		return this.mdToHtml_;
	}

	async componentWillMount() {
		let note = null;
		if (this.props.noteId) {
			note = await Note.load(this.props.noteId);
		}

		const folder = note ? Folder.byId(this.props.folders, note.parent_id) : null;

		this.setState({
			lastSavedNote: Object.assign({}, note),
			note: note,
			folder: folder,
			isLoading: false,
		});

		this.lastLoadedNoteId_ = note ? note.id : null;
	}

	componentWillUnmount() {
		this.saveIfNeeded();

		this.mdToHtml_ = null;
		this.destroyWebview();
	}

	async saveIfNeeded() {
		if (this.scheduleSaveTimeout_) clearTimeout(this.scheduleSaveTimeout_);
		this.scheduleSaveTimeout_ = null;
		if (!shared.isModified(this)) return;
		await shared.saveNoteButton_press(this);
	}

	async saveOneProperty(name, value) {
		await shared.saveOneProperty(this, name, value);
	}

	scheduleSave() {
		if (this.scheduleSaveTimeout_) clearTimeout(this.scheduleSaveTimeout_);
		this.scheduleSaveTimeout_ = setTimeout(() => {
			this.saveIfNeeded();
		}, 500);
	}

	async componentWillReceiveProps(nextProps) {
		if ('noteId' in nextProps && nextProps.noteId !== this.props.noteId) {
			this.mdToHtml_ = null;

			const noteId = nextProps.noteId;
			this.lastLoadedNoteId_ = noteId;
			const note = noteId ? await Note.load(noteId) : null;
			if (noteId !== this.lastLoadedNoteId_) return; // Race condition - current note was changed while this one was loading

			// If we are loading nothing (noteId == null), make sure to
			// set webviewReady to false too because the webview component
			// is going to be removed in render().
			const webviewReady = this.webview_ && this.state.webviewReady && noteId;

			this.editorMaxScrollTop_ = 0;

			this.editorSetScrollTop(0);

			this.setState({
				note: note,
				lastSavedNote: Object.assign({}, note),
				webviewReady: webviewReady,
			});
		}
	}

	isModified() {
		return shared.isModified(this);
	}

	refreshNoteMetadata(force = null) {
		return shared.refreshNoteMetadata(this, force);
	}

	title_changeText(event) {
		shared.noteComponent_change(this, 'title', event.target.value);
		this.scheduleSave();
	}

	toggleIsTodo_onPress() {
		shared.toggleIsTodo_onPress(this);
		this.scheduleSave();
	}

	showMetadata_onPress() {
		shared.showMetadata_onPress(this);
	}

	webview_ipcMessage(event) {
		const msg = event.channel ? event.channel : '';
		const args = event.args;
		const arg0 = args && args.length >= 1 ? args[0] : null;
		const arg1 = args && args.length >= 2 ? args[1] : null;

		reg.logger().debug('Got ipc-message: ' + msg, args);

		if (msg.indexOf('checkboxclick:') === 0) {
			// Ugly hack because setting the body here will make the scrollbar
			// go to some random position. So we save the scrollTop here and it
			// will be restored after the editor ref has been reset, and the
			// "afterRender" event has been called.
			this.restoreScrollTop_ = this.editorScrollTop();

			const newBody = this.mdToHtml_.handleCheckboxClick(msg, this.state.note.body);
			this.saveOneProperty('body', newBody);
		} else if (msg.toLowerCase().indexOf('http') === 0) {
			require('electron').shell.openExternal(msg);
		} else if (msg === 'percentScroll') {
			this.ignoreNextEditorScroll_ = true;
			this.setEditorPercentScroll(arg0);
		} else {
			bridge().showMessageBox({
				type: 'error',
				message: _('Unsupported link or message: %s', msg),
			});
		}
	}

	editorMaxScroll() {
		return this.editorMaxScrollTop_;
	}

	editorScrollTop() {
		return this.editor_.editor.getSession().getScrollTop();
	}

	editorSetScrollTop(v) {
		if (!this.editor_) return;
		this.editor_.editor.getSession().setScrollTop(v);
	}

	setEditorPercentScroll(p) {
		this.editorSetScrollTop(p * this.editorMaxScroll());
	}

	setViewerPercentScroll(p) {
		this.webview_.send('setPercentScroll', p);
	}

	editor_scroll() {
		if (this.ignoreNextEditorScroll_) {
			this.ignoreNextEditorScroll_ = false;
			return;
		}

		const m = this.editorMaxScroll();
		this.setViewerPercentScroll(m ? this.editorScrollTop() / m : 0);
	}

	webview_domReady() {
		if (!this.webview_) return;

		this.setState({
			webviewReady: true,
		});

		//this.webview_.openDevTools(); 
	}

	webview_ref(element) {
		if (this.webview_) {
			if (this.webview_ === element) return;
			this.destroyWebview();
		}

		if (!element) {
			this.destroyWebview();
		} else {
			this.initWebview(element);
		}
	}

	editor_ref(element) {
		if (this.editor_ === element) return;

		if (this.editor_) {
			this.editor_.editor.renderer.off('afterRender', this.onAfterEditorRender_);
		}

		this.editor_ = element;

		if (this.editor_) {
			this.editor_.editor.renderer.on('afterRender', this.onAfterEditorRender_);
		}
	}

	initWebview(wv) {
		if (!this.webviewListeners_) {
			this.webviewListeners_ = {
				'dom-ready': this.webview_domReady.bind(this),
				'ipc-message': this.webview_ipcMessage.bind(this),
			};
		}

		for (let n in this.webviewListeners_) {
			if (!this.webviewListeners_.hasOwnProperty(n)) continue;
			const fn = this.webviewListeners_[n];
			wv.addEventListener(n, fn);
		}

		this.webview_ = wv;
	}

	destroyWebview() {
		if (!this.webview_) return;

		for (let n in this.webviewListeners_) {
			if (!this.webviewListeners_.hasOwnProperty(n)) continue;
			const fn = this.webviewListeners_[n];
			this.webview_.removeEventListener(n, fn);
		}

		this.webview_ = null;
	}

	aceEditor_change(body) {
		shared.noteComponent_change(this, 'body', body);
		this.scheduleSave();
	}

	itemContextMenu(event) {
		const noteId = this.props.noteId;
		if (!noteId) return;

		const menu = new Menu()

		menu.append(new MenuItem({label: _('Attach file'), click: async () => {
			const filePaths = bridge().showOpenDialog({
				properties: ['openFile', 'createDirectory'],
			});
			if (!filePaths || !filePaths.length) return;

			await this.saveIfNeeded();
			const note = await Note.load(noteId);
			const newNote = await shim.attachFileToNote(note, filePaths[0]);

			this.setState({
				note: newNote,
				lastSavedNote: Object.assign({}, newNote),
			});
		}}));

		menu.popup(bridge().window());
	}

	render() {
		const style = this.props.style;
		const note = this.state.note;
		const body = note ? note.body : '';
		const theme = themeStyle(this.props.theme);
		const visiblePanes = this.props.visiblePanes || ['editor', 'viewer'];

		const borderWidth = 1;

		const rootStyle = Object.assign({
			borderLeft: borderWidth + 'px solid ' + theme.dividerColor,
			boxSizing: 'border-box',
			paddingLeft: 10,
			paddingRight: 0,
		}, style);

		const innerWidth = rootStyle.width - rootStyle.paddingLeft - rootStyle.paddingRight - borderWidth;

		if (!note) {
			const emptyDivStyle = Object.assign({
				backgroundColor: 'black',
				opacity: 0.1,
			}, rootStyle);
			return <div style={emptyDivStyle}></div>
		}

		const titleBarStyle = {
			width: innerWidth - rootStyle.paddingLeft,
			height: 30,
			boxSizing: 'border-box',
			marginTop: 10,
			marginBottom: 10,
			display: 'flex',
			flexDirection: 'row',
		};

		const titleEditorStyle = {
			display: 'flex',
			flex: 1,
			display: 'inline-block',
			paddingTop: 5,
			paddingBottom: 5,
			paddingLeft: 8,
			paddingRight: 8,
			marginRight: rootStyle.paddingLeft,
		};

		const bottomRowHeight = rootStyle.height - titleBarStyle.height - titleBarStyle.marginBottom - titleBarStyle.marginTop;

		const viewerStyle = {
			width: Math.floor(innerWidth / 2),
			height: bottomRowHeight,
			overflow: 'hidden',
			float: 'left',
			verticalAlign: 'top',
			boxSizing: 'border-box',
		};

		const paddingTop = 14;

		const editorStyle = {
			width: innerWidth - viewerStyle.width,
			height: bottomRowHeight - paddingTop,
			overflowY: 'hidden',
			float: 'left',
			verticalAlign: 'top',
			paddingTop: paddingTop + 'px',
			lineHeight: theme.textAreaLineHeight + 'px',
			fontSize: theme.fontSize + 'px',
		};

		if (visiblePanes.indexOf('viewer') < 0) {
			// Note: setting webview.display to "none" is currently not supported due
			// to this bug: https://github.com/electron/electron/issues/8277
			// So instead setting the width 0.
			viewerStyle.width = 0;
			editorStyle.width = innerWidth;
		}

		if (visiblePanes.indexOf('editor') < 0) {
			editorStyle.display = 'none';
			viewerStyle.width = innerWidth;
		}

		if (visiblePanes.indexOf('viewer') >= 0 && visiblePanes.indexOf('editor') >= 0) {
			viewerStyle.borderLeft = '1px solid ' + theme.dividerColor;
		} else {
			viewerStyle.borderLeft = 'none';
		}

		if (this.state.webviewReady) {
			const mdOptions = {
				onResourceLoaded: () => {
					this.forceUpdate();
				},
				postMessageSyntax: 'ipcRenderer.sendToHost',
			};
			const html = this.mdToHtml().render(body, theme, mdOptions);
			this.webview_.send('setHtml', html);
		}

		const titleEditor = <input
			type="text"
			style={titleEditorStyle}
			value={note ? note.title : ''}
			onChange={(event) => { this.title_changeText(event); }}
		/>

		const titleBarMenuButton = <IconButton style={{
			display: 'flex',
		}} iconName="fa-caret-down" theme={this.props.theme} onClick={() => { this.itemContextMenu() }} />

		const viewer = <webview
			style={viewerStyle}
			nodeintegration="1"
			src="gui/note-viewer/index.html"
			ref={(elem) => { this.webview_ref(elem); } }
		/>

		const editorRootStyle = Object.assign({}, editorStyle);
		delete editorRootStyle.width;
		delete editorRootStyle.height;
		delete editorRootStyle.fontSize;

		const editor =  <AceEditor
			value={body}
			mode="markdown"
			theme="chrome"
			style={editorRootStyle}
			width={editorStyle.width + 'px'}
			height={editorStyle.height + 'px'}
			fontSize={editorStyle.fontSize}
			showGutter={false}
			name="note-editor"
			wrapEnabled={true}
			onScroll={(event) => { this.editor_scroll(); }}
			ref={(elem) => { this.editor_ref(elem); } }
			onChange={(body) => { this.aceEditor_change(body) }}
			showPrintMargin={false}

			// Disable warning: "Automatically scrolling cursor into view after
			// selection change this will be disabled in the next version set
			// editor.$blockScrolling = Infinity to disable this message"
			editorProps={{$blockScrolling: true}}

			// This is buggy (gets outside the container)
			highlightActiveLine={false}
		/>

		return (
			<div style={rootStyle}>
				<div style={titleBarStyle}>
					{ titleEditor }
					{ titleBarMenuButton }
				</div>
				{ editor }
				{ viewer }
			</div>
		);
	}

}

const mapStateToProps = (state) => {
	return {
		noteId: state.selectedNoteId,
		folderId: state.selectedFolderId,
		itemType: state.selectedItemType,
		folders: state.folders,
		theme: state.settings.theme,
		showAdvancedOptions: state.settings.showAdvancedOptions,
	};
};

const NoteText = connect(mapStateToProps)(NoteTextComponent);

module.exports = { NoteText };