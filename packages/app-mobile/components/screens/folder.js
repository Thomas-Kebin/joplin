const React = require('react');

const { View, TextInput, StyleSheet } = require('react-native');
const { connect } = require('react-redux');
const Folder = require('@joplin/lib/models/Folder').default;
const BaseModel = require('@joplin/lib/BaseModel').default;
const { ScreenHeader } = require('../screen-header.js');
const { BaseScreenComponent } = require('../base-screen.js');
const { dialogs } = require('../../utils/dialogs.js');
const { themeStyle } = require('../global-style.js');
const { _ } = require('@joplin/lib/locale');

class FolderScreenComponent extends BaseScreenComponent {
	static navigationOptions() {
		return { header: null };
	}

	constructor() {
		super();
		this.state = {
			folder: Folder.new(),
			lastSavedFolder: null,
		};
		this.styles_ = {};
	}

	styles() {
		const theme = themeStyle(this.props.themeId);

		if (this.styles_[this.props.themeId]) return this.styles_[this.props.themeId];
		this.styles_ = {};

		const styles = {
			textInput: {
				color: theme.color,
				paddingLeft: theme.marginLeft,
				marginTop: theme.marginTop,
			},
		};

		this.styles_[this.props.themeId] = StyleSheet.create(styles);
		return this.styles_[this.props.themeId];
	}

	UNSAFE_componentWillMount() {
		if (!this.props.folderId) {
			const folder = Folder.new();
			this.setState({
				folder: folder,
				lastSavedFolder: Object.assign({}, folder),
			});
		} else {
			Folder.load(this.props.folderId).then(folder => {
				this.setState({
					folder: folder,
					lastSavedFolder: Object.assign({}, folder),
				});
			});
		}
	}

	isModified() {
		if (!this.state.folder || !this.state.lastSavedFolder) return false;
		const diff = BaseModel.diffObjects(this.state.folder, this.state.lastSavedFolder);
		delete diff.type_;
		return !!Object.getOwnPropertyNames(diff).length;
	}

	folderComponent_change(propName, propValue) {
		this.setState((prevState) => {
			const folder = Object.assign({}, prevState.folder);
			folder[propName] = propValue;
			return { folder: folder };
		});
	}

	title_changeText(text) {
		this.folderComponent_change('title', text);
	}

	async saveFolderButton_press() {
		let folder = Object.assign({}, this.state.folder);

		try {
			folder = await Folder.save(folder, { userSideValidation: true });
		} catch (error) {
			dialogs.error(this, _('The notebook could not be saved: %s', error.message));
			return;
		}

		this.setState({
			lastSavedFolder: Object.assign({}, folder),
			folder: folder,
		});

		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Notes',
			folderId: folder.id,
		});
	}

	render() {
		const saveButtonDisabled = !this.isModified();
		const theme = themeStyle(this.props.themeId);

		return (
			<View style={this.rootStyle(this.props.themeId).root}>
				<ScreenHeader title={_('Edit notebook')} showSaveButton={true} saveButtonDisabled={saveButtonDisabled} onSaveButtonPress={() => this.saveFolderButton_press()} showSideMenuButton={false} showSearchButton={false} />
				<TextInput placeholder={_('Enter notebook title')} placeholderTextColor={theme.colorFaded} underlineColorAndroid={theme.dividerColor} selectionColor={theme.textSelectionColor} keyboardAppearance={theme.keyboardAppearance} style={this.styles().textInput} autoFocus={true} value={this.state.folder.title} onChangeText={text => this.title_changeText(text)} />
				<dialogs.DialogBox
					ref={dialogbox => {
						this.dialogbox = dialogbox;
					}}
				/>
			</View>
		);
	}
}

const FolderScreen = connect(state => {
	return {
		folderId: state.selectedFolderId,
		themeId: state.settings.theme,
	};
})(FolderScreenComponent);

module.exports = { FolderScreen };
