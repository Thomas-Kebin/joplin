import AsyncActionQueue from '../../AsyncActionQueue';
import UndoRedoService from 'lib/services/UndoRedoService';
import uuid from 'lib/uuid';
import Setting from 'lib/models/Setting';
import shim from 'lib/shim';
import NoteBodyViewer from 'lib/components/NoteBodyViewer/NoteBodyViewer';
import checkPermissions from 'lib/checkPermissions';

const FileViewer = require('react-native-file-viewer').default;
const React = require('react');
const { Platform, Keyboard, View, TextInput, StyleSheet, Linking, Image, Share, PermissionsAndroid } = require('react-native');
const { connect } = require('react-redux');
const { MarkdownEditor } = require('../../../MarkdownEditor/index.js');
const RNFS = require('react-native-fs');
const Note = require('lib/models/Note.js');
const BaseItem = require('lib/models/BaseItem.js');
const Resource = require('lib/models/Resource.js');
const Folder = require('lib/models/Folder.js');
const Clipboard = require('@react-native-community/clipboard').default;
const md5 = require('md5');
const { BackButtonService } = require('lib/services/back-button.js');
const NavService = require('lib/services/NavService.js');
const BaseModel = require('lib/BaseModel.js');
const { ActionButton } = require('lib/components/action-button.js');
const { fileExtension, safeFileExtension } = require('lib/path-utils.js');
const mimeUtils = require('lib/mime-utils.js').mime;
const { ScreenHeader } = require('lib/components/screen-header.js');
const NoteTagsDialog = require('lib/components/screens/NoteTagsDialog');
const { time } = require('lib/time-utils.js');
const { Checkbox } = require('lib/components/checkbox.js');
const { _ } = require('lib/locale');
const { reg } = require('lib/registry.js');
const ResourceFetcher = require('lib/services/ResourceFetcher');
const { BaseScreenComponent } = require('lib/components/base-screen.js');
const { themeStyle, editorFont } = require('lib/components/global-style.js');
const { dialogs } = require('lib/dialogs.js');
const DialogBox = require('react-native-dialogbox').default;
const DocumentPicker = require('react-native-document-picker').default;
const ImageResizer = require('react-native-image-resizer').default;
const shared = require('lib/components/shared/note-screen-shared.js');
const ImagePicker = require('react-native-image-picker').default;
const SelectDateTimeDialog = require('lib/components/SelectDateTimeDialog').default;
const ShareExtension = require('lib/ShareExtension.js').default;
const CameraView = require('lib/components/CameraView').default;
const urlUtils = require('lib/urlUtils');

const emptyArray:any[] = [];

class NoteScreenComponent extends BaseScreenComponent {
	static navigationOptions():any {
		return { header: null };
	}

