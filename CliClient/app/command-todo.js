const { BaseCommand } = require('./base-command.js');
const { app } = require('./app.js');
const { _ } = require('lib/locale.js');
const { BaseModel } = require('lib/base-model.js');
const { Folder } = require('lib/models/folder.js');
const { Note } = require('lib/models/note.js');
const { time } = require('lib/time-utils.js');

class Command extends BaseCommand {

	usage() {
		return 'todo <todo-command> <note-pattern>';
	}

	description() {
		return _('<todo-command> can either be "toggle" or "clear". Use "toggle" to toggle the given to-do between completed and uncompleted state (If the target is a regular note it will be converted to a to-do). Use "clear" to convert the to-do back to a regular note.');
	}

	async action(args) {
		const action = args['todo-command'];
		const pattern = args['note-pattern'];
		const notes = await app().loadItems(BaseModel.TYPE_NOTE, pattern);
		if (!notes.length) throw new Error(_('Cannot find "%s".', pattern));

		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];

			let toSave = {
				id: note.id,
			};

			if (action == 'toggle') {
				if (!note.is_todo) {
					toSave = Note.toggleIsTodo(note);
				} else {
					toSave.todo_completed = note.todo_completed ? 0 : time.unixMs();
				}
			} else if (action == 'clear') {
				toSave.is_todo = 0;
			}			

			await Note.save(toSave);
		}
	}

}

module.exports = Command;