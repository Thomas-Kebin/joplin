const React = require('react'); const Component = React.Component;
const { Platform, Keyboard, BackHandler, View, Button, TextInput, WebView, Text, StyleSheet, Linking, Image } = require('react-native');
const { connect } = require('react-redux');
const { uuid } = require('lib/uuid.js');
const { Log } = require('lib/log.js');
const { Note } = require('lib/models/note.js');
const { Resource } = require('lib/models/resource.js');
const { Folder } = require('lib/models/folder.js');
const { BackButtonService } = require('lib/services/back-button.js');
const { BaseModel } = require('lib/base-model.js');
const { ActionButton } = require('lib/components/action-button.js');
const Icon = require('react-native-vector-icons/Ionicons').default;
const { ScreenHeader } = require('lib/components/screen-header.js');
const { time } = require('lib/time-utils.js');
const { Checkbox } = require('lib/components/checkbox.js');
const { _ } = require('lib/locale.js');
const { reg } = require('lib/registry.js');
const { shim } = require('lib/shim.js');
const { BaseScreenComponent } = require('lib/components/base-screen.js');
const { dialogs } = require('lib/dialogs.js');
const { globalStyle, themeStyle } = require('lib/components/global-style.js');
const DialogBox = require('react-native-dialogbox').default;
const { NoteBodyViewer } = require('lib/components/note-body-viewer.js');
const RNFetchBlob = require('react-native-fetch-blob').default;
const { DocumentPicker, DocumentPickerUtil } = require('react-native-document-picker');
const ImageResizer = require('react-native-image-resizer').default;
const shared = require('lib/components/shared/note-screen-shared.js');
const ImagePicker = require('react-native-image-picker');

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
		};

		// iOS doesn't support multiline text fields properly so disable it
		this.enableMultilineTitle_ = Platform.OS !== 'ios';
		
		this.saveButtonHasBeenShown_ = false;

		this.styles_ = {};

		this.backHandler = async () => {
			if (this.isModified()) {
				let buttonId = await dialogs.pop(this, _('This note has been modified:'), [
					{ title: _('Save changes'), id: 'save' },
					{ title: _('Discard changes'), id: 'discard' },
					{ title: _('Cancel'), id: 'cancel' },
				]);

				if (buttonId == 'cancel') return true;
				if (buttonId == 'save') await this.saveNoteButton_press();
			}

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

	async componentWillMount() {
		BackButtonService.addHandler(this.backHandler);

		await shared.initState(this);

		this.refreshNoteMetadata();
	}

	refreshNoteMetadata(force = null) {
		return shared.refreshNoteMetadata(this, force);
	}

	componentWillUnmount() {
		BackButtonService.removeHandler(this.backHandler);
	}

	title_changeText(text) {
		shared.noteComponent_change(this, 'title', text);
	}

	body_changeText(text) {
		shared.noteComponent_change(this, 'body', text);
	}

	async saveNoteButton_press() {
		await shared.saveNoteButton_press(this);

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
		const resizedImage = await ImageResizer.createResizedImage(localFilePath, dimensions.width, dimensions.height, format, 85);
		const resizedImagePath = resizedImage.uri;
		reg.logger().info('Resized image ', resizedImagePath);
		RNFetchBlob.fs.cp(resizedImagePath, targetPath); // mv doesn't work ("source path does not exist") so need to do cp and unlink
		
		try {
			RNFetchBlob.fs.unlink(resizedImagePath);
		} catch (error) {
			reg.logger().info('Error when unlinking cached file: ', error);
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

		reg.logger().info('Got file: ' + localFilePath);
		reg.logger().info('Got type: ' + pickerResponse.type);

		let resource = Resource.new();
		resource.id = uuid.create();
		resource.mime = pickerResponse.type;
		resource.title = pickerResponse.fileName ? pickerResponse.fileName : _('Untitled');

		let targetPath = Resource.fullPath(resource);

		if (pickerResponse.type == 'image/jpeg' || pickerResponse.type == 'image/jpg' || pickerResponse.type == 'image/png') {
			await this.resizeImage(localFilePath, targetPath, pickerResponse.mime);
		} else {
			if (fileType === 'image') {
				dialogs.error(this, _('Unsupported image type: %s', pickerResponse.type));
				return;
			} else {
				RNFetchBlob.fs.cp(localFilePath, targetPath);
			}
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

	async attachFile_onPress() {
		const response = await this.pickDocument();
		await this.attachFile(response, 'all');
	}

	toggleIsTodo_onPress() {
		shared.toggleIsTodo_onPress(this);
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

	menuOptions() {
		const note = this.state.note;
		const isTodo = note && !!note.is_todo;

		let output = [];

		output.push({ title: _('Attach image'), onPress: () => { this.attachImage_onPress(); } });
		output.push({ title: _('Attach any other file'), onPress: () => { this.attachFile_onPress(); } });
		output.push({ title: _('Delete note'), onPress: () => { this.deleteNote_onPress(); } });

		// if (isTodo) {
		// 	let text = note.todo_due ? _('Edit/Clear alarm') : _('Set an alarm');
		// 	output.push({ title: text, onPress: () => { this.setAlarm_onPress(); } });
		// }

		output.push({ title: isTodo ? _('Convert to regular note') : _('Convert to todo'), onPress: () => { this.toggleIsTodo_onPress(); } });
		if (this.props.showAdvancedOptions) output.push({ title: this.state.showNoteMetadata ? _('Hide metadata') : _('Show metadata'), onPress: () => { this.showMetadata_onPress(); } });
		output.push({ title: _('View location on map'), onPress: () => { this.showOnMap_onPress(); } });

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

		let bodyComponent = null;
		if (this.state.mode == 'view') {
			const onCheckboxChange = (newBody) => {
				this.saveOneProperty('body', newBody);
			};

			bodyComponent = <NoteBodyViewer style={this.styles().noteBodyViewer} webViewStyle={theme} note={note} onCheckboxChange={(newBody) => { onCheckboxChange(newBody) }}/>
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

			if (this.state.mode == 'edit') return <ActionButton style={{display:'none'}}/>;

			return <ActionButton multiStates={true} buttons={buttons} buttonIndex={0} />
		}

		const titlePickerItems = () => {
			let output = [];
			for (let i = 0; i < this.props.folders.length; i++) {
				let f = this.props.folders[i];
				output.push({ label: f.title, value: f.id });
			}
			return output;
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
				/>
			</View>
		);

		return (
			<View style={this.rootStyle(this.props.theme).root}>
				<ScreenHeader
					titlePicker={{
						items: titlePickerItems(),
						selectedValue: folder ? folder.id : null,
						onValueChange: async (itemValue, itemIndex) => {
							let note = Object.assign({}, this.state.note);

							// RN bug: https://github.com/facebook/react-native/issues/9220
							// The Picker fires the onValueChange when the component is initialized
							// so we need to check that it has actually changed.
							if (note.parent_id == itemValue) return;

							reg.logger().info('Moving note: ' + note.parent_id + ' => ' + itemValue);

							if (note.id) await Note.moveToFolder(note.id, itemValue);
							note.parent_id = itemValue;

							const folder = await Folder.load(note.parent_id);

							this.setState({
								lastSavedNote: Object.assign({}, note),
								note: note,
								folder: folder,
							});
						}
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
				<DialogBox ref={dialogbox => { this.dialogbox = dialogbox }}/>
			</View>
		);
	}

}

const NoteScreen = connect(
	(state) => {
		return {
			noteId: state.selectedNoteId,
			folderId: state.selectedFolderId,
			itemType: state.selectedItemType,
			folders: state.folders,
			theme: state.settings.theme,
			showAdvancedOptions: state.settings.showAdvancedOptions,
		};
	}
)(NoteScreenComponent)

module.exports = { NoteScreen };