	constructor() {
		super();
		this.state = {
			note: Note.new(),
			mode: 'view',
			folder: null,
			lastSavedNote: null,
			isLoading: true,
			titleTextInputHeight: 20,
			alarmDialogShown: false,
			heightBumpView: 0,
			noteTagDialogShown: false,
			fromShare: false,
			showCamera: false,
			noteResources: {},

			// HACK: For reasons I can't explain, when the WebView is present, the TextInput initially does not display (It's just a white rectangle with
			// no visible text). It will only appear when tapping it or doing certain action like selecting text on the webview. The bug started to
			// appear one day and did not go away - reverting to an old RN version did not help, undoing all
			// the commits till a working version did not help. The bug also does not happen in the simulator which makes it hard to fix.
			// Eventually, a way that "worked" is to add a 1px margin on top of the text input just after the webview has loaded, then removing this
			// margin. This forces RN to update the text input and to display it. Maybe that hack can be removed once RN is upgraded.
			// See https://github.com/laurent22/joplin/issues/1057
			HACK_webviewLoadingState: 0,

			undoRedoButtonState: {
				canUndo: false,
				canRedo: false,
			},
		};

		this.saveActionQueues_ = {};

		this.markdownEditorRef = React.createRef(); // For focusing the Markdown editor

		this.doFocusUpdate_ = false;

		// iOS doesn't support multiline text fields properly so disable it
		this.enableMultilineTitle_ = Platform.OS !== 'ios';

		this.saveButtonHasBeenShown_ = false;

		this.styles_ = {};

		const saveDialog = async () => {
			if (this.isModified()) {
				const buttonId = await dialogs.pop(this, _('This note has been modified:'), [{ text: _('Save changes'), id: 'save' }, { text: _('Discard changes'), id: 'discard' }, { text: _('Cancel'), id: 'cancel' }]);

				if (buttonId == 'cancel') return true;
				if (buttonId == 'save') await this.saveNoteButton_press();
			}

			return false;
		};

		this.navHandler = async () => {
			return await saveDialog();
		};

		this.backHandler = async () => {

			if (this.isModified()) {
				await this.saveNoteButton_press();
			}

			const isProvisionalNote = this.props.provisionalNoteIds.includes(this.props.noteId);

			if (isProvisionalNote) {
				return false;
			}

			if (this.state.mode == 'edit') {
				Keyboard.dismiss();

				this.setState({
					note: Object.assign({}, this.state.lastSavedNote),
					mode: 'view',
				});

				await this.undoRedoService_.reset();

				return true;
			}

			if (this.state.fromShare) {
				// effectively the same as NAV_BACK but NAV_BACK causes undesired behaviour in this case:
				// - share to Joplin from some other app
				// - open Joplin and open any note
				// - go back -- with NAV_BACK this causes the app to exit rather than just showing notes
				this.props.dispatch({
					type: 'NAV_GO',
					routeName: 'Notes',
					folderId: this.state.note.parent_id,
				});
				return true;
			}

			return false;
		};

		this.noteTagDialog_closeRequested = () => {
			this.setState({ noteTagDialogShown: false });
		};

		this.onJoplinLinkClick_ = async (msg:string) => {
			try {
				if (msg.indexOf('joplin://') === 0) {
					const resourceUrlInfo = urlUtils.parseResourceUrl(msg);
					const itemId = resourceUrlInfo.itemId;
					const item = await BaseItem.loadItemById(itemId);
					if (!item) throw new Error(_('No item with ID %s', itemId));

					if (item.type_ === BaseModel.TYPE_NOTE) {
						// Easier to just go back, then go to the note since
						// the Note screen doesn't handle reloading a different note

						this.props.dispatch({
							type: 'NAV_BACK',
						});

						shim.setTimeout(() => {
							this.props.dispatch({
								type: 'NAV_GO',
								routeName: 'Note',
								noteId: item.id,
								noteHash: resourceUrlInfo.hash,
							});
						}, 5);
					} else if (item.type_ === BaseModel.TYPE_RESOURCE) {
						if (!(await Resource.isReady(item))) throw new Error(_('This attachment is not downloaded or not decrypted yet.'));
						const resourcePath = Resource.fullPath(item);
						await FileViewer.open(resourcePath);
					} else {
						throw new Error(_('The Joplin mobile app does not currently support this type of link: %s', BaseModel.modelTypeToName(item.type_)));
					}
				} else {
					if (msg.indexOf('file://') === 0) {
						throw new Error(_('Links with protocol "%s" are not supported', 'file://'));
					} else {
						Linking.openURL(msg);
					}
				}
			} catch (error) {
				dialogs.error(this, error.message);
			}
		};

		this.refreshResource = async (resource:any, noteBody:string = null) => {
			if (noteBody === null && this.state.note && this.state.note.body) noteBody = this.state.note.body;
			if (noteBody === null) return;

			const resourceIds = await Note.linkedResourceIds(noteBody);
			if (resourceIds.indexOf(resource.id) >= 0) {
				shared.clearResourceCache();
				const attachedResources = await shared.attachedResources(noteBody);
				this.setState({ noteResources: attachedResources });
			}
		};

		this.useBetaEditor = () => {
			return Setting.value('editor.beta') && Platform.OS !== 'android';
		};

		this.takePhoto_onPress = this.takePhoto_onPress.bind(this);
		this.cameraView_onPhoto = this.cameraView_onPhoto.bind(this);
		this.cameraView_onCancel = this.cameraView_onCancel.bind(this);
		this.properties_onPress = this.properties_onPress.bind(this);
		this.showOnMap_onPress = this.showOnMap_onPress.bind(this);
		this.onMarkForDownload = this.onMarkForDownload.bind(this);
		this.sideMenuOptions = this.sideMenuOptions.bind(this);
		this.folderPickerOptions_valueChanged = this.folderPickerOptions_valueChanged.bind(this);
		this.saveNoteButton_press = this.saveNoteButton_press.bind(this);
		this.onAlarmDialogAccept = this.onAlarmDialogAccept.bind(this);
		this.onAlarmDialogReject = this.onAlarmDialogReject.bind(this);
		this.todoCheckbox_change = this.todoCheckbox_change.bind(this);
		this.titleTextInput_contentSizeChange = this.titleTextInput_contentSizeChange.bind(this);
		this.title_changeText = this.title_changeText.bind(this);
		this.undoRedoService_stackChange = this.undoRedoService_stackChange.bind(this);
		this.screenHeader_undoButtonPress = this.screenHeader_undoButtonPress.bind(this);
		this.screenHeader_redoButtonPress = this.screenHeader_redoButtonPress.bind(this);
		this.body_selectionChange = this.body_selectionChange.bind(this);
		this.onBodyViewerLoadEnd = this.onBodyViewerLoadEnd.bind(this);
		this.onBodyViewerCheckboxChange = this.onBodyViewerCheckboxChange.bind(this);
	}

	undoRedoService_stackChange() {
		this.setState({ undoRedoButtonState: {
			canUndo: this.undoRedoService_.canUndo,
			canRedo: this.undoRedoService_.canRedo,
		} });
	}

	async undoRedo(type:string) {
		const undoState = await this.undoRedoService_[type](this.undoState());
		if (!undoState) return;

		this.setState((state:any) => {
			const newNote = Object.assign({}, state.note);
			newNote.body = undoState.body;
			return {
				note: newNote,
			};
		});
	}

	screenHeader_undoButtonPress() {
		this.undoRedo('undo');
	}

	screenHeader_redoButtonPress() {
		this.undoRedo('redo');
	}

