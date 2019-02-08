const React = require('react');
const Note = require('lib/models/Note.js');
const BaseItem = require('lib/models/BaseItem.js');
const BaseModel = require('lib/BaseModel.js');
const Search = require('lib/models/Search.js');
const { time } = require('lib/time-utils.js');
const Setting = require('lib/models/Setting.js');
const { IconButton } = require('./IconButton.min.js');
const { urlDecode, escapeHtml, pregQuote, scriptType } = require('lib/string-utils');
const Toolbar = require('./Toolbar.min.js');
const TagList = require('./TagList.min.js');
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
const eventManager = require('../eventManager');
const fs = require('fs-extra');
const md5 = require('md5');
const mimeUtils = require('lib/mime-utils.js').mime;
const ArrayUtils = require('lib/ArrayUtils');
const ObjectUtils = require('lib/ObjectUtils');
const urlUtils = require('lib/urlUtils');
const dialogs = require('./dialogs');
const NoteListUtils = require('./utils/NoteListUtils');
const NoteSearchBar = require('./NoteSearchBar.min.js');
const markdownUtils = require('lib/markdownUtils');
const ExternalEditWatcher = require('lib/services/ExternalEditWatcher');
const ResourceFetcher = require('lib/services/ResourceFetcher');
const { toSystemSlashes, safeFilename } = require('lib/path-utils');
const { clipboard } = require('electron');
const SearchEngine = require('lib/services/SearchEngine');
const NoteTextViewer = require('./NoteTextViewer.min');

require('brace/mode/markdown');
// https://ace.c9.io/build/kitchen-sink.html
// https://highlightjs.org/static/demo/
require('brace/theme/chrome');
require('brace/theme/twilight');

const NOTE_TAG_BAR_FEATURE_ENABLED = false;

class NoteTextComponent extends React.Component {

	constructor() {
		super();

		this.localSearchDefaultState = {
			query: '',
			selectedIndex: 0,
			resultCount: 0,
		};

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
			newNote: null,
			noteTags: [],

			// If the current note was just created, and the title has never been
			// changed by the user, this variable contains that note ID. Used
			// to automatically set the title.
			newAndNoTitleChangeNoteId: null,
			bodyHtml: '',
			lastKeys: [],
			showLocalSearch: false,
			localSearch: Object.assign({}, this.localSearchDefaultState), 
		};

		this.webviewRef_ = React.createRef();

		this.lastLoadedNoteId_ = null;

		this.webviewListeners_ = null;
		this.ignoreNextEditorScroll_ = false;
		this.scheduleSaveTimeout_ = null;
		this.restoreScrollTop_ = null;
		this.lastSetHtml_ = '';
		this.lastSetMarkers_ = '';
		this.lastSetMarkersOptions_ = {};
		this.selectionRange_ = null;
		this.noteSearchBar_ = React.createRef();

		// Complicated but reliable method to get editor content height
		// https://github.com/ajaxorg/ace/issues/2046
		this.editorMaxScrollTop_ = 0;
		this.onAfterEditorRender_ = () => {
			const r = this.editor_.editor.renderer;
			this.editorMaxScrollTop_ = Math.max(0, r.layerConfig.maxHeight - r.$size.scrollerHeight);

			if (this.restoreScrollTop_ !== null) {
				this.editorSetScrollTop(this.restoreScrollTop_);
				this.restoreScrollTop_ = null;
			}
		}

		this.onAlarmChange_ = (event) => { if (event.noteId === this.props.noteId) this.scheduleReloadNote(this.props); }
		this.onNoteTypeToggle_ = (event) => { if (event.noteId === this.props.noteId) this.scheduleReloadNote(this.props); }
		this.onTodoToggle_ = (event) => { if (event.noteId === this.props.noteId) this.scheduleReloadNote(this.props); }

		this.onEditorPaste_ = async (event = null) => {
			const formats = clipboard.availableFormats();
			for (let i = 0; i < formats.length; i++) {
				const format = formats[i].toLowerCase();
				const formatType = format.split('/')[0]

				if (formatType === 'image') {
					if (event) event.preventDefault();

					const image = clipboard.readImage();

					const fileExt = mimeUtils.toFileExtension(format);
					const filePath = Setting.value('tempDir') + '/' + md5(Date.now()) + '.' + fileExt;

					await shim.writeImageToFile(image, format, filePath);
					await this.commandAttachFile([filePath]);
					await shim.fsDriver().remove(filePath);
				}
			}
		}

		this.onEditorKeyDown_ = (event) => {
			const lastKeys = this.state.lastKeys.slice();
			lastKeys.push(event.key);
			while (lastKeys.length > 2) lastKeys.splice(0, 1);
			this.setState({ lastKeys: lastKeys });
		}

		this.onEditorContextMenu_ = (event) => {
			const menu = new Menu();

			const selectedText = this.selectedText();
			const clipboardText = clipboard.readText();

			menu.append(new MenuItem({label: _('Cut'), enabled: !!selectedText, click: async () => {
				this.editorCutText();
			}}));

			menu.append(new MenuItem({label: _('Copy'), enabled: !!selectedText, click: async () => {
				this.editorCopyText();
			}}));

			menu.append(new MenuItem({label: _('Paste'), enabled: true, click: async () => {
				if (clipboardText) {
					this.editorPasteText();
				} else {
					// To handle pasting images
					this.onEditorPaste_();
				}
			}}));

			menu.popup(bridge().window());
		}

		this.onDrop_ = async (event) => {
			const dt = event.dataTransfer;

			if (dt.types.indexOf("text/x-jop-note-ids") >= 0) {
				const noteIds = JSON.parse(dt.getData("text/x-jop-note-ids"));
				const linkText = [];
				for (let i = 0; i < noteIds.length; i++) {
					const note = await Note.load(noteIds[i]);
					linkText.push(Note.markdownTag(note));
				}

				this.wrapSelectionWithStrings("", "", '', linkText.join('\n'));
			}

			const files = dt.files;
			if (!files || !files.length) return;

			const filesToAttach = [];

			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (!file.path) continue;
				filesToAttach.push(file.path);
			}

