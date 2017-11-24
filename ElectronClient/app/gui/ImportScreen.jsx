const React = require('react');
const { connect } = require('react-redux');
const { reg } = require('lib/registry.js');
const { Folder } = require('lib/models/folder.js');
const { bridge } = require('electron').remote.require('./bridge');
const { Header } = require('./Header.min.js');
const { themeStyle } = require('../theme.js');
const { _ } = require('lib/locale.js');
const { filename, basename } = require('lib/path-utils.js');
const { importEnex } = require('lib/import-enex');

class ImportScreenComponent extends React.Component {

	componentWillMount() {
		this.setState({
			doImport: true,
			filePath: this.props.filePath,
			messages: [],
		});
	}

	componentWillReceiveProps(newProps) {
		if (newProps.filePath) {
			this.setState({
				doImport: true,
				filePath: newProps.filePath,
				messages: [],
			});

			this.doImport();
		}
	}

	componentDidMount() {
		if (this.state.filePath && this.state.doImport) {
			this.doImport();
		}
	}

	addMessage(key, text) {
		const messages = this.state.messages.slice();
		let found = false;

		for (let i = 0; i < messages.length; i++) {
			if (messages[i].key === key) {
				messages[i].text = text;
				found = true;
				break;
			}
		}

		if (!found) messages.push({ key: key, text: text });

		this.setState({ messages: messages });
	}

	async doImport() {
		const filePath = this.props.filePath;
		const folderTitle = await Folder.findUniqueFolderTitle(filename(filePath));
		const messages = this.state.messages.slice();

		this.addMessage('start', _('New notebook "%s" will be created and file "%s" will be imported into it', folderTitle, basename(filePath)));

		let lastProgress = '';
		let progressCount = 0;

		const options = {
			onProgress: (progressState) => {
				let line = [];
				line.push(_('Found: %d.', progressState.loaded));
				line.push(_('Created: %d.', progressState.created));
				if (progressState.updated) line.push(_('Updated: %d.', progressState.updated));
				if (progressState.skipped) line.push(_('Skipped: %d.', progressState.skipped));
				if (progressState.resourcesCreated) line.push(_('Resources: %d.', progressState.resourcesCreated));
				if (progressState.notesTagged) line.push(_('Tagged: %d.', progressState.notesTagged));
				lastProgress = line.join(' ');
				this.addMessage('progress', lastProgress);
			},
			onError: (error) => {
				const messages = this.state.messages.slice();
				let s = error.trace ? error.trace : error.toString();
				messages.push({ key: 'error_' + (progressCount++), text: s });
				this.addMessage('error_' + (progressCount++), lastProgress);
			},
		}

		const folder = await Folder.save({ title: folderTitle });
		
		await importEnex(folder.id, filePath, options);

		this.addMessage('done', _('The notes have been imported: %s', lastProgress));
		this.setState({ doImport: false });
	}

	render() {
		const theme = themeStyle(this.props.theme);
		const style = this.props.style;
		const messages = this.state.messages;

		const messagesStyle = {
			padding: 10,
			fontSize: theme.fontSize,
			fontFamily: theme.fontFamily,
			backgroundColor: theme.backgroundColor,
		};

		const headerStyle = {
			width: style.width,
		};

		const messageComps = [];
		for (let i = 0; i < messages.length; i++) {
			messageComps.push(<div key={messages[i].key}>{messages[i].text}</div>);
		}

		return (
			<div style={{}}>
				<Header style={headerStyle} />
				<div style={messagesStyle}>
					{messageComps}
				</div>
			</div>
		);
	}

}

const mapStateToProps = (state) => {
	return {
		theme: state.settings.theme,
	};
};

const ImportScreen = connect(mapStateToProps)(ImportScreenComponent);

module.exports = { ImportScreen };