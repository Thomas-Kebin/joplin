const React = require('react'); const Component = React.Component;
const { Platform, Clipboard, Keyboard, BackHandler, View, Button, TextInput, WebView, Text, StyleSheet, Linking, Image, Share } = require('react-native');
const { connect } = require('react-redux');
const { uuid } = require('lib/uuid.js');
const RNFS = require('react-native-fs');
const Note = require('lib/models/Note.js');
const BaseItem = require('lib/models/BaseItem.js');
const Setting = require('lib/models/Setting.js');
const Resource = require('lib/models/Resource.js');
const Folder = require('lib/models/Folder.js');
const { BackButtonService } = require('lib/services/back-button.js');
const NavService = require('lib/services/NavService.js');
const BaseModel = require('lib/BaseModel.js');
const { ActionButton } = require('lib/components/action-button.js');
const Icon = require('react-native-vector-icons/Ionicons').default;
const { fileExtension, basename, safeFileExtension } = require('lib/path-utils.js');
const mimeUtils = require('lib/mime-utils.js').mime;
const { ScreenHeader } = require('lib/components/screen-header.js');
const NoteTagsDialog = require('lib/components/screens/NoteTagsDialog');
const { time } = require('lib/time-utils.js');
const { Checkbox } = require('lib/components/checkbox.js');
const { _ } = require('lib/locale.js');
const { reg } = require('lib/registry.js');
const { shim } = require('lib/shim.js');
const ResourceFetcher = require('lib/services/ResourceFetcher');
const { BaseScreenComponent } = require('lib/components/base-screen.js');
const { globalStyle, themeStyle } = require('lib/components/global-style.js');
const { dialogs } = require('lib/dialogs.js');
const DialogBox = require('react-native-dialogbox').default;
const { NoteBodyViewer } = require('lib/components/note-body-viewer.js');
const RNFetchBlob = require('rn-fetch-blob').default;
const { DocumentPicker, DocumentPickerUtil } = require('react-native-document-picker');
const ImageResizer = require('react-native-image-resizer').default;
const shared = require('lib/components/shared/note-screen-shared.js');
const ImagePicker = require('react-native-image-picker');
const AlarmService = require('lib/services/AlarmService.js');
const { SelectDateTimeDialog } = require('lib/components/select-date-time-dialog.js');
const ShareExtension = require('react-native-share-extension').default;
const CameraView = require('lib/components/CameraView');

import FileViewer from 'react-native-file-viewer';

class NoteScreenComponent extends BaseScreenComponent {

	static navigationOptions(options) {
		return { header: null };
	}

