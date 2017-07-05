import React, { Component } from 'react';
import { View, Button, TextInput } from 'react-native';
import { connect } from 'react-redux'
import { Log } from 'lib/log.js'
import { Note } from 'lib/models/note.js'
import { ScreenHeader } from 'lib/components/screen-header.js';
import { Checkbox } from 'lib/components/checkbox.js'
import { _ } from 'lib/locale.js';

class NoteScreenComponent extends React.Component {
	
	static navigationOptions(options) {
		return { header: null };
	}

	constructor() {
		super();
		this.state = { note: Note.new() }
	}

	componentWillMount() {
		if (!this.props.noteId) {
			let note = this.props.itemType == 'todo' ? Note.newTodo(this.props.folderId) : Note.new(this.props.folderId);
			this.setState({ note: note });
		} else {
			Note.load(this.props.noteId).then((note) => {
				this.setState({ note: note });
			});
		}
	}

	noteComponent_change(propName, propValue) {
		this.setState((prevState, props) => {
			let note = Object.assign({}, prevState.note);
			note[propName] = propValue;
			return { note: note }
		});
	}

	title_changeText(text) {
		this.noteComponent_change('title', text);
	}

	body_changeText(text) {
		this.noteComponent_change('body', text);
	}

	async saveNoteButton_press() {
		let isNew = !this.state.note.id;
		let note = await Note.save(this.state.note);
		this.setState({ note: note });
		if (isNew) Note.updateGeolocation(note.id);
	}

	deleteNote_onPress(noteId) {
		Log.info('DELETE', noteId);
	}

	attachFile_onPress(noteId) {
	}

	menuOptions() {
		return [
			{ title: _('Attach file'), onPress: () => { this.attachFile_onPress(this.state.note.id); } },
			{ title: _('Delete note'), onPress: () => { this.deleteNote_onPress(this.state.note.id); } },
		];
	}

	render() {
		const note = this.state.note;
		const isTodo = !!Number(note.is_todo);
		let todoComponents = null;

		if (note.is_todo) {
			todoComponents = (
				<View>
					<Button title="test" onPress={this.saveNoteButton_press} />
				</View>
			);
		}

		return (
			<View style={{flex: 1}}>
				<ScreenHeader navState={this.props.navigation.state} menuOptions={this.menuOptions()} />
				<View style={{ flexDirection: 'row' }}>
					{ isTodo && <Checkbox checked={!!Number(note.todo_completed)} /> }<TextInput style={{flex:1}} value={note.title} onChangeText={(text) => this.title_changeText(text)} />
				</View>
				<TextInput style={{flex: 1, textAlignVertical: 'top'}} multiline={true} value={note.body} onChangeText={(text) => this.body_changeText(text)} />
				{ todoComponents }
				<Button title="Save note" onPress={() => this.saveNoteButton_press()} />
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
		};
	}
)(NoteScreenComponent)

export { NoteScreen };