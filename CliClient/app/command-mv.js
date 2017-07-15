import { BaseCommand } from './base-command.js';
import { app } from './app.js';
import { _ } from 'lib/locale.js';
import { BaseModel } from 'lib/base-model.js';
import { Folder } from 'lib/models/folder.js';
import { Note } from 'lib/models/note.js';
import { autocompleteItems } from './autocomplete.js';

class Command extends BaseCommand {

	usage() {
		return 'mv <pattern> <notebook>';
	}

	description() {
		return 'Moves the notes matching <pattern> to <notebook>.';
	}

	autocomplete() {
		return { data: autocompleteItems };
	}

	async action(args) {
		const pattern = args['pattern'];

		const folder = await Folder.loadByField('title', args['notebook']);
		if (!folder) throw new Error(_('No notebook "%s"', args['notebook']));

		const notes = await app().loadItems(BaseModel.TYPE_NOTE, pattern);
		if (!notes.length) throw new Error(_('No note matches this pattern: "%s"', pattern));

		for (let i = 0; i < notes.length; i++) {
			await Note.moveToFolder(notes[i].id, folder.id);
		}
	}

}

module.exports = Command;