	constructor() {
		super();
		this.state = {
			note: Note.new(),
			mode: 'view',
			noteMetadata: '',
			showNoteMetadata: false,
			folder: null,
			lastSavedNote: null,
			isLoading: true,
			titleTextInputHeight: 20,
			alarmDialogShown: false,
			heightBumpView:0,
			noteTagDialogShown: false,
			fromShare: false,
			showCamera: false,
		};

		// iOS doesn't support multiline text fields properly so disable it
		this.enableMultilineTitle_ = Platform.OS !== 'ios';

		this.saveButtonHasBeenShown_ = false;

		this.styles_ = {};

		const saveDialog = async () => {
			if (this.isModified()) {
				let buttonId = await dialogs.pop(this, _('This note has been modified:'), [
					{ text: _('Save changes'), id: 'save' },
					{ text: _('Discard changes'), id: 'discard' },
					{ text: _('Cancel'), id: 'cancel' },
				]);

				if (buttonId == 'cancel') return true;
				if (buttonId == 'save') await this.saveNoteButton_press();
			}

			return false;
		}

		this.navHandler = async () => {
			return await saveDialog();
		}

		this.backHandler = async () => {
			const r = await saveDialog();
			if (r) return r;

			if (!this.state.note.id) {
				return false;
			}

			if (this.state.mode == 'edit') {
				Keyboard.dismiss()

				this.setState({
					note: Object.assign({}, this.state.lastSavedNote),
					mode: 'view',
				});

				return true;
			}

			return false;
		};

		this.noteTagDialog_closeRequested = () => {
			this.setState({ noteTagDialogShown: false });
		}

		this.onJoplinLinkClick_ = async (msg) => {
			try {
				if (msg.indexOf('joplin://') === 0) {
					const itemId = msg.substr('joplin://'.length);
					const item = await BaseItem.loadItemById(itemId);
					if (!item) throw new Error(_('No item with ID %s', itemId));

					if (item.type_ === BaseModel.TYPE_NOTE) {
						// Easier to just go back, then go to the note since
						// the Note screen doesn't handle reloading a different note

						this.props.dispatch({
							type: 'NAV_BACK',
						});

						setTimeout(() => {
							this.props.dispatch({
								type: 'NAV_GO',
								routeName: 'Note',
								noteId: item.id,
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
					Linking.openURL(msg);
				}
			} catch (error) {
				dialogs.error(this, error.message);
			}
		}

		this.resourceFetcher_downloadComplete = async (resource) => {
			if (!this.state.note || !this.state.note.body) return;
			const resourceIds = await Note.linkedResourceIds(this.state.note.body);
			if (resourceIds.indexOf(resource.id) >= 0) {
				this.refs.noteBodyViewer.rebuildMd();
			}
		}

		this.attachPhoto_onPress = this.attachPhoto_onPress.bind(this);
		this.cameraView_onPhoto = this.cameraView_onPhoto.bind(this);
		this.cameraView_onCancel = this.cameraView_onCancel.bind(this);
	}

	styles() {
		const themeId = this.props.theme;
		const theme = themeStyle(themeId);

		if (this.styles_[themeId]) return this.styles_[themeId];
		this.styles_ = {};

		let styles = {
			bodyTextInput: {
				flex: 1,
				paddingLeft: theme.marginLeft,
				paddingRight: theme.marginRight,
				textAlignVertical: 'top',
				color: theme.color,
				backgroundColor: theme.backgroundColor,
				fontSize: theme.fontSize,
			},
			noteBodyViewer: {
				flex: 1,
				paddingLeft: theme.marginLeft,
				paddingRight: theme.marginRight,
				paddingTop: theme.marginTop,
				paddingBottom: theme.marginBottom,
			},
			metadata: {
				paddingLeft: globalStyle.marginLeft,
				paddingRight: globalStyle.marginRight,
				color: theme.color,
			},
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

		this.styles_[themeId] = StyleSheet.create(styles);
		return this.styles_[themeId];
	}

	isModified() {
		return shared.isModified(this);
	}

	async UNSAFE_componentWillMount() {
		BackButtonService.addHandler(this.backHandler);
		NavService.addHandler(this.navHandler);

		ResourceFetcher.instance().on('downloadComplete', this.resourceFetcher_downloadComplete);

		await shared.initState(this);

		this.refreshNoteMetadata();
	}

	refreshNoteMetadata(force = null) {
		return shared.refreshNoteMetadata(this, force);
	}

	componentWillUnmount() {
		BackButtonService.removeHandler(this.backHandler);
		NavService.removeHandler(this.navHandler);

		ResourceFetcher.instance().off('downloadComplete', this.resourceFetcher_downloadComplete);

		if (Platform.OS !== 'ios' && this.state.fromShare) {
			ShareExtension.close();
		}
	}

	title_changeText(text) {
		shared.noteComponent_change(this, 'title', text);
		this.setState({ newAndNoTitleChangeNoteId: null });
	}

	body_changeText(text) {
		shared.noteComponent_change(this, 'body', text);
	}

	async saveNoteButton_press(folderId = null) {
		await shared.saveNoteButton_press(this, folderId);

		Keyboard.dismiss();
	}

	async saveOneProperty(name, value) {
		await shared.saveOneProperty(this, name, value);
	}

	async deleteNote_onPress() {
		let note = this.state.note;
		if (!note.id) return;

		let ok = await dialogs.confirm(this, _('Delete note?'));
		if (!ok) return;

		let folderId = note.parent_id;

		await Note.delete(note.id);

		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Notes',
			folderId: folderId,
		});
	}

	async pickDocument() {
		return new Promise((resolve, reject) => {
			DocumentPicker.show({ filetype: [DocumentPickerUtil.allFiles()] }, (error,res) => {
				if (error) {
					// Also returns an error if the user doesn't pick a file
					// so just resolve with null.
					console.info('pickDocument error:', error);
					resolve(null);
					return;
				}

				resolve(res);
			});
		});
	}

	async imageDimensions(uri) {
		return new Promise((resolve, reject) => {
			Image.getSize(uri, (width, height) => {
				resolve({ width: width, height: height });
			}, (error) => { reject(error) });
		});
	}

	showImagePicker(options) {
		return new Promise((resolve, reject) => {
			ImagePicker.showImagePicker(options, (response) => {
				resolve(response);
			});
		});
	}

	async resizeImage(localFilePath, targetPath, mimeType) {
		const maxSize = Resource.IMAGE_MAX_DIMENSION;

		let dimensions = await this.imageDimensions(localFilePath);

		reg.logger().info('Original dimensions ', dimensions);
		if (dimensions.width > maxSize || dimensions.height > maxSize) {
			dimensions.width = maxSize;
			dimensions.height = maxSize;
		}
		reg.logger().info('New dimensions ', dimensions);

		const format = mimeType == 'image/png' ? 'PNG' : 'JPEG';
		reg.logger().info('Resizing image ' + localFilePath);
		const resizedImage = await ImageResizer.createResizedImage(localFilePath, dimensions.width, dimensions.height, format, 85); //, 0, targetPath);

		const resizedImagePath = resizedImage.uri;
		reg.logger().info('Resized image ', resizedImagePath);
		reg.logger().info('Moving ' + resizedImagePath + ' => ' + targetPath);

		await RNFS.copyFile(resizedImagePath, targetPath);

		try {
			await RNFS.unlink(resizedImagePath);
		} catch (error) {
			reg.logger().warn('Error when unlinking cached file: ', error);
		}
	}

	async attachFile(pickerResponse, fileType) {		
		if (!pickerResponse) {
			reg.logger().warn('Got no response from picker');
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

		const localFilePath = pickerResponse.uri;
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

		reg.logger().info('Got file: ' + localFilePath);
		reg.logger().info('Got type: ' + mimeType);

		let resource = Resource.new();
		resource.id = uuid.create();
		resource.mime = mimeType;
		resource.title = pickerResponse.fileName ? pickerResponse.fileName : _('Untitled');
		resource.file_extension = safeFileExtension(fileExtension(pickerResponse.fileName ? pickerResponse.fileName : localFilePath));

		if (!resource.mime) resource.mime = 'application/octet-stream';

		let targetPath = Resource.fullPath(resource);

		try {
			if (mimeType == 'image/jpeg' || mimeType == 'image/jpg' || mimeType == 'image/png') {
				await this.resizeImage(localFilePath, targetPath, pickerResponse.mime);
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

		await Resource.save(resource, { isNew: true });

		const resourceTag = Resource.markdownTag(resource);

		const newNote = Object.assign({}, this.state.note);
		newNote.body += "\n" + resourceTag;
		this.setState({ note: newNote });
	}

	async attachImage_onPress() {
		const options = {
			mediaType: 'photo',
		};
		const response = await this.showImagePicker(options);
		await this.attachFile(response, 'image');
	}

	attachPhoto_onPress() {
		this.setState({ showCamera: true });
	}	

	cameraView_onPhoto(data) {
		this.attachFile({
			uri: data.uri,
			didCancel: false,
			error: null,
			type: 'image/jpg',
		}, 'image');

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
	}

	tags_onPress() {
		if (!this.state.note || !this.state.note.id) return;

		this.setState({ noteTagDialogShown: true });
	}

	async share_onPress() {
		await Share.share({
			message: this.state.note.title + '\n\n' + this.state.note.body,
			title: this.state.note.title,
		});
	}

	setAlarm_onPress() {
		this.setState({ alarmDialogShown: true });
	}

	async onAlarmDialogAccept(date) {
		let newNote = Object.assign({}, this.state.note);
		newNote.todo_due = date ? date.getTime() : 0;

		await this.saveOneProperty('todo_due', date ? date.getTime() : 0);

		this.setState({ alarmDialogShown: false });
	}

	onAlarmDialogReject() {
		this.setState({ alarmDialogShown: false });
	}

	showMetadata_onPress() {
		shared.showMetadata_onPress(this);
	}

	async showOnMap_onPress() {
		if (!this.state.note.id) return;

		let note = await Note.load(this.state.note.id);
		try {
			const url = Note.geolocationUrl(note);
			Linking.openURL(url);
		} catch (error) {
			await dialogs.error(this, error.message);
		}
	}

	async showSource_onPress() {
		if (!this.state.note.id) return;

		let note = await Note.load(this.state.note.id);
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

	menuOptions() {
		const note = this.state.note;
		const isTodo = note && !!note.is_todo;
		const isSaved = note && note.id;
		const hasSource = note && note.source_url;

		let output = [];

		// The file attachement modules only work in Android >= 5 (Version 21)
		// https://github.com/react-community/react-native-image-picker/issues/606
		let canAttachPicture = true;
		if (Platform.OS === 'android' && Platform.Version < 21) canAttachPicture = false;
		if (canAttachPicture) {
			output.push({ title: _('Attach photo'), onPress: () => { this.attachPhoto_onPress(); } });
			output.push({ title: _('Attach any file'), onPress: () => { this.attachFile_onPress(); } });
			output.push({ isDivider: true });
		}

		if (isTodo) {
			output.push({ title: _('Set alarm'), onPress: () => { this.setState({ alarmDialogShown: true }) }});;
		}

		output.push({ title: _('Share'), onPress: () => { this.share_onPress(); } });
		if (isSaved) output.push({ title: _('Tags'), onPress: () => { this.tags_onPress(); } });
		output.push({ title: isTodo ? _('Convert to note') : _('Convert to todo'), onPress: () => { this.toggleIsTodo_onPress(); } });
		if (isSaved) output.push({ title: _('Copy Markdown link'), onPress: () => { this.copyMarkdownLink_onPress(); } });
		output.push({ isDivider: true });
		if (this.props.showAdvancedOptions) output.push({ title: this.state.showNoteMetadata ? _('Hide metadata') : _('Show metadata'), onPress: () => { this.showMetadata_onPress(); } });
		output.push({ title: _('View on map'), onPress: () => { this.showOnMap_onPress(); } });
		if (hasSource) output.push({ title: _('Go to source URL'), onPress: () => { this.showSource_onPress(); } });
		output.push({ isDivider: true });
		output.push({ title: _('Delete'), onPress: () => { this.deleteNote_onPress(); } });

		return output;
	}

	async todoCheckbox_change(checked) {
		await this.saveOneProperty('todo_completed', checked ? time.unixMs() : 0);
	}

	titleTextInput_contentSizeChange(event) {
		if (!this.enableMultilineTitle_) return;

		let height = event.nativeEvent.contentSize.height;
		this.setState({ titleTextInputHeight: height });
	}

	render() {
		if (this.state.isLoading) {
			return (
				<View style={this.styles().screen}>
					<ScreenHeader/>
				</View>
			);
		}

		const theme = themeStyle(this.props.theme);
		const note = this.state.note;
		const isTodo = !!Number(note.is_todo);
		const folder = this.state.folder;
		const isNew = !note.id;

		if (this.state.showCamera) {
			return <CameraView theme={this.props.theme} style={{flex:1}} onPhoto={this.cameraView_onPhoto} onCancel={this.cameraView_onCancel}/>
		}




		let bodyComponent = null;
		if (this.state.mode == 'view') {
			const onCheckboxChange = (newBody) => {
				this.saveOneProperty('body', newBody);
			};

			bodyComponent = <NoteBodyViewer
				onJoplinLinkClick={this.onJoplinLinkClick_}
				ref="noteBodyViewer"
				style={this.styles().noteBodyViewer}
				webViewStyle={theme}
				note={note}
				onCheckboxChange={(newBody) => { onCheckboxChange(newBody) }}
			/>
		} else {
			const focusBody = !isNew && !!note.title;

			// Note: blurOnSubmit is necessary to get multiline to work.
			// See https://github.com/facebook/react-native/issues/12717#issuecomment-327001997
			bodyComponent = (
				<TextInput
					autoCapitalize="sentences"
					autoFocus={focusBody}
					style={this.styles().bodyTextInput}
					multiline={true}
					value={note.body}
					onChangeText={(text) => this.body_changeText(text)}
					blurOnSubmit={false}
					selectionColor={theme.textSelectionColor}
				/>
			);
		}

		const renderActionButton = () => {
			let buttons = [];

			buttons.push({
				title: _('Edit'),
				icon: 'md-create',
				onPress: () => {
					this.setState({ mode: 'edit' });
				},
			});

			if (this.state.mode == 'edit') return null;//<ActionButton style={{display:'none'}}/>;

			return <ActionButton multiStates={true} buttons={buttons} buttonIndex={0} />
		}

		const actionButtonComp = renderActionButton();

		let showSaveButton = this.state.mode == 'edit' || this.isModified() || this.saveButtonHasBeenShown_;
		let saveButtonDisabled = !this.isModified();

		if (showSaveButton) this.saveButtonHasBeenShown_ = true;

		const titleContainerStyle = isTodo ? this.styles().titleContainerTodo : this.styles().titleContainer;

		let titleTextInputStyle = {
			flex: 1,
			paddingLeft: 0,
			color: theme.color,
			backgroundColor: theme.backgroundColor,
			fontWeight: 'bold',
			fontSize: theme.fontSize,
			paddingTop: 10, // Added for iOS (Not needed for Android??)
			paddingBottom: 10, // Added for iOS (Not needed for Android??)
		};

		if (this.enableMultilineTitle_) titleTextInputStyle.height = this.state.titleTextInputHeight;

		let checkboxStyle = {
			color: theme.color,
			paddingRight: 10,
			paddingLeft: theme.marginLeft,
			paddingTop: 10, // Added for iOS (Not needed for Android??)
			paddingBottom: 10, // Added for iOS (Not needed for Android??)
		}

		const dueDate = isTodo && note.todo_due ? new Date(note.todo_due) : null;

		const titleComp = (
			<View style={titleContainerStyle}>
				{ isTodo && <Checkbox style={checkboxStyle} checked={!!Number(note.todo_completed)} onChange={(checked) => { this.todoCheckbox_change(checked) }} /> }
				<TextInput
					onContentSizeChange={(event) => this.titleTextInput_contentSizeChange(event)}
					autoFocus={isNew}
					multiline={this.enableMultilineTitle_}
					underlineColorAndroid="#ffffff00"
					autoCapitalize="sentences"
					style={titleTextInputStyle}
					value={note.title}
					onChangeText={(text) => this.title_changeText(text)}
					selectionColor={theme.textSelectionColor}
				/>
			</View>
		);

		const noteTagDialog = !this.state.noteTagDialogShown ? null : <NoteTagsDialog onCloseRequested={this.noteTagDialog_closeRequested}/>;

		return (
			<View style={this.rootStyle(this.props.theme).root}>
				<ScreenHeader
					folderPickerOptions={{
						enabled: true,
						selectedFolderId: folder ? folder.id : null,
						onValueChange: async (itemValue, itemIndex) => {
							if (!note.id) {
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
						},
					}}
					menuOptions={this.menuOptions()}
					showSaveButton={showSaveButton}
					saveButtonDisabled={saveButtonDisabled}
					onSaveButtonPress={() => this.saveNoteButton_press()}
				/>
				{ titleComp }
				{ bodyComponent }
				{ actionButtonComp }
				{ this.state.showNoteMetadata && <Text style={this.styles().metadata}>{this.state.noteMetadata}</Text> }

				<SelectDateTimeDialog
					shown={this.state.alarmDialogShown}
					date={dueDate}
					onAccept={(date) => this.onAlarmDialogAccept(date) }
					onReject={() => this.onAlarmDialogReject() }
				/>

				<DialogBox ref={dialogbox => { this.dialogbox = dialogbox }}/>
				{ noteTagDialog }
			</View>
		);
	}

}

const NoteScreen = connect(
	(state) => {
		return {
			noteId: state.selectedNoteIds.length ? state.selectedNoteIds[0] : null,
			folderId: state.selectedFolderId,
			itemType: state.selectedItemType,
			folders: state.folders,
			theme: state.settings.theme,
			sharedData: state.sharedData,
			showAdvancedOptions: state.settings.showAdvancedOptions,
		};
	}
)(NoteScreenComponent)

module.exports = { NoteScreen };