			await this.commandAttachFile(filesToAttach);
		}

		const updateSelectionRange = () => {
			if (!this.rawEditor()) {
				this.selectionRange_ = null;
				return;
			}

			const ranges = this.rawEditor().getSelection().getAllRanges();
			if (!ranges || !ranges.length || !this.state.note) {
				this.selectionRange_ = null;
			} else {
				this.selectionRange_ = ranges[0];
			}
		}

		this.aceEditor_selectionChange = (selection) => {
			updateSelectionRange();
		}

		this.aceEditor_focus = (event) => {
			updateSelectionRange();
		}

		this.externalEditWatcher_noteChange = (event) => {
			if (!this.state.note || !this.state.note.id) return;
			if (event.id === this.state.note.id) {
				this.scheduleReloadNote(this.props);
			}
		}

		this.resourceFetcher_downloadComplete = async (resource) => {
			if (!this.state.note || !this.state.note.body) return;
			const resourceIds = await Note.linkedResourceIds(this.state.note.body);
			if (resourceIds.indexOf(resource.id) >= 0) {
				this.mdToHtml().clearCache();
				this.lastSetHtml_ = '';
				this.updateHtml(this.state.note.body);
			}
		}

		this.noteSearchBar_change = (query) => {
			this.setState({ localSearch: {
				query: query,
				selectedIndex: 0,
			}});
		}

		const noteSearchBarNextPrevious = (inc) => {
			const ls = Object.assign({}, this.state.localSearch);
			ls.selectedIndex += inc;
			if (ls.selectedIndex < 0) ls.selectedIndex = ls.resultCount - 1;
			if (ls.selectedIndex >= ls.resultCount) ls.selectedIndex = 0;

			this.setState({ localSearch: ls });
		}

		this.noteSearchBar_next = () => {
			noteSearchBarNextPrevious(+1);
		}

		this.noteSearchBar_previous = () => {
			noteSearchBarNextPrevious(-1);
		}

		this.noteSearchBar_close = () => {
			this.setState({
				showLocalSearch: false,
			});
		}

		this.titleField_keyDown = this.titleField_keyDown.bind(this);
		this.webview_ipcMessage = this.webview_ipcMessage.bind(this);
		this.webview_domReady = this.webview_domReady.bind(this);
	}

	// Note:
	// - What's called "cursor position" is expressed as { row: x, column: y } and is how Ace Editor get/set the cursor position
	// - A "range" defines a selection with a start and end cusor position, expressed as { start: <CursorPos>, end: <CursorPos> }
	// - A "text offset" below is the absolute position of the cursor in the string, as would be used in the indexOf() function.
	// The functions below are used to convert between the different types.
	rangeToTextOffsets(range, body) {
		return {
			start: this.cursorPositionToTextOffset(range.start, body),
			end: this.cursorPositionToTextOffset(range.end, body),
		};
	}

	currentTextOffset() {
		return this.cursorPositionToTextOffset(this.editor_.editor.getCursorPosition(), this.state.note.body);
	}

	cursorPositionToTextOffset(cursorPos, body) {
		if (!this.editor_ || !this.editor_.editor || !this.state.note || !this.state.note.body) return 0;

		const noteLines = body.split('\n');

		let pos = 0;
		for (let i = 0; i < noteLines.length; i++) {
			if (i > 0) pos++; // Need to add the newline that's been removed in the split() call above

			if (i === cursorPos.row) {
				pos += cursorPos.column;
				break;
			} else {
				pos += noteLines[i].length;
			}
		}

		return pos;
	}

	textOffsetToCursorPosition(offset, body) {
		const lines = body.split('\n');
		let row = 0;
		let currentOffset = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (currentOffset + line.length >= offset) {
				return {
					row: row,
					column: offset - currentOffset,
				}
			}

			row++;
			currentOffset += line.length + 1;
		}
	}

	mdToHtml() {
		if (this.mdToHtml_) return this.mdToHtml_;
		this.mdToHtml_ = new MdToHtml({
			resourceBaseUrl: 'file://' + Setting.value('resourceDir') + '/',
		});
		return this.mdToHtml_;
	}

	async componentWillMount() {
		let note = null;
		let noteTags = [];
		if (this.props.newNote) {
			note = Object.assign({}, this.props.newNote);
		} else if (this.props.noteId) {
			note = await Note.load(this.props.noteId);
			noteTags = this.props.noteTags || [];
		}

		const folder = note ? Folder.byId(this.props.folders, note.parent_id) : null;

		this.setState({
			lastSavedNote: Object.assign({}, note),
			note: note,
			folder: folder,
			isLoading: false,
			noteTags: noteTags
		});

		this.lastLoadedNoteId_ = note ? note.id : null;

		this.updateHtml(note && note.body ? note.body : '');

		eventManager.on('alarmChange', this.onAlarmChange_);
		eventManager.on('noteTypeToggle', this.onNoteTypeToggle_);
		eventManager.on('todoToggle', this.onTodoToggle_);

		ResourceFetcher.instance().on('downloadComplete', this.resourceFetcher_downloadComplete);
		ExternalEditWatcher.instance().on('noteChange', this.externalEditWatcher_noteChange);
	}

	componentWillUnmount() {
		this.saveIfNeeded();

		this.mdToHtml_ = null;
		this.destroyWebview();

		eventManager.removeListener('alarmChange', this.onAlarmChange_);
		eventManager.removeListener('noteTypeToggle', this.onNoteTypeToggle_);
		eventManager.removeListener('todoToggle', this.onTodoToggle_);

		ResourceFetcher.instance().off('downloadComplete', this.resourceFetcher_downloadComplete);
		ExternalEditWatcher.instance().off('noteChange', this.externalEditWatcher_noteChange);
	}

	async saveIfNeeded(saveIfNewNote = false) {
		const forceSave = saveIfNewNote && (this.state.note && !this.state.note.id);

		if (this.scheduleSaveTimeout_) clearTimeout(this.scheduleSaveTimeout_);
		this.scheduleSaveTimeout_ = null;
		if (!forceSave) {
			if (!shared.isModified(this)) return;
		}
		await shared.saveNoteButton_press(this);

		ExternalEditWatcher.instance().updateNoteFile(this.state.note);
	}

	async saveOneProperty(name, value) {
		if (this.state.note && !this.state.note.id) {
			const note = Object.assign({}, this.state.note);
			note[name] = value;
			this.setState({ note: note });
			this.scheduleSave();
		} else {
			await shared.saveOneProperty(this, name, value);
		}
	}

	scheduleSave() {
		if (this.scheduleSaveTimeout_) clearTimeout(this.scheduleSaveTimeout_);
		this.scheduleSaveTimeout_ = setTimeout(() => {
			this.saveIfNeeded();
		}, 500);
	}

	scheduleReloadNote(props, options = null) {
		if (this.scheduleReloadNoteIID_) {
			clearTimeout(this.scheduleReloadNoteIID_);
			this.scheduleReloadNoteIID_ = null;
		}

		this.scheduleReloadNoteIID_ = setTimeout(() => {
			this.reloadNote(props, options);
		}, 10);
	}

	// Generally, reloadNote() should not be called directly so that it's not called multiple times
	// from multiple places within a short interval of time. Instead use scheduleReloadNote() to
	// delay reloading a bit and make sure that only one reload operation is performed.
	async reloadNote(props, options = null) {
		if (!options) options = {};
		if (!('noReloadIfLocalChanges' in options)) options.noReloadIfLocalChanges = false;

		await this.saveIfNeeded();

		const previousNote = this.state.note ? Object.assign({}, this.state.note) : null;

		const stateNoteId = this.state.note ? this.state.note.id : null;
		let noteId = null;
		let note = null;
		let loadingNewNote = true;
		let parentFolder = null;
		let noteTags = [];
		let scrollPercent = 0;

		if (props.newNote) {
			note = Object.assign({}, props.newNote);
			this.lastLoadedNoteId_ = null;
		} else {
			noteId = props.noteId;

			scrollPercent = this.props.lastEditorScrollPercents[noteId];
			if (!scrollPercent) scrollPercent = 0;

			loadingNewNote = stateNoteId !== noteId;
			noteTags = await Tag.tagsByNoteId(noteId);
			this.lastLoadedNoteId_ = noteId;
			note = noteId ? await Note.load(noteId) : null;
			if (noteId !== this.lastLoadedNoteId_) return; // Race condition - current note was changed while this one was loading
			if (options.noReloadIfLocalChanges && this.isModified()) return;

			// If the note hasn't been changed, exit now
			if (this.state.note && note) {
				let diff = Note.diffObjects(this.state.note, note);
				delete diff.type_;
				if (!Object.getOwnPropertyNames(diff).length) return;
			}
		}

		this.mdToHtml_ = null;

		// If we are loading nothing (noteId == null), make sure to
		// set webviewReady to false too because the webview component
		// is going to be removed in render().
		const webviewReady = !!this.webviewRef_.current && this.state.webviewReady && (!!noteId || !!props.newNote);

		// Scroll back to top when loading new note
		if (loadingNewNote) {
			this.editorMaxScrollTop_ = 0;

			// HACK: To go around a bug in Ace editor, we first set the scroll position to 1
			// and then (in the renderer callback) to the value we actually need. The first
			// operation helps clear the scroll position cache. See:
			// https://github.com/ajaxorg/ace/issues/2195
			this.editorSetScrollTop(1);
			this.restoreScrollTop_ = 0;

			// Only force focus on notes when creating a new note/todo
			if (this.props.newNote) {
				const focusSettingName = !!note.is_todo ? 'newTodoFocus' : 'newNoteFocus';

				if (Setting.value(focusSettingName) === 'title') {
					if (this.titleField_) this.titleField_.focus();
				} else {
					if (this.editor_) this.editor_.editor.focus();
				}
			}

			if (this.editor_) {
				// Calling setValue here does two things:
				// 1. It sets the initial value as recorded by the undo manager. If we were to set it instead to "" and wait for the render
				//    phase to set the value, the initial value would still be "", which means pressing "undo" on a note that has just loaded
				//    would clear it.
				// 2. It resets the undo manager - fixes https://github.com/laurent22/joplin/issues/355
				// Note: calling undoManager.reset() doesn't work
				try {
					this.editor_.editor.getSession().setValue(note ? note.body : '');
				} catch (error) {
					if (error.message === "Cannot read property 'match' of undefined") {
						// The internals of Ace Editor throws an exception when creating a new note,
						// but that can be ignored.
					} else {
						console.error(error);
					}
				}
				this.editor_.editor.clearSelection();
				this.editor_.editor.moveCursorTo(0,0);

				setTimeout(() => {
					this.setEditorPercentScroll(scrollPercent ? scrollPercent : 0);
					this.setViewerPercentScroll(scrollPercent ? scrollPercent : 0);
				}, 10);
			}
		}

		if (note) {
			parentFolder = Folder.byId(props.folders, note.parent_id);
		}

		let newState = {
			note: note,
			lastSavedNote: Object.assign({}, note),
			webviewReady: webviewReady,
			folder: parentFolder,
			lastKeys: [],
			noteTags: noteTags
		};

		if (!note) {
			newState.newAndNoTitleChangeNoteId = null;
		} else if (note.id !== this.state.newAndNoTitleChangeNoteId) {
			newState.newAndNoTitleChangeNoteId = null;
		}

		if (!note || loadingNewNote) {
			newState.showLocalSearch = false;
			newState.localSearch = Object.assign({}, this.localSearchDefaultState);
		}

		this.lastSetHtml_ = '';
		this.lastSetMarkers_ = '';
		this.lastSetMarkersOptions_ = {};

		this.setState(newState);

		// https://github.com/laurent22/joplin/pull/893#discussion_r228025210
		// @Abijeet: Had to add this check. If not, was going into an infinite loop where state was getting updated repeatedly.
		// Since I'm updating the state, the componentWillReceiveProps was getting triggered again, where nextProps.newNote was still true, causing reloadNote to trigger again and again.
		// Notes from Laurent: The selected note tags are part of the global Redux state because they need to be updated whenever tags are changed or deleted
		// anywhere in the app. Thus it's not possible simple to load the tags here (as we won't have a way to know if they're updated afterwards).
		// Perhaps a better way would be to move that code in the middleware, check for TAGS_DELETE, TAGS_UPDATE, etc. actions and update the
		// selected note tags accordingly.
		if (NOTE_TAG_BAR_FEATURE_ENABLED) {
			if (!this.props.newNote) {
				this.props.dispatch({
					type: "SET_NOTE_TAGS",
					items: noteTags,
				});
			}
		}

		this.updateHtml(newState.note ? newState.note.body : '');
	}

	async componentWillReceiveProps(nextProps) {
		if (this.props.newNote !== nextProps.newNote && nextProps.newNote) {
			await this.scheduleReloadNote(nextProps);
		} else if (('noteId' in nextProps) && nextProps.noteId !== this.props.noteId) {
			await this.scheduleReloadNote(nextProps);
		} else if ('noteTags' in nextProps && this.areNoteTagsModified(nextProps.noteTags, this.state.noteTags)) {
			this.setState({
				noteTags: nextProps.noteTags
			});
		}

		if ((nextProps.syncStarted !== this.props.syncStarted) && ('syncStarted' in nextProps) && !nextProps.syncStarted && !this.isModified()) {
			await this.scheduleReloadNote(nextProps, { noReloadIfLocalChanges: true });
		}

		if (nextProps.windowCommand) {
			this.doCommand(nextProps.windowCommand);
		}
	}

	isModified() {
		return shared.isModified(this);
	}

	areNoteTagsModified(newTags, oldTags) {
		if (!NOTE_TAG_BAR_FEATURE_ENABLED) return false;

		if (!oldTags) return true;

		if (newTags.length !== oldTags.length) return true;

		for (let i = 0; i < newTags.length; ++i) {
			let currNewTag = newTags[i];
			for (let j = 0; j < oldTags.length; ++j) {
				let currOldTag = oldTags[j];
				if (currOldTag.id === currNewTag.id && currOldTag.updated_time !== currNewTag.updated_time) {
					return true;
				}
			}
		}

		return false;
	}

	refreshNoteMetadata(force = null) {
		return shared.refreshNoteMetadata(this, force);
	}

	title_changeText(event) {
		shared.noteComponent_change(this, 'title', event.target.value);
		this.setState({ newAndNoTitleChangeNoteId: null });
		this.scheduleSave();
	}

	toggleIsTodo_onPress() {
		shared.toggleIsTodo_onPress(this);
		this.scheduleSave();
	}

	showMetadata_onPress() {
		shared.showMetadata_onPress(this);
	}

	async webview_ipcMessage(event) {
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
		} else if (msg === 'setMarkerCount') {
			const ls = Object.assign({}, this.state.localSearch);
			ls.resultCount = arg0;
			this.setState({ localSearch: ls });
		} else if (msg === 'percentScroll') {
			this.ignoreNextEditorScroll_ = true;
			this.setEditorPercentScroll(arg0);
		} else if (msg === 'contextMenu') {
			const itemType = arg0 && arg0.type;

			const menu = new Menu()

			if (itemType === "image" || itemType === "resource") {
				const resource = await Resource.load(arg0.resourceId);
				const resourcePath = Resource.fullPath(resource);

				menu.append(new MenuItem({label: _('Open...'), click: async () => {
					const ok = bridge().openExternal('file://' + resourcePath);
					if (!ok) bridge().showErrorMessageBox(_('This file could not be opened: %s', resourcePath));
				}}));

				menu.append(new MenuItem({label: _('Save as...'), click: async () => {
					const filePath = bridge().showSaveDialog({
						defaultPath: resource.filename ? resource.filename : resource.title,
					});
					if (!filePath) return;
					await fs.copy(resourcePath, filePath);
				}}));

				menu.append(new MenuItem({label: _('Copy path to clipboard'), click: async () => {
					clipboard.writeText(toSystemSlashes(resourcePath));
				}}));
			} else if (itemType === "text") {
				menu.append(new MenuItem({label: _('Copy'), click: async () => {
					clipboard.writeText(arg0.textToCopy);
				}}));
			} else if (itemType === "link") {
				menu.append(new MenuItem({label: _('Copy Link Address'), click: async () => {
					clipboard.writeText(arg0.textToCopy);
				}}));
			} else {
				reg.logger().error('Unhandled item type: ' + itemType);
				return;
			}

			menu.popup(bridge().window());
		} else if (msg.indexOf('joplin://') === 0) {
			const itemId = msg.substr('joplin://'.length);
			const item = await BaseItem.loadItemById(itemId);

			if (!item) throw new Error('No item with ID ' + itemId);

			if (item.type_ === BaseModel.TYPE_RESOURCE) {
				const localState = await Resource.localState(item);
				if (localState.fetch_status !== Resource.FETCH_STATUS_DONE || !!item.encryption_blob_encrypted) {
					bridge().showErrorMessageBox(_('This attachment is not downloaded or not decrypted yet.'));
					return;
				}
				const filePath = Resource.fullPath(item);
				bridge().openItem(filePath);
			} else if (item.type_ === BaseModel.TYPE_NOTE) {
				this.props.dispatch({
					type: "FOLDER_AND_NOTE_SELECT",
					folderId: item.parent_id,
					noteId: item.id,
					historyNoteAction: {
						id: this.state.note.id,
						parent_id: this.state.note.parent_id,
					},
				});
			} else {
				throw new Error('Unsupported item type: ' + item.type_);
			}
		} else if (urlUtils.urlProtocol(msg)) {
			if (msg.indexOf('file://') === 0) {
				// When using the file:// protocol, openExternal doesn't work (does nothing) with URL-encoded paths
				require('electron').shell.openExternal(urlDecode(msg));
			} else {
				require('electron').shell.openExternal(msg);
			}
		} else if (msg.indexOf('#') === 0) {
			// This is an internal anchor, which is handled by the WebView so skip this case
		} else {
			bridge().showErrorMessageBox(_('Unsupported link or message: %s', msg));
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
		const noteId = this.props.noteId;

		if (noteId) {
			this.props.dispatch({
				type: 'EDITOR_SCROLL_PERCENT_SET',
				noteId: noteId,
				percent: p,
			});
		}

		this.editorSetScrollTop(p * this.editorMaxScroll());
	}

	setViewerPercentScroll(p) {
		const noteId = this.props.noteId;

		if (noteId) {
			this.props.dispatch({
				type: 'EDITOR_SCROLL_PERCENT_SET',
				noteId: noteId,
				percent: p,
			});
		}

		if (this.webviewRef_.current) this.webviewRef_.current.wrappedInstance.send('setPercentScroll', p);
	}

	editor_scroll() {
		if (this.ignoreNextEditorScroll_) {
			this.ignoreNextEditorScroll_ = false;
			return;
		}

		const m = this.editorMaxScroll();
		const percent = m ? this.editorScrollTop() / m : 0;

		this.setViewerPercentScroll(percent);
	}

	webview_domReady() {
		if (!this.webviewRef_.current) return;

		this.setState({
			webviewReady: true,
		});

		// if (Setting.value('env') === 'dev') this.webview_.openDevTools();
	}

	editor_ref(element) {
		if (this.editor_ === element) return;

		if (this.editor_) {
			this.editor_.editor.renderer.off('afterRender', this.onAfterEditorRender_);
			document.querySelector('#note-editor').removeEventListener('paste', this.onEditorPaste_, true);
			document.querySelector('#note-editor').removeEventListener('keydown', this.onEditorKeyDown_);
			document.querySelector('#note-editor').removeEventListener('contextmenu', this.onEditorContextMenu_);
		}

		this.editor_ = element;

		if (this.editor_) {
			this.editor_.editor.renderer.on('afterRender', this.onAfterEditorRender_);

			const cancelledKeys = [];
			const letters = ['F', 'T', 'P', 'Q', 'L', ','];
			for (let i = 0; i < letters.length; i++) {
				const l = letters[i];
				cancelledKeys.push('Ctrl+' + l);
				cancelledKeys.push('Command+' + l);
			}

			for (let i = 0; i < cancelledKeys.length; i++) {
				const k = cancelledKeys[i];
				this.editor_.editor.commands.bindKey(k, () => {
					// HACK: Ace doesn't seem to provide a way to override its shortcuts, but throwing
					// an exception from this undocumented function seems to cancel it without any
					// side effect.
					// https://stackoverflow.com/questions/36075846
					throw new Error('HACK: Overriding Ace Editor shortcut: ' + k);
				});
			}

			document.querySelector('#note-editor').addEventListener('paste', this.onEditorPaste_, true);
			document.querySelector('#note-editor').addEventListener('keydown', this.onEditorKeyDown_);
			document.querySelector('#note-editor').addEventListener('contextmenu', this.onEditorContextMenu_);

			const lineLeftSpaces = function(line) {
				let output = '';
				for (let i = 0; i < line.length; i++) {
					if ([' ', '\t'].indexOf(line[i]) >= 0) {
						output += line[i];
					} else {
						break;
					}
				}
				return output;
			}

			// Disable Markdown auto-completion (eg. auto-adding a dash after a line with a dash.
			// https://github.com/ajaxorg/ace/issues/2754
			const that = this; // The "this" within the function below refers to something else
			this.editor_.editor.getSession().getMode().getNextLineIndent = function(state, line) {
				const ls = that.state.lastKeys;
				if (ls.length >= 2 && ls[ls.length - 1] === 'Enter' && ls[ls.length - 2] === 'Enter') return this.$getIndent(line);

				const leftSpaces = lineLeftSpaces(line);
				const lineNoLeftSpaces = line.trimLeft();

				if (lineNoLeftSpaces.indexOf('- [ ] ') === 0 || lineNoLeftSpaces.indexOf('- [x] ') === 0 || lineNoLeftSpaces.indexOf('- [X] ') === 0) return leftSpaces + '- [ ] ';
				if (lineNoLeftSpaces.indexOf('- ') === 0) return leftSpaces + '- ';
				if (lineNoLeftSpaces.indexOf('* ') === 0 && line.trim() !== '* * *') return leftSpaces + '* ';

				const bulletNumber = markdownUtils.olLineNumber(lineNoLeftSpaces);
				if (bulletNumber) return leftSpaces + (bulletNumber + 1) + '. ';

				return this.$getIndent(line);
			};
		}
	}

	aceEditor_change(body) {
		shared.noteComponent_change(this, 'body', body);
		this.scheduleHtmlUpdate();
		this.scheduleSave();
	}

	scheduleHtmlUpdate(timeout = 500) {
		if (this.scheduleHtmlUpdateIID_) {
			clearTimeout(this.scheduleHtmlUpdateIID_);
			this.scheduleHtmlUpdateIID_ = null;
		}

		if (timeout) {
			this.scheduleHtmlUpdateIID_ = setTimeout(() => {
				this.updateHtml();
			}, timeout);
		} else {
			this.updateHtml();
		}
	}

	updateHtml(body = null) {
		const mdOptions = {
			onResourceLoaded: () => {
				if (this.resourceLoadedTimeoutId_) {
					clearTimeout(this.resourceLoadedTimeoutId_);
					this.resourceLoadedTimeoutId_ = null;
				}

				this.resourceLoadedTimeoutId_ = setTimeout(() => {
					this.resourceLoadedTimeoutId_ = null;
					this.updateHtml();
					this.forceUpdate();
				}, 100);
			},
			postMessageSyntax: 'ipcProxySendToHost',
		};

		const theme = themeStyle(this.props.theme);

		let bodyToRender = body;
		if (bodyToRender === null) bodyToRender = this.state.note && this.state.note.body ? this.state.note.body : '';
		let bodyHtml = '';

		const visiblePanes = this.props.visiblePanes || ['editor', 'viewer'];

		if (!bodyToRender.trim() && visiblePanes.indexOf('viewer') >= 0 && visiblePanes.indexOf('editor') < 0) {
			// Fixes https://github.com/laurent22/joplin/issues/217
			bodyToRender = '*' + _('This note has no content. Click on "%s" to toggle the editor and edit the note.', _('Layout')) + '*';
		}

		bodyToRender = '<style>' + this.props.customCss + '</style>\n' + bodyToRender;
		bodyHtml = this.mdToHtml().render(bodyToRender, theme, mdOptions);

		this.setState({ bodyHtml: bodyHtml });
	}

	titleField_keyDown(event) {
		const keyCode = event.keyCode;

		if (keyCode === 9) { // TAB
			event.preventDefault();

			if (event.shiftKey) {
				this.props.dispatch({
					type: 'WINDOW_COMMAND',
					name: 'focusElement',
					target: 'noteList',
				});
			} else {
				this.props.dispatch({
					type: 'WINDOW_COMMAND',
					name: 'focusElement',
					target: 'noteBody',
				});
			}
		}
	}

	async doCommand(command) {
		if (!command) return;

		let fn = null;

		if (command.name === 'exportPdf') {
			fn = this.commandSavePdf;
		} else if (command.name === 'print') {
			fn = this.commandPrint;
		}

		if (this.state.note) {
			if (command.name === 'textBold') {
				fn = this.commandTextBold;
			} else if (command.name === 'textItalic') {
				fn = this.commandTextItalic;
			} else if (command.name === 'insertDateTime') {
				fn = this.commandDateTime;
			} else if (command.name === 'commandStartExternalEditing') {
				fn = this.commandStartExternalEditing;
			} else if (command.name === 'showLocalSearch') {
				fn = this.commandShowLocalSearch;
			}
		}

		if (command.name === 'focusElement' && command.target === 'noteTitle') {
			fn = () => {
				if (!this.titleField_) return;
				this.titleField_.focus();
			}
		}

		if (command.name === 'focusElement' && command.target === 'noteBody') {
			fn = () => {
				if (!this.editor_) return;
				this.editor_.editor.focus();
			}
		}

		if (!fn) return;

		this.props.dispatch({
			type: 'WINDOW_COMMAND',
			name: null,
		});

		requestAnimationFrame(() => {
			fn = fn.bind(this);
			fn();
		});
	}

	commandShowLocalSearch() {
		if (this.state.showLocalSearch) {
			this.noteSearchBar_.current.wrappedInstance.focus();
		} else {
			this.setState({ showLocalSearch: true });
		}

		this.props.dispatch({
			type: 'NOTE_VISIBLE_PANES_SET',
			panes: ['editor', 'viewer'],
		});
	}

	async commandAttachFile(filePaths = null) {
		if (!filePaths) {
			filePaths = bridge().showOpenDialog({
				properties: ['openFile', 'createDirectory', 'multiSelections'],
			});
			if (!filePaths || !filePaths.length) return;
		}

		await this.saveIfNeeded(true);
		let note = await Note.load(this.state.note.id);

		const position = this.currentTextOffset();

		for (let i = 0; i < filePaths.length; i++) {
			const filePath = filePaths[i];
			try {
				reg.logger().info('Attaching ' + filePath);
				note = await shim.attachFileToNote(note, filePath, position);
				reg.logger().info('File was attached.');
				this.setState({
					note: Object.assign({}, note),
					lastSavedNote: Object.assign({}, note),
				});

				this.updateHtml(note.body);
			} catch (error) {
				reg.logger().error(error);
				bridge().showErrorMessageBox(error.message);
			}
		}
	}

	async commandSetAlarm() {
		await this.saveIfNeeded(true);

		this.props.dispatch({
			type: 'WINDOW_COMMAND',
			name: 'editAlarm',
			noteId: this.state.note.id,
		});
	}

	printTo_(target, options) {
		if (this.props.selectedNoteIds.length !== 1 || !this.webviewRef_.current) {
			throw new Error(_('Only one note can be printed or exported to PDF at a time.'));
		}

		const previousBody = this.state.note.body;
		const tempBody = "# " + this.state.note.title + "\n\n" + previousBody;

		const previousTheme = Setting.value('theme');
		Setting.setValue('theme', Setting.THEME_LIGHT);
		this.lastSetHtml_ = '';
		this.updateHtml(tempBody);
		this.forceUpdate();

		const restoreSettings = () => {
			Setting.setValue('theme', previousTheme);
			this.lastSetHtml_ = '';
			this.updateHtml(previousBody);
			this.forceUpdate();
		}

		setTimeout(() => {
			if (target === 'pdf') {
				this.webviewRef_.current.wrappedInstance.printToPDF({}, (error, data) => {
					restoreSettings();

					if (error) {
						bridge().showErrorMessageBox(error.message);
					} else {
						shim.fsDriver().writeFile(options.path, data, 'buffer');
					}
				});
			} else if (target === 'printer') {
				this.webviewRef_.current.wrappedInstance.print();
				restoreSettings();
			}
		}, 100);		
	}

	commandSavePdf() {
		try {
			if (!this.state.note) throw new Error(_('Only one note can be printed or exported to PDF at a time.'));

			const path = bridge().showSaveDialog({
				filters: [{ name: _('PDF File'), extensions: ['pdf']}],
				defaultPath: safeFilename(this.state.note.title),
			});

			if (!path) return;

			this.printTo_('pdf', { path: path });
		} catch (error) {
			bridge().showErrorMessageBox(error.message);
		}
	}

	commandPrint() {
		try {
			this.printTo_('printer');
		} catch (error) {
			bridge().showErrorMessageBox(error.message);
		}		
	}

	async commandStartExternalEditing() {
		try {
			await ExternalEditWatcher.instance().openAndWatch(this.state.note);
		} catch (error) {
			bridge().showErrorMessageBox(_('Error opening note in editor: %s', error.message));
		}
	}

	async commandStopExternalEditing() {
		ExternalEditWatcher.instance().stopWatching(this.state.note.id);
	}

	async commandSetTags() {
		await this.saveIfNeeded(true);

		this.props.dispatch({
			type: 'WINDOW_COMMAND',
			name: 'setTags',
			noteId: this.state.note.id,
		});
	}

	// Returns the actual Ace Editor instance (not the React wrapper)
	rawEditor() {
		return this.editor_ && this.editor_.editor ? this.editor_.editor : null;
	}

	updateEditorWithDelay(fn) {
		setTimeout(() => {
			if (!this.rawEditor()) return;
			fn(this.rawEditor());
		}, 10);
	}

	lineAtRow(row) {
		if (!this.state.note) return '';
		const body = this.state.note.body
		const lines = body.split('\n');
		if (row < 0 || row >= lines.length) return '';
		return lines[row];
	}

	selectedText() {
		if (!this.state.note || !this.state.note.body) return '';

		const selection = this.textOffsetSelection();
		if (!selection || selection.start === selection.end) return '';

		return this.state.note.body.substr(selection.start, selection.end - selection.start);
	}

	editorCopyText() {
		clipboard.writeText(this.selectedText());
	}

	editorCutText() {
		const selectedText = this.selectedText();
		if (!selectedText) return;

		clipboard.writeText(selectedText);

		const s = this.textOffsetSelection();
		if (!s || s.start === s.end) return '';

		const s1 = this.state.note.body.substr(0, s.start);
		const s2 = this.state.note.body.substr(s.end);

		shared.noteComponent_change(this, 'body', s1 + s2);

		this.updateEditorWithDelay((editor) => {
			const range = this.selectionRange_;
			range.setStart(range.start.row, range.start.column);
			range.setEnd(range.start.row, range.start.column);
			editor.getSession().getSelection().setSelectionRange(range, false);
			editor.focus();
		}, 10);
	}

	editorPasteText() {
		const s = this.textOffsetSelection();
		const s1 = this.state.note.body.substr(0, s.start);
		const s2 = this.state.note.body.substr(s.end);
		this.wrapSelectionWithStrings("", "", '', clipboard.readText());
	}

	selectionRangePreviousLine() {
		if (!this.selectionRange_) return '';
		const row = this.selectionRange_.start.row;
		return this.lineAtRow(row - 1);
	}

	selectionRangeCurrentLine() {
		if (!this.selectionRange_) return '';
		const row = this.selectionRange_.start.row;
		return this.lineAtRow(row);
	}

	textOffsetSelection() {
		return this.selectionRange_ ? this.rangeToTextOffsets(this.selectionRange_, this.state.note.body) : null;
	}

	wrapSelectionWithStrings(string1, string2 = '', defaultText = '', replacementText = '') {
		if (!this.rawEditor() || !this.state.note) return;

		const selection = this.textOffsetSelection();

		let newBody = this.state.note.body;

		if (selection && selection.start !== selection.end) {
			const s1 = this.state.note.body.substr(0, selection.start);
			const s2 = replacementText ? replacementText : this.state.note.body.substr(selection.start, selection.end - selection.start);
			const s3 = this.state.note.body.substr(selection.end);
			newBody = s1 + string1 + s2 + string2 + s3;

			const r = this.selectionRange_;

			const newRange = {
				start: { row: r.start.row, column: r.start.column + string1.length},
				end: { row: r.end.row, column: r.end.column + string1.length},
			};

			if (replacementText) {
				const diff = replacementText.length - (selection.end - selection.start);
				newRange.end.column += diff;
			}

			this.updateEditorWithDelay((editor) => {
				const range = this.selectionRange_;
				range.setStart(newRange.start.row, newRange.start.column);
				range.setEnd(newRange.end.row, newRange.end.column);
				editor.getSession().getSelection().setSelectionRange(range, false);
				editor.focus();
			});
		} else {
			let middleText = replacementText ? replacementText : defaultText;
			const textOffset = this.currentTextOffset();
			const s1 = this.state.note.body.substr(0, textOffset);
			const s2 = this.state.note.body.substr(textOffset);
			newBody = s1 + string1 + middleText + string2 + s2;

			const p = this.textOffsetToCursorPosition(textOffset + string1.length, newBody);
			const newRange = {
				start: { row: p.row, column: p.column },
				end: { row: p.row, column: p.column + middleText.length },
			};

			// BUG!! If replacementText contains newline characters, the logic
			// to select the new text will not work.

			this.updateEditorWithDelay((editor) => {
				if (middleText && newRange) {
					const range = this.selectionRange_;
					range.setStart(newRange.start.row, newRange.start.column);
					range.setEnd(newRange.end.row, newRange.end.column);
					editor.getSession().getSelection().setSelectionRange(range, false);
				} else {
					for (let i = 0; i < string1.length; i++) {
						editor.getSession().getSelection().moveCursorRight();
					}
				}
				editor.focus();
			}, 10);
		}

		shared.noteComponent_change(this, 'body', newBody);
		this.scheduleHtmlUpdate();
		this.scheduleSave();
	}

	commandTextBold() {
		this.wrapSelectionWithStrings('**', '**', _('strong text'));
	}

	commandTextItalic() {
		this.wrapSelectionWithStrings('*', '*', _('emphasized text'));
	}

	commandDateTime() {
		this.wrapSelectionWithStrings(time.formatMsToLocal(new Date().getTime()));
	}

	commandTextCode() {
		this.wrapSelectionWithStrings('`', '`');
	}

	addListItem(string1, string2 = '', defaultText = '') {
		const currentLine = this.selectionRangeCurrentLine();
		let newLine = '\n'
		if (!currentLine) newLine = '';
		this.wrapSelectionWithStrings(newLine + string1, string2, defaultText);
	}

	commandTextCheckbox() {
		this.addListItem('- [ ] ', '', _('List item'));
	}

	commandTextListUl() {
		this.addListItem('- ', '', _('List item'));
	}

	commandTextListOl() {
		let bulletNumber = markdownUtils.olLineNumber(this.selectionRangeCurrentLine());
		if (!bulletNumber) bulletNumber = markdownUtils.olLineNumber(this.selectionRangePreviousLine());
		if (!bulletNumber) bulletNumber = 0;
		this.addListItem((bulletNumber + 1) + '. ', '', _('List item'));
	}

	commandTextHeading() {
		this.addListItem('## ');
	}

	commandTextHorizontalRule() {
		this.addListItem('* * *');
	}

	async commandTextLink() {
		const url = await dialogs.prompt(_('Insert Hyperlink'));
		this.wrapSelectionWithStrings('[', '](' + url + ')');
	}

	itemContextMenu(event) {
		const note = this.state.note;
		if (!note) return;

		const menu = new Menu()

		menu.append(new MenuItem({label: _('Attach file'), click: async () => {
			return this.commandAttachFile();
		}}));

		menu.append(new MenuItem({label: _('Tags'), click: async () => {
			return this.commandSetTags();
		}}));

		if (!!note.is_todo) {
			menu.append(new MenuItem({label: _('Set alarm'), click: async () => {
				return this.commandSetAlarm();
			}}));
		}

		menu.popup(bridge().window());
	}

	createToolbarItems(note) {
		const toolbarItems = [];
		if (note && this.state.folder && ['Search', 'Tag'].includes(this.props.notesParentType)) {
			toolbarItems.push({
				title: _('In: %s', this.state.folder.title),
				iconName: 'fa-folder-o',
				enabled: false,
			});
		}

		if (this.props.historyNotes.length) {
			toolbarItems.push({
				tooltip: _('Back'),
				iconName: 'fa-arrow-left',
				onClick: () => {
					if (!this.props.historyNotes.length) return;

					const lastItem = this.props.historyNotes[this.props.historyNotes.length - 1];

					this.props.dispatch({
						type: "FOLDER_AND_NOTE_SELECT",
						folderId: lastItem.parent_id,
						noteId: lastItem.id,
						historyNoteAction: 'pop',
					});					
				},
			});
		}

		toolbarItems.push({
			tooltip: _('Bold'),
			iconName: 'fa-bold',
			onClick: () => { return this.commandTextBold(); },
		});

		toolbarItems.push({
			tooltip: _('Italic'),
			iconName: 'fa-italic',
			onClick: () => { return this.commandTextItalic(); },
		});

		toolbarItems.push({
			type: 'separator',
		});

		toolbarItems.push({
			tooltip: _('Note properties'),
			iconName: 'fa-info-circle',
			onClick: () => {
				const n = this.state.note;
				if (!n || !n.id) return;

				this.props.dispatch({
					type: 'WINDOW_COMMAND',
					name: 'commandNoteProperties',
					noteId: n.id,
				});
			},
		});

		toolbarItems.push({
			type: 'separator',
		});

		toolbarItems.push({
			tooltip: _('Hyperlink'),
			iconName: 'fa-link',
			onClick: () => { return this.commandTextLink(); },
		});

		toolbarItems.push({
			tooltip: _('Code'),
			iconName: 'fa-code',
			onClick: () => { return this.commandTextCode(); },
		});

		toolbarItems.push({
			tooltip: _('Attach file'),
			iconName: 'fa-paperclip',
			onClick: () => { return this.commandAttachFile(); },
		});

		toolbarItems.push({
			type: 'separator',
		});

		toolbarItems.push({
			tooltip: _('Numbered List'),
			iconName: 'fa-list-ol',
			onClick: () => { return this.commandTextListOl(); },
		});

		toolbarItems.push({
			tooltip: _('Bulleted List'),
			iconName: 'fa-list-ul',
			onClick: () => { return this.commandTextListUl(); },
		});

		toolbarItems.push({
			tooltip: _('Checkbox'),
			iconName: 'fa-check-square',
			onClick: () => { return this.commandTextCheckbox(); },
		});

		toolbarItems.push({
			tooltip: _('Heading'),
			iconName: 'fa-header',
			onClick: () => { return this.commandTextHeading(); },
		});

		toolbarItems.push({
			tooltip: _('Horizontal Rule'),
			iconName: 'fa-ellipsis-h',
			onClick: () => { return this.commandTextHorizontalRule(); },
		});

		toolbarItems.push({
			tooltip: _('Insert Date Time'),
			iconName: 'fa-calendar-plus-o',
			onClick: () => { return this.commandDateTime(); },
		});

		toolbarItems.push({
			type: 'separator',
		});

		if (note && this.props.watchedNoteFiles.indexOf(note.id) >= 0) {
			toolbarItems.push({
				tooltip: _('Click to stop external editing'),
				title: _('Watching...'),
				iconName: 'fa-external-link',
				onClick: () => { return this.commandStopExternalEditing(); },
			});
		} else {
			toolbarItems.push({
				tooltip: _('Edit in external editor'),
				iconName: 'fa-external-link',
				onClick: () => { return this.commandStartExternalEditing(); },
			});
		}

		toolbarItems.push({
			tooltip: _('Tags'),
			iconName: 'fa-tags',
			onClick: () => { return this.commandSetTags(); },
		});

		if (note.is_todo) {
			const item = {
				iconName: 'fa-clock-o',
				enabled: !note.todo_completed,
				onClick: () => { return this.commandSetAlarm(); },
			}
			if (Note.needAlarm(note)) {
				item.title = time.formatMsToLocal(note.todo_due);
			} else {
				item.tooltip = _('Set alarm');
			}
			toolbarItems.push(item);
		}

		return toolbarItems;
	}

	renderNoNotes(rootStyle) {
		const emptyDivStyle = Object.assign({
			backgroundColor: 'black',
			opacity: 0.1,
		}, rootStyle);
		return <div style={emptyDivStyle}></div>
	}

	renderMultiNotes(rootStyle) {
		const theme = themeStyle(this.props.theme);

		const multiNotesButton_click = item => {
			if (item.submenu) {
				item.submenu.popup(bridge().window());
			} else {
				item.click();
			}
		}

		const menu = NoteListUtils.makeContextMenu(this.props.selectedNoteIds, {
			notes: this.props.notes,
			dispatch: this.props.dispatch,
		});

		const buttonStyle = Object.assign({}, theme.buttonStyle, {
			marginBottom: 10,
		});

		const itemComps = [];
		const menuItems = menu.items;

		for (let i = 0; i < menuItems.length; i++) {
			const item = menuItems[i];
			if (!item.enabled) continue;

			itemComps.push(<button
				key={item.label}
				style={buttonStyle}
				onClick={() => multiNotesButton_click(item)}
			>{item.label}</button>);
		}

		rootStyle = Object.assign({}, rootStyle, {
			paddingTop: rootStyle.paddingLeft,
			display: 'inline-flex',
			justifyContent: 'center',
		});

		return (<div style={rootStyle}>
			<div style={{display: 'flex', flexDirection: 'column'}}>
				{itemComps}
			</div>
		</div>);
	}

	render() {
		const style = this.props.style;
		const note = this.state.note;
		const body = note && note.body ? note.body : '';
		const theme = themeStyle(this.props.theme);
		const visiblePanes = this.props.visiblePanes || ['editor', 'viewer'];
		const isTodo = note && !!note.is_todo;

		const borderWidth = 1;

		const rootStyle = Object.assign({
			borderLeft: borderWidth + 'px solid ' + theme.dividerColor,
			boxSizing: 'border-box',
			paddingLeft: 10,
			paddingRight: 0,
		}, style);

		const innerWidth = rootStyle.width - rootStyle.paddingLeft - rootStyle.paddingRight - borderWidth;

		if (this.props.selectedNoteIds.length > 1) {
			return this.renderMultiNotes(rootStyle);
		} else if (!note || !!note.encryption_applied) { //|| (note && !this.props.newNote && this.props.noteId && note.id !== this.props.noteId)) { // note.id !== props.noteId is when the note has not been loaded yet, and the previous one is still in the state
			return this.renderNoNotes(rootStyle);
		}

		const titleBarStyle = {
			width: innerWidth - rootStyle.paddingLeft,
			height: 30,
			boxSizing: 'border-box',
			marginTop: 10,
			marginBottom: 0,
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
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
			color: theme.color,
			backgroundColor: theme.backgroundColor,
			border: '1px solid',
			borderColor: theme.dividerColor,
		};

		const toolbarStyle = {
		};

		const tagStyle = {
			marginBottom: 10,
			height: 30
		};

		const searchBarHeight = this.state.showLocalSearch ? 35 : 0;

		let bottomRowHeight = 0;
		if (NOTE_TAG_BAR_FEATURE_ENABLED) {
			bottomRowHeight = rootStyle.height - titleBarStyle.height - titleBarStyle.marginBottom - titleBarStyle.marginTop - theme.toolbarHeight - tagStyle.height - tagStyle.marginBottom;
		} else {
			toolbarStyle.marginBottom = 10;
			bottomRowHeight = rootStyle.height - titleBarStyle.height - titleBarStyle.marginBottom - titleBarStyle.marginTop - theme.toolbarHeight - toolbarStyle.marginBottom;
		}

		bottomRowHeight -= searchBarHeight;
		
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
			fontSize: theme.editorFontSize + 'px',
			color: theme.color,
			backgroundColor: theme.backgroundColor,
			editorTheme: theme.editorTheme,
		};

		if (visiblePanes.indexOf('viewer') < 0) {
			// Note: setting webview.display to "none" is currently not supported due
			// to this bug: https://github.com/electron/electron/issues/8277
			// So instead setting the width 0.
			viewerStyle.width = 0;
			editorStyle.width = innerWidth;
		}

		if (visiblePanes.indexOf('editor') < 0) {
			// Note: Ideally we'd set the display to "none" to take the editor out
			// of the DOM but if we do that, certain things won't work, in particular
			// things related to scroll, which are based on the editor. See
			// editorScrollTop_, restoreScrollTop_, etc.
			editorStyle.width = 0;
			viewerStyle.width = innerWidth;
		}

		if (visiblePanes.indexOf('viewer') >= 0 && visiblePanes.indexOf('editor') >= 0) {
			viewerStyle.borderLeft = '1px solid ' + theme.dividerColor;
		} else {
			viewerStyle.borderLeft = 'none';
		}

		if (this.state.webviewReady) {
			let html = this.state.bodyHtml;

			const htmlHasChanged = this.lastSetHtml_ !== html;
			 if (htmlHasChanged) {
				let options = {codeTheme: theme.codeThemeCss};
				this.webviewRef_.current.wrappedInstance.send('setHtml', html, options);
				this.lastSetHtml_ = html;
			}

			let keywords = [];
			const markerOptions = {};

			if (this.state.showLocalSearch) {
				keywords = [{
					type: 'text',
					value: this.state.localSearch.query,
					accuracy: 'partially',
				}]
				markerOptions.selectedIndex = this.state.localSearch.selectedIndex;
			} else {
				const search = BaseModel.byId(this.props.searches, this.props.selectedSearchId);
				if (search) {
					const parsedQuery = SearchEngine.instance().parseQuery(search.query_pattern);
					keywords = SearchEngine.instance().allParsedQueryTerms(parsedQuery);
				}
			}

			const keywordHash = JSON.stringify(keywords);
			if (htmlHasChanged || keywordHash !== this.lastSetMarkers_ || !ObjectUtils.fieldsEqual(this.lastSetMarkersOptions_, markerOptions)) {
				this.lastSetMarkers_ = keywordHash;
				this.lastSetMarkersOptions_ = Object.assign({}, markerOptions);
				this.webviewRef_.current.wrappedInstance.send('setMarkers', keywords, markerOptions);
			}
		}

		const toolbarItems = this.createToolbarItems(note);

		const toolbar = <Toolbar
			style={toolbarStyle}
			items={toolbarItems}
		/>

		const titleEditor = <input
			type="text"
			ref={(elem) => { this.titleField_ = elem; } }
			style={titleEditorStyle}
			value={note && note.title ? note.title : ''}
			onChange={(event) => { this.title_changeText(event); }}
			onKeyDown={this.titleField_keyDown}
			placeholder={ this.props.newNote ? _('Creating new %s...', isTodo ? _('to-do') : _('note')) : '' }
		/>

		const tagList = !NOTE_TAG_BAR_FEATURE_ENABLED ? null : <TagList
			style={tagStyle}
			items={this.state.noteTags}
		/>;

		const titleBarMenuButton = <IconButton style={{
			display: 'flex',
		}} iconName="fa-caret-down" theme={this.props.theme} onClick={() => { this.itemContextMenu() }} />

		const titleBarDate = <span style={Object.assign({}, theme.textStyle, {color: theme.colorFaded})}>{time.formatMsToLocal(note.user_updated_time)}</span>

		const viewer = <NoteTextViewer
			ref={this.webviewRef_}
			viewerStyle={viewerStyle}
			onDomReady={this.webview_domReady}
			onIpcMessage={this.webview_ipcMessage}
		/>

		const editorRootStyle = Object.assign({}, editorStyle);
		delete editorRootStyle.width;
		delete editorRootStyle.height;
		delete editorRootStyle.fontSize;
		const editor =  <AceEditor
			value={body}
			mode="markdown"
			theme={editorRootStyle.editorTheme}
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
			onSelectionChange={this.aceEditor_selectionChange}
			onFocus={this.aceEditor_focus}
			readOnly={visiblePanes.indexOf('editor') < 0}

			// Disable warning: "Automatically scrolling cursor into view after
			// selection change this will be disabled in the next version set
			// editor.$blockScrolling = Infinity to disable this message"
			editorProps={{$blockScrolling: true}}

			// This is buggy (gets outside the container)
			highlightActiveLine={false}
		/>

		const noteSearchBarComp = !this.state.showLocalSearch ? null : (
			<NoteSearchBar
				ref={this.noteSearchBar_}
				style={{display: 'flex', height:searchBarHeight,width:innerWidth, borderTop: '1px solid ' + theme.dividerColor}}
				onChange={this.noteSearchBar_change}
				onNext={this.noteSearchBar_next}
				onPrevious={this.noteSearchBar_previous}
				onClose={this.noteSearchBar_close}
			/>
		);

		return (
			<div style={rootStyle} onDrop={this.onDrop_}>
				<div style={titleBarStyle}>
					{ titleEditor }
					{ titleBarDate }
					{ false ? titleBarMenuButton : null }
				</div>
				{ toolbar }
				{ tagList }
				{ editor }
				{ viewer }
				<div style={{clear:'both'}}/>
				{ noteSearchBarComp }
			</div>
		);
	}

}

const mapStateToProps = (state) => {
	return {
		noteId: state.selectedNoteIds.length === 1 ? state.selectedNoteIds[0] : null,
		notes: state.notes,
		selectedNoteIds: state.selectedNoteIds,
		noteTags: state.selectedNoteTags,
		folderId: state.selectedFolderId,
		itemType: state.selectedItemType,
		folders: state.folders,
		theme: state.settings.theme,
		showAdvancedOptions: state.settings.showAdvancedOptions,
		syncStarted: state.syncStarted,
		newNote: state.newNote,
		windowCommand: state.windowCommand,
		notesParentType: state.notesParentType,
		searches: state.searches,
		selectedSearchId: state.selectedSearchId,
		watchedNoteFiles: state.watchedNoteFiles,
		customCss: state.customCss,
		lastEditorScrollPercents: state.lastEditorScrollPercents,
		historyNotes: state.historyNotes,
	};
};

const NoteText = connect(mapStateToProps)(NoteTextComponent);

module.exports = { NoteText };
