const { reg } = require('lib/registry.js');
const Folder = require('lib/models/Folder.js');
const BaseModel = require('lib/BaseModel.js');
const Note = require('lib/models/Note.js');

const shared = {};

shared.noteExists = async function(noteId) {
	const existingNote = await Note.load(noteId);
	return !!existingNote;
}

shared.saveNoteButton_press = async function(comp) {
	let note = Object.assign({}, comp.state.note);

	// Note has been deleted while user was modifying it. In that case, we
	// just save a new note by clearing the note ID.
	if (note.id && !(await shared.noteExists(note.id))) delete note.id;

	if (!note.parent_id) {
		let folder = await Folder.defaultFolder();
		if (!folder) return;
		note.parent_id = folder.id;
	}

	let isNew = !note.id;
	let titleWasAutoAssigned = false;

	if (isNew && !note.title) {
		note.title = Note.defaultTitle(note);
		titleWasAutoAssigned = true;
	}

	let options = {};
	if (!isNew) {
		options.fields = BaseModel.diffObjectsFields(comp.state.lastSavedNote, note);
	}

	const savedNote = ('fields' in options) && !options.fields.length ? Object.assign({}, note) : await Note.save(note, { userSideValidation: true });

	const stateNote = comp.state.note;
	// Re-assign any property that might have changed during saving (updated_time, etc.)
	note = Object.assign(note, savedNote);

	if (stateNote) {
		// But we preserve the current title and body because
		// the user might have changed them between the time
		// saveNoteButton_press was called and the note was
		// saved (it's done asynchronously).
		//
		// If the title was auto-assigned above, we don't restore
		// it from the state because it will be empty there.
		if (!titleWasAutoAssigned) note.title = stateNote.title;
		note.body = stateNote.body;
	}

	comp.setState({
		lastSavedNote: Object.assign({}, note),
		note: note,
	});

	if (isNew) Note.updateGeolocation(note.id);
	comp.refreshNoteMetadata();
}

shared.saveOneProperty = async function(comp, name, value) {
	let note = Object.assign({}, comp.state.note);

	// Note has been deleted while user was modifying it. In that, we
	// just save a new note by clearing the note ID.
	if (note.id && !(await shared.noteExists(note.id))) delete note.id;

	// reg.logger().info('Saving note property: ', note.id, name, value);

	if (note.id) {
		let toSave = { id: note.id };
		toSave[name] = value;
		toSave = await Note.save(toSave);
		note[name] = toSave[name];

		comp.setState({
			lastSavedNote: Object.assign({}, note),
			note: note,
		});
	} else {
		note[name] = value;
		comp.setState({	note: note });
	}
}

shared.noteComponent_change = function(comp, propName, propValue) {
	let note = Object.assign({}, comp.state.note);
	note[propName] = propValue;
	comp.setState({ note: note });
}

shared.refreshNoteMetadata = async function(comp, force = null) {
	if (force !== true && !comp.state.showNoteMetadata) return;

	let noteMetadata = await Note.serializeAllProps(comp.state.note);
	comp.setState({ noteMetadata: noteMetadata });
}

shared.isModified = function(comp) {
	if (!comp.state.note || !comp.state.lastSavedNote) return false;
	let diff = BaseModel.diffObjects(comp.state.note, comp.state.lastSavedNote);
	delete diff.type_;
	return !!Object.getOwnPropertyNames(diff).length;
}

shared.initState = async function(comp) {
	let note = null;
	let mode = 'view';
	if (!comp.props.noteId) {
		note = comp.props.itemType == 'todo' ? Note.newTodo(comp.props.folderId) : Note.new(comp.props.folderId);
		mode = 'edit';
	} else {
		note = await Note.load(comp.props.noteId);
	}

	const folder = Folder.byId(comp.props.folders, note.parent_id);

	comp.setState({
		lastSavedNote: Object.assign({}, note),
		note: note,
		mode: mode,
		folder: folder,
		isLoading: false,
	});

	comp.lastLoadedNoteId_ = note ? note.id : null;
}

shared.showMetadata_onPress = function(comp) {
	comp.setState({ showNoteMetadata: !comp.state.showNoteMetadata });
	comp.refreshNoteMetadata(true);
}

shared.toggleIsTodo_onPress = function(comp) {
	let newNote = Note.toggleIsTodo(comp.state.note);
	let newState = { note: newNote };
	comp.setState(newState);
}

module.exports = shared;