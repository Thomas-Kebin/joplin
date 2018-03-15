const React = require('react'); const Component = React.Component;
const { View, Button, TextInput, StyleSheet } = require('react-native');
const { connect } = require('react-redux');
const { ActionButton } = require('lib/components/action-button.js');
const Folder = require('lib/models/Folder.js');
const BaseModel = require('lib/BaseModel.js');
const { ScreenHeader } = require('lib/components/screen-header.js');
const { reg } = require('lib/registry.js');
const { BaseScreenComponent } = require('lib/components/base-screen.js');
const { dialogs } = require('lib/dialogs.js');
const { themeStyle } = require('lib/components/global-style.js');
const { _ } = require('lib/locale.js');

class FolderScreenComponent extends BaseScreenComponent {
	
	static navigationOptions(options) {
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
		const theme = themeStyle(this.props.theme);

		if (this.styles_[this.props.theme]) return this.styles_[this.props.theme];
		this.styles_ = {};

		let styles = {
			textInput: {
				color: theme.color,
				paddingLeft: 10,
			},
		};

		this.styles_[this.props.theme] = StyleSheet.create(styles);
		return this.styles_[this.props.theme];
	}

	componentWillMount() {
		if (!this.props.folderId) {
			const folder = Folder.new();
			this.setState({
				folder: folder,
				lastSavedFolder: Object.assign({}, folder),
			});
		} else {
			Folder.load(this.props.folderId).then((folder) => {
				this.setState({
					folder: folder,
					lastSavedFolder: Object.assign({}, folder),
				});
			});
		}
	}

	isModified() {
		if (!this.state.folder || !this.state.lastSavedFolder) return false;
		let diff = BaseModel.diffObjects(this.state.folder, this.state.lastSavedFolder);
		delete diff.type_;
		return !!Object.getOwnPropertyNames(diff).length;
	}

	folderComponent_change(propName, propValue) {
		this.setState((prevState, props) => {
			let folder = Object.assign({}, prevState.folder);
			folder[propName] = propValue;
			return { folder: folder }
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
		let saveButtonDisabled = !this.isModified();

		return (
			<View style={this.rootStyle(this.props.theme).root}>
				<ScreenHeader
					title={_('Edit notebook')}
					showSaveButton={true}
					saveButtonDisabled={saveButtonDisabled}
					onSaveButtonPress={() => this.saveFolderButton_press()}
				/>
				<TextInput style={this.styles().textInput} autoFocus={true} value={this.state.folder.title} onChangeText={(text) => this.title_changeText(text)} />
				<dialogs.DialogBox ref={dialogbox => { this.dialogbox = dialogbox }}/>
			</View>
		);
	}

}

const FolderScreen = connect(
	(state) => {
		return {
			folderId: state.selectedFolderId,
			theme: state.settings.theme,
		};
	}
)(FolderScreenComponent)

module.exports = { FolderScreen };