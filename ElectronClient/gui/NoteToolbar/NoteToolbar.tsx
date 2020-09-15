import * as React from 'react';
import { useEffect, useState } from 'react';
import CommandService from '../../lib/services/CommandService';
const { connect } = require('react-redux');
const { buildStyle } = require('lib/theme');
const Toolbar = require('../Toolbar.min.js');
// const Folder = require('lib/models/Folder');
// const { _ } = require('lib/locale');
// const { substrWithEllipsis } = require('lib/string-utils');

interface ButtonClickEvent {
	name: string,
}

interface NoteToolbarProps {
	themeId: number,
	style: any,
	folders: any[],
	watchedNoteFiles: string[],
	backwardHistoryNotes: any[],
	forwardHistoryNotes: any[],
	notesParentType: string,
	note: any,
	dispatch: Function,
	onButtonClick(event:ButtonClickEvent):void,
}

function styles_(props:NoteToolbarProps) {
	return buildStyle('NoteToolbar', props.themeId, (theme:any) => {
		return {
			root: {
				...props.style,
				borderBottom: 'none',
				backgroundColor: theme.backgroundColor,
			},
		};
	});
}

function NoteToolbar(props:NoteToolbarProps) {
	const styles = styles_(props);
	const [toolbarItems, setToolbarItems] = useState([]);
	// const selectedNoteFolder = Folder.byId(props.folders, props.note.parent_id);
	// const folderId = selectedNoteFolder ? selectedNoteFolder.id : '';
	// const folderTitle = selectedNoteFolder && selectedNoteFolder.title ? selectedNoteFolder.title : '';

	const cmdService = CommandService.instance();

	function updateToolbarItems() {
		const output = [];

		// if (props.watchedNoteFiles.indexOf(props.note.id) >= 0) {
		// 	output.push(cmdService.commandToToolbarButton('stopExternalEditing'));
		// } else {
		// 	output.push(cmdService.commandToToolbarButton('startExternalEditing'));
		// }

		output.push(cmdService.commandToToolbarButton('editAlarm'));
		output.push(cmdService.commandToToolbarButton('toggleVisiblePanes'));
		output.push(cmdService.commandToToolbarButton('showNoteProperties'));

		setToolbarItems(output);
	}

	useEffect(() => {
		updateToolbarItems();
		cmdService.on('commandsEnabledStateChange', updateToolbarItems);
		return () => {
			cmdService.off('commandsEnabledStateChange', updateToolbarItems);
		};
	}, []);

	return <Toolbar style={styles.root} items={toolbarItems} />;
}

const mapStateToProps = (state:any) => {
	return {
		folders: state.folders,
		watchedNoteFiles: state.watchedNoteFiles,
		backwardHistoryNotes: state.backwardHistoryNotes,
		forwardHistoryNotes: state.forwardHistoryNotes,
		notesParentType: state.notesParentType,
	};
};

export default connect(mapStateToProps)(NoteToolbar);