	styles() {
		const themeId = this.props.themeId;
		const theme = themeStyle(themeId);

		const cacheKey = [themeId, this.state.titleTextInputHeight, this.state.HACK_webviewLoadingState].join('_');

		if (this.styles_[cacheKey]) return this.styles_[cacheKey];
		this.styles_ = {};

		// TODO: Clean up these style names and nesting
		const styles:any = {
			screen: {
				flex: 1,
				backgroundColor: theme.backgroundColor,
			},
			bodyTextInput: {
				flex: 1,
				paddingLeft: theme.marginLeft,
				paddingRight: theme.marginRight,

				// Add extra space to allow scrolling past end of document, and also to fix this:
				// https://github.com/laurent22/joplin/issues/1437
				// 2020-04-20: removed bottom padding because it doesn't work properly in Android
				// Instead of being inside the scrollable area, the padding is outside thus
				// restricting the view.
				// See https://github.com/laurent22/joplin/issues/3041#issuecomment-616267739
				// paddingBottom: Math.round(dimensions.height / 4),

				textAlignVertical: 'top',
				color: theme.color,
				backgroundColor: theme.backgroundColor,
				fontSize: theme.fontSize,
				fontFamily: editorFont(this.props.editorFont),
			},
			noteBodyViewer: {
				flex: 1,
				paddingLeft: theme.marginLeft,
				paddingRight: theme.marginRight,
			},
			checkbox: {
				color: theme.color,
				paddingRight: 10,
				paddingLeft: theme.marginLeft,
				paddingTop: 10, // Added for iOS (Not needed for Android??)
				paddingBottom: 10, // Added for iOS (Not needed for Android??)
			},
			markdownButtons: {
				borderColor: theme.dividerColor,
				color: theme.urlColor,
			},
		};

		styles.noteBodyViewerPreview = {
			...styles.noteBodyViewer,
			borderTopColor: theme.dividerColor,
			borderTopWidth: 1,
			borderBottomColor: theme.dividerColor,
			borderBottomWidth: 1,
		};

		styles.titleContainer = {
			flex: 0,
			flexDirection: 'row',
			paddingLeft: theme.marginLeft,
			paddingRight: theme.marginRight,
			borderBottomColor: theme.dividerColor,
			borderBottomWidth: 1,
		};

		styles.titleContainerTodo = Object.assign({}, styles.titleContainer);
		styles.titleContainerTodo.paddingLeft = 0;

		styles.titleTextInput = {
			flex: 1,
			marginTop: 0,
			paddingLeft: 0,
			color: theme.color,
			backgroundColor: theme.backgroundColor,
			fontWeight: 'bold',
			fontSize: theme.fontSize,
			paddingTop: 10, // Added for iOS (Not needed for Android??)
			paddingBottom: 10, // Added for iOS (Not needed for Android??)
		};

		if (this.enableMultilineTitle_) styles.titleTextInput.height = this.state.titleTextInputHeight;
		if (this.state.HACK_webviewLoadingState === 1) styles.titleTextInput.marginTop = 1;

		this.styles_[cacheKey] = StyleSheet.create(styles);
		return this.styles_[cacheKey];
	}

	isModified() {
		return shared.isModified(this);
	}

	undoState(noteBody:string = null) {
		return {
			body: noteBody === null ? this.state.note.body : noteBody,
		};
	}

	async requestGeoLocationPermissions() {
		if (!Setting.value('trackLocation')) return;

		const response = await checkPermissions(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
			message: _('In order to associate a geo-location with the note, the app needs your permission to access your location.\n\nYou may turn off this option at any time in the Configuration screen.'),
			title: _('Permission needed'),
		});

		// If the user simply pressed "Deny", we don't automatically switch it off because they might accept
		// once we show the rationale again on second try. If they press "Never again" however we switch it off.
		// https://github.com/zoontek/react-native-permissions/issues/385#issuecomment-563132396
		if (response === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
			reg.logger().info('Geo-location tracking has been automatically disabled');
			Setting.setValue('trackLocation', false);
		}
	}

	async componentDidMount() {
		BackButtonService.addHandler(this.backHandler);
		NavService.addHandler(this.navHandler);

		shared.clearResourceCache();
		shared.installResourceHandling(this.refreshResource);

		await shared.initState(this);

		this.undoRedoService_ = new UndoRedoService();
		this.undoRedoService_.on('stackChange', this.undoRedoService_stackChange);

		if (this.state.note && this.state.note.body && Setting.value('sync.resourceDownloadMode') === 'auto') {
			const resourceIds = await Note.linkedResourceIds(this.state.note.body);
			await ResourceFetcher.instance().markForDownload(resourceIds);
		}

		// Although it is async, we don't wait for the answer so that if permission
		// has already been granted, it doesn't slow down opening the note. If it hasn't
		// been granted, the popup will open anyway.
		this.requestGeoLocationPermissions();
	}

	onMarkForDownload(event:any) {
		ResourceFetcher.instance().markForDownload(event.resourceId);
	}

	componentDidUpdate(prevProps:any) {
		if (this.doFocusUpdate_) {
			this.doFocusUpdate_ = false;
			this.focusUpdate();
		}

		if (prevProps.showSideMenu !== this.props.showSideMenu && this.props.showSideMenu) {
			this.props.dispatch({
				type: 'NOTE_SIDE_MENU_OPTIONS_SET',
				options: this.sideMenuOptions(),
			});
		}
	}

	componentWillUnmount() {
		BackButtonService.removeHandler(this.backHandler);
		NavService.removeHandler(this.navHandler);

		shared.uninstallResourceHandling(this.refreshResource);

		if (this.state.fromShare) {
			ShareExtension.close();
		}

		this.saveActionQueue(this.state.note.id).processAllNow();

		// It cannot theoretically be undefined, since componentDidMount should always be called before
		// componentWillUnmount, but with React Native the impossible often becomes possible.
		if (this.undoRedoService_) this.undoRedoService_.off('stackChange', this.undoRedoService_stackChange);
	}

	title_changeText(text:string) {
		shared.noteComponent_change(this, 'title', text);
		this.setState({ newAndNoTitleChangeNoteId: null });
		this.scheduleSave();
	}

	body_changeText(text:string) {
		if (!this.undoRedoService_.canUndo) {
			this.undoRedoService_.push(this.undoState());
		} else {
			this.undoRedoService_.schedulePush(this.undoState());
		}
		shared.noteComponent_change(this, 'body', text);
		this.scheduleSave();
	}

	body_selectionChange(event:any) {
		this.selection = event.nativeEvent.selection;
	}

	makeSaveAction() {
		return async () => {
			return shared.saveNoteButton_press(this);
		};
	}

	saveActionQueue(noteId:string) {
		if (!this.saveActionQueues_[noteId]) {
			this.saveActionQueues_[noteId] = new AsyncActionQueue(500);
		}
		return this.saveActionQueues_[noteId];
	}

	scheduleSave() {
		this.saveActionQueue(this.state.note.id).push(this.makeSaveAction());
	}

	async saveNoteButton_press(folderId:string = null) {
		await shared.saveNoteButton_press(this, folderId);

		Keyboard.dismiss();
	}

	async saveOneProperty(name:string, value:any) {
		await shared.saveOneProperty(this, name, value);
	}

	async deleteNote_onPress() {
		const note = this.state.note;
		if (!note.id) return;

		const ok = await dialogs.confirm(this, _('Delete note?'));
		if (!ok) return;

		const folderId = note.parent_id;

		await Note.delete(note.id);

		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Notes',
			folderId: folderId,
		});
	}

	async pickDocument() {
		try {
			const result = await DocumentPicker.pick();
			return result;
		} catch (error) {
			if (DocumentPicker.isCancel(error)) {
				console.info('pickDocument: user has cancelled');
				return null;
			} else {
				throw error;
			}
		}
	}

	async imageDimensions(uri:string) {
		return new Promise((resolve, reject) => {
			Image.getSize(
				uri,
				(width:number, height:number) => {
					resolve({ width: width, height: height });
				},
				(error:any) => {
					reject(error);
				}
			);
		});
	}

	showImagePicker(options:any) {
		return new Promise((resolve) => {
			ImagePicker.launchImageLibrary(options, (response:any) => {
				resolve(response);
			});
		});
	}

	async resizeImage(localFilePath:string, targetPath:string, mimeType:string) {
		const maxSize = Resource.IMAGE_MAX_DIMENSION;

		const dimensions:any = await this.imageDimensions(localFilePath);

		reg.logger().info('Original dimensions ', dimensions);

		let mustResize = dimensions.width > maxSize || dimensions.height > maxSize;

		if (mustResize) {
			const buttonId = await dialogs.pop(this, _('You are about to attach a large image (%dx%d pixels). Would you like to resize it down to %d pixels before attaching it?', dimensions.width, dimensions.height, maxSize), [
				{ text: _('Yes'), id: 'yes' },
				{ text: _('No'), id: 'no' },
				{ text: _('Cancel'), id: 'cancel' },
			]);

			if (buttonId === 'cancel') return false;

			mustResize = buttonId === 'yes';
		}

		if (mustResize) {
			dimensions.width = maxSize;
			dimensions.height = maxSize;

			reg.logger().info('New dimensions ', dimensions);

			const format = mimeType == 'image/png' ? 'PNG' : 'JPEG';
			reg.logger().info(`Resizing image ${localFilePath}`);
			const resizedImage = await ImageResizer.createResizedImage(localFilePath, dimensions.width, dimensions.height, format, 85); // , 0, targetPath);

			const resizedImagePath = resizedImage.uri;
			reg.logger().info('Resized image ', resizedImagePath);
			reg.logger().info(`Moving ${resizedImagePath} => ${targetPath}`);

			await RNFS.copyFile(resizedImagePath, targetPath);

			try {
				await RNFS.unlink(resizedImagePath);
			} catch (error) {
				reg.logger().warn('Error when unlinking cached file: ', error);
			}
		} else {
			await RNFS.copyFile(localFilePath, targetPath);
		}

		return true;
	}

	async attachFile(pickerResponse:any, fileType:string) {
		if (!pickerResponse) {
			// User has cancelled
			return;
		}

		if (pickerResponse.error) {
			reg.logger().warn('Got error from picker', pickerResponse.error);
			return;
		}

		if (pickerResponse.didCancel) {
			reg.logger().info('User cancelled picker');
			return;
		}

		const localFilePath = Platform.select({
			android: pickerResponse.uri,
			ios: decodeURI(pickerResponse.uri),
		});

		let mimeType = pickerResponse.type;

		if (!mimeType) {
			const ext = fileExtension(localFilePath);
			mimeType = mimeUtils.fromFileExtension(ext);
		}

		if (!mimeType && fileType === 'image') {
			// Assume JPEG if we couldn't determine the file type. It seems to happen with the image picker
			// when the file path is something like content://media/external/images/media/123456
			// If the image is not a JPEG, something will throw an error below, but there's a good chance
			// it will work.
			reg.logger().info('Missing file type and could not detect it - assuming image/jpg');
			mimeType = 'image/jpg';
		}

		reg.logger().info(`Got file: ${localFilePath}`);
		reg.logger().info(`Got type: ${mimeType}`);

		let resource = Resource.new();
		resource.id = uuid.create();
		resource.mime = mimeType;
		resource.title = pickerResponse.fileName ? pickerResponse.fileName : '';
		resource.file_extension = safeFileExtension(fileExtension(pickerResponse.fileName ? pickerResponse.fileName : localFilePath));

		if (!resource.mime) resource.mime = 'application/octet-stream';

		const targetPath = Resource.fullPath(resource);

		try {
			if (mimeType == 'image/jpeg' || mimeType == 'image/jpg' || mimeType == 'image/png') {
				const done = await this.resizeImage(localFilePath, targetPath, mimeType);
				if (!done) return;
			} else {
				if (fileType === 'image') {
					dialogs.error(this, _('Unsupported image type: %s', mimeType));
					return;
				} else {
					await shim.fsDriver().copy(localFilePath, targetPath);

					const stat = await shim.fsDriver().stat(targetPath);
					if (stat.size >= 10000000) {
						await shim.fsDriver().remove(targetPath);
						throw new Error('Resources larger than 10 MB are not currently supported as they may crash the mobile applications. The issue is being investigated and will be fixed at a later time.');
					}
				}
			}
		} catch (error) {
			reg.logger().warn('Could not attach file:', error);
			await dialogs.error(this, error.message);
			return;
		}

		const itDoes = await shim.fsDriver().waitTillExists(targetPath);
		if (!itDoes) throw new Error(`Resource file was not created: ${targetPath}`);

		const fileStat = await shim.fsDriver().stat(targetPath);
		resource.size = fileStat.size;

		resource = await Resource.save(resource, { isNew: true });

		const resourceTag = Resource.markdownTag(resource);

		const newNote = Object.assign({}, this.state.note);

		if (this.state.mode == 'edit' && !this.useBetaEditor() && !!this.selection) {
			const prefix = newNote.body.substring(0, this.selection.start);
			const suffix = newNote.body.substring(this.selection.end);
			newNote.body = `${prefix}\n${resourceTag}\n${suffix}`;
		} else {
			newNote.body += `\n${resourceTag}`;
		}

		this.setState({ note: newNote });

		this.refreshResource(resource, newNote.body);

		this.scheduleSave();
	}

	async attachPhoto_onPress() {
		const response = await this.showImagePicker({ mediaType: 'photo', noData: true });
		await this.attachFile(response, 'image');
	}

	takePhoto_onPress() {
		this.setState({ showCamera: true });
	}

	cameraView_onPhoto(data:any) {
		this.attachFile(
			{
				uri: data.uri,
				didCancel: false,
				error: null,
				type: 'image/jpg',
			},
			'image'
		);

		this.setState({ showCamera: false });
	}

	cameraView_onCancel() {
		this.setState({ showCamera: false });
	}

	async attachFile_onPress() {
		const response = await this.pickDocument();
		await this.attachFile(response, 'all');
	}

	toggleIsTodo_onPress() {
		shared.toggleIsTodo_onPress(this);

		this.scheduleSave();
	}

	tags_onPress() {
		if (!this.state.note || !this.state.note.id) return;

		this.setState({ noteTagDialogShown: true });
	}

	async share_onPress() {
		await Share.share({
			message: `${this.state.note.title}\n\n${this.state.note.body}`,
			title: this.state.note.title,
		});
	}

	properties_onPress() {
		this.props.dispatch({ type: 'SIDE_MENU_OPEN' });
	}

	setAlarm_onPress() {
		this.setState({ alarmDialogShown: true });
	}

	async onAlarmDialogAccept(date:Date) {
		const newNote = Object.assign({}, this.state.note);
		newNote.todo_due = date ? date.getTime() : 0;

		await this.saveOneProperty('todo_due', date ? date.getTime() : 0);

		this.setState({ alarmDialogShown: false });
	}

	onAlarmDialogReject() {
		this.setState({ alarmDialogShown: false });
	}

	async showOnMap_onPress() {
		if (!this.state.note.id) return;

		const note = await Note.load(this.state.note.id);
		try {
			const url = Note.geolocationUrl(note);
			Linking.openURL(url);
		} catch (error) {
			this.props.dispatch({ type: 'SIDE_MENU_CLOSE' });
			await dialogs.error(this, error.message);
		}
	}

	async showSource_onPress() {
		if (!this.state.note.id) return;

		const note = await Note.load(this.state.note.id);
		try {
			Linking.openURL(note.source_url);
		} catch (error) {
			await dialogs.error(this, error.message);
		}
	}

	copyMarkdownLink_onPress() {
		const note = this.state.note;
		Clipboard.setString(Note.markdownTag(note));
	}

	sideMenuOptions() {
		const note = this.state.note;
		if (!note) return [];

		const output = [];

		const createdDateString = time.formatMsToLocal(note.user_created_time);
		const updatedDateString = time.formatMsToLocal(note.user_updated_time);

		output.push({ title: _('Created: %s', createdDateString) });
		output.push({ title: _('Updated: %s', updatedDateString) });
		output.push({ isDivider: true });

		output.push({
			title: _('View on map'),
			onPress: () => {
				this.showOnMap_onPress();
			},
		});
		if (note.source_url) {
			output.push({
				title: _('Go to source URL'),
				onPress: () => {
					this.showSource_onPress();
				},
			});
		}

		return output;
	}

	menuOptions() {
		const note = this.state.note;
		const isTodo = note && !!note.is_todo;
		const isSaved = note && note.id;

		const cacheKey = md5([isTodo, isSaved].join('_'));
		if (!this.menuOptionsCache_) this.menuOptionsCache_ = {};

		if (this.menuOptionsCache_[cacheKey]) return this.menuOptionsCache_[cacheKey];

		const output = [];

		// The file attachement modules only work in Android >= 5 (Version 21)
		// https://github.com/react-community/react-native-image-picker/issues/606

		// As of 2020-10-13, support for attaching images from the gallery is removed
		// as the package react-native-image-picker has permission issues. It's still
		// possible to attach files, which has often a similar UI, with thumbnails for
		// images so normally it should be enough.
		let canAttachPicture = true;
		if (Platform.OS === 'android' && Platform.Version < 21) canAttachPicture = false;
		if (canAttachPicture) {
			output.push({
				title: _('Attach...'),
				onPress: async () => {
					const buttons = [];

					// On iOS, it will show "local files", which means certain files saved from the browser
					// and the iCloud files, but it doesn't include photos and images from the CameraRoll
					//
					// On Android, it will depend on the phone, but usually it will allow browing all files and photos.
					buttons.push({ text: _('Attach file'), id: 'attachFile' });

					// Disabled on Android because it doesn't work due to permission issues, but enabled on iOS
					// because that's only way to browse photos from the camera roll.
					if (Platform.OS === 'ios') buttons.push({ text: _('Attach photo'), id: 'attachPhoto' });
					buttons.push({ text: _('Take photo'), id: 'takePhoto' });

					const buttonId = await dialogs.pop(this, _('Choose an option'), buttons);

					if (buttonId === 'takePhoto') this.takePhoto_onPress();
					if (buttonId === 'attachFile') this.attachFile_onPress();
					if (buttonId === 'attachPhoto') this.attachPhoto_onPress();
				},
			});
		}

		if (isTodo) {
			output.push({
				title: _('Set alarm'),
				onPress: () => {
					this.setState({ alarmDialogShown: true });
				},
			});
		}

		output.push({
			title: _('Share'),
			onPress: () => {
				this.share_onPress();
			},
		});
		if (isSaved) {
			output.push({
				title: _('Tags'),
				onPress: () => {
					this.tags_onPress();
				},
			});
		}
		output.push({
			title: isTodo ? _('Convert to note') : _('Convert to todo'),
			onPress: () => {
				this.toggleIsTodo_onPress();
			},
		});
		if (isSaved) {
			output.push({
				title: _('Copy Markdown link'),
				onPress: () => {
					this.copyMarkdownLink_onPress();
				},
			});
		}
		output.push({
			title: _('Properties'),
			onPress: () => {
				this.properties_onPress();
			},
		});
		output.push({
			title: _('Delete'),
			onPress: () => {
				this.deleteNote_onPress();
			},
		});

		this.menuOptionsCache_ = {};
		this.menuOptionsCache_[cacheKey] = output;

		return output;
	}

	async todoCheckbox_change(checked:boolean) {
		await this.saveOneProperty('todo_completed', checked ? time.unixMs() : 0);
	}

	titleTextInput_contentSizeChange(event:any) {
		if (!this.enableMultilineTitle_) return;

		const height = event.nativeEvent.contentSize.height;
		this.setState({ titleTextInputHeight: height });
	}

	scheduleFocusUpdate() {
		if (this.focusUpdateIID_) shim.clearTimeout(this.focusUpdateIID_);

		this.focusUpdateIID_ = shim.setTimeout(() => {
			this.focusUpdateIID_ = null;
			this.focusUpdate();
		}, 100);
	}

	focusUpdate() {
		if (this.focusUpdateIID_) shim.clearTimeout(this.focusUpdateIID_);
		this.focusUpdateIID_ = null;

		if (!this.state.note) return;
		let fieldToFocus = this.state.note.is_todo ? 'title' : 'body';
		if (this.state.mode === 'view') fieldToFocus = '';

		if (fieldToFocus === 'title' && this.refs.titleTextField) {
			this.refs.titleTextField.focus();
		}
		if (fieldToFocus === 'body' && this.markdownEditorRef.current) {
			if (this.markdownEditorRef.current) {
				this.markdownEditorRef.current.focus();
			}
		}
	}

	async folderPickerOptions_valueChanged(itemValue:any) {
		const note = this.state.note;
		const isProvisionalNote = this.props.provisionalNoteIds.includes(note.id);

		if (isProvisionalNote) {
			await this.saveNoteButton_press(itemValue);
		} else {
			await Note.moveToFolder(note.id, itemValue);
		}

		note.parent_id = itemValue;

		const folder = await Folder.load(note.parent_id);

		this.setState({
			lastSavedNote: Object.assign({}, note),
			note: note,
			folder: folder,
		});
	}

	folderPickerOptions() {
		const options = {
			enabled: true,
			selectedFolderId: this.state.folder ? this.state.folder.id : null,
			onValueChange: this.folderPickerOptions_valueChanged,
		};

		if (this.folderPickerOptions_ && options.selectedFolderId === this.folderPickerOptions_.selectedFolderId) return this.folderPickerOptions_;

		this.folderPickerOptions_ = options;
		return this.folderPickerOptions_;
	}

	onBodyViewerLoadEnd() {
		shim.setTimeout(() => {
			this.setState({ HACK_webviewLoadingState: 1 });
			shim.setTimeout(() => {
				this.setState({ HACK_webviewLoadingState: 0 });
			}, 50);
		}, 5);
	}

	onBodyViewerCheckboxChange(newBody:string) {
		this.saveOneProperty('body', newBody);
	}

	render() {
		if (this.state.isLoading) {
			return (
				<View style={this.styles().screen}>
					<ScreenHeader />
				</View>
			);
		}

		const theme = themeStyle(this.props.themeId);
		const note = this.state.note;
		const isTodo = !!Number(note.is_todo);

		if (this.state.showCamera) {
			return <CameraView themeId={this.props.themeId} style={{ flex: 1 }} onPhoto={this.cameraView_onPhoto} onCancel={this.cameraView_onCancel} />;
		}

		// Currently keyword highlighting is supported only when FTS is available.
		const keywords = this.props.searchQuery && !!this.props.ftsEnabled ? this.props.highlightedWords : emptyArray;

		let bodyComponent = null;
		if (this.state.mode == 'view' && !this.useBetaEditor()) {
			// Note: as of 2018-12-29 it's important not to display the viewer if the note body is empty,
			// to avoid the HACK_webviewLoadingState related bug.
			bodyComponent =
				!note || !note.body.trim() ? null : (
					<NoteBodyViewer
						onJoplinLinkClick={this.onJoplinLinkClick_}
						style={this.styles().noteBodyViewer}
						// Extra bottom padding to make it possible to scroll past the
						// action button (so that it doesn't overlap the text)
						paddingBottom={150}
						noteBody={note.body}
						noteMarkupLanguage={note.markup_language}
						noteResources={this.state.noteResources}
						highlightedKeywords={keywords}
						themeId={this.props.themeId}
						noteHash={this.props.noteHash}
						onCheckboxChange={this.onBodyViewerCheckboxChange}
						onMarkForDownload={this.onMarkForDownload}
						onLoadEnd={this.onBodyViewerLoadEnd}
					/>
				);
		} else {
			bodyComponent = this.useBetaEditor()
				// Note: blurOnSubmit is necessary to get multiline to work.
				// See https://github.com/facebook/react-native/issues/12717#issuecomment-327001997
				//
				// 2020-10-16: As of React Native 0.63, the Markdown Editor no longer crashes in Android, however the
				// cursor is still too unreliable to be usable, so we disable it in Android.
				? <MarkdownEditor
					ref={this.markdownEditorRef} // For focusing the Markdown editor
					editorFont={editorFont(this.props.editorFont)}
					style={this.styles().bodyTextInput}
					previewStyles={this.styles().noteBodyViewer}
					value={note.body}
					borderColor={this.styles().markdownButtons.borderColor}
					markdownButtonsColor={this.styles().markdownButtons.color}
					saveText={(text:string) => this.body_changeText(text)}
					blurOnSubmit={false}
					selectionColor={theme.textSelectionColor}
					keyboardAppearance={theme.keyboardAppearance}
					placeholder={_('Add body')}
					placeholderTextColor={theme.colorFaded}
					noteBodyViewer={{
						onJoplinLinkClick: this.onJoplinLinkClick_,
						style: this.styles().noteBodyViewerPreview,
						paddingBottom: 0,
						webViewStyle: theme,
						noteBody: note.body,
						noteMarkupLanguage: note.markup_language,
						noteResources: this.state.noteResources,
						highlightedKeywords: keywords,
						themeId: this.props.themeId,
						noteHash: this.props.noteHash,
						onCheckboxChange: this.onBodyViewerCheckboxChange,
						onMarkForDownload: this.onMarkForDownload,
						onLoadEnd: this.onBodyViewerLoadEnd,
					}}

				/>
				:
				// Note: In theory ScrollView can be used to provide smoother scrolling of the TextInput.
				// However it causes memory or rendering issues on older Android devices, probably because
				// the whole text input has to be in memory for the scrollview to work. So we keep it as
				// a plain TextInput for now.
				// See https://github.com/laurent22/joplin/issues/3041

				// IMPORTANT: The TextInput selection is unreliable and cannot be used in a controlled component
				// context. In other words, the selection should be considered read-only. For example, if the seleciton
				// is saved to the state in onSelectionChange and the current text in onChangeText, then set
				// back in `selection` and `value` props, it will mostly work. But when typing fast, sooner or
				// later the real selection will be different from what is stored in the state, thus making
				// the cursor jump around. Eg, when typing "abcdef", it will do this:
				//     abcd|
				//     abcde|
				//     abcde|f
				(
					<TextInput
						autoCapitalize="sentences"
						style={this.styles().bodyTextInput}
						ref="noteBodyTextField"
						multiline={true}
						value={note.body}
						onChangeText={(text:string) => this.body_changeText(text)}
						onSelectionChange={this.body_selectionChange}
						blurOnSubmit={false}
						selectionColor={theme.textSelectionColor}
						keyboardAppearance={theme.keyboardAppearance}
						placeholder={_('Add body')}
						placeholderTextColor={theme.colorFaded}
					/>
				);
		}

		const renderActionButton = () => {
			const buttons = [];

			buttons.push({
				title: _('Edit'),
				icon: 'md-create',
				onPress: () => {
					this.setState({ mode: 'edit' });

					this.doFocusUpdate_ = true;
				},
			});

			if (this.state.mode == 'edit') return null;

			return <ActionButton multiStates={true} buttons={buttons} buttonIndex={0} />;
		};

		const actionButtonComp = renderActionButton();

		// Save button is not really needed anymore with the improved save logic
		const showSaveButton = false; // this.state.mode == 'edit' || this.isModified() || this.saveButtonHasBeenShown_;
		const saveButtonDisabled = true;// !this.isModified();

		if (showSaveButton) this.saveButtonHasBeenShown_ = true;

		const titleContainerStyle = isTodo ? this.styles().titleContainerTodo : this.styles().titleContainer;

		const dueDate = Note.dueDateObject(note);

		const titleComp = (
			<View style={titleContainerStyle}>
				{isTodo && <Checkbox style={this.styles().checkbox} checked={!!Number(note.todo_completed)} onChange={this.todoCheckbox_change} />}
				<TextInput
					onContentSizeChange={this.titleTextInput_contentSizeChange}
					multiline={this.enableMultilineTitle_}
					ref="titleTextField"
					underlineColorAndroid="#ffffff00"
					autoCapitalize="sentences"
					style={this.styles().titleTextInput}
					value={note.title}
					onChangeText={this.title_changeText}
					selectionColor={theme.textSelectionColor}
					keyboardAppearance={theme.keyboardAppearance}
					placeholder={_('Add title')}
					placeholderTextColor={theme.colorFaded}
				/>
			</View>
		);

		const noteTagDialog = !this.state.noteTagDialogShown ? null : <NoteTagsDialog onCloseRequested={this.noteTagDialog_closeRequested} />;

		return (
			<View style={this.rootStyle(this.props.themeId).root}>
				<ScreenHeader
					folderPickerOptions={this.folderPickerOptions()}
					menuOptions={this.menuOptions()}
					showSaveButton={showSaveButton}
					saveButtonDisabled={saveButtonDisabled}
					onSaveButtonPress={this.saveNoteButton_press}
					showSideMenuButton={false}
					showSearchButton={false}
					showUndoButton={this.state.undoRedoButtonState.canUndo || this.state.undoRedoButtonState.canRedo}
					showRedoButton={this.state.undoRedoButtonState.canRedo}
					undoButtonDisabled={!this.state.undoRedoButtonState.canUndo && this.state.undoRedoButtonState.canRedo}
					onUndoButtonPress={this.screenHeader_undoButtonPress}
					onRedoButtonPress={this.screenHeader_redoButtonPress}
				/>
				{titleComp}
				{bodyComponent}
				{!this.useBetaEditor() && actionButtonComp}

				<SelectDateTimeDialog themeId={this.props.themeId} shown={this.state.alarmDialogShown} date={dueDate} onAccept={this.onAlarmDialogAccept} onReject={this.onAlarmDialogReject} />

				<DialogBox
					ref={(dialogbox:any) => {
						this.dialogbox = dialogbox;
					}}
				/>
				{noteTagDialog}
			</View>
		);
	}
}

const NoteScreen = connect((state:any) => {
	return {
		noteId: state.selectedNoteIds.length ? state.selectedNoteIds[0] : null,
		noteHash: state.selectedNoteHash,
		folderId: state.selectedFolderId,
		itemType: state.selectedItemType,
		folders: state.folders,
		searchQuery: state.searchQuery,
		themeId: state.settings.theme,
		editorFont: [state.settings['style.editor.fontFamily']],
		ftsEnabled: state.settings['db.ftsEnabled'],
		sharedData: state.sharedData,
		showSideMenu: state.showSideMenu,
		provisionalNoteIds: state.provisionalNoteIds,
		highlightedWords: state.highlightedWords,
	};
})(NoteScreenComponent);

export default NoteScreen;
