import { BaseCommand } from './base-command.js';
import { app } from './app.js';
import { _ } from 'lib/locale.js';
import { BaseModel } from 'lib/base-model.js';
import { Folder } from 'lib/models/folder.js';
import { Note } from 'lib/models/note.js';

class Command extends BaseCommand {

	usage() {
		return 'ren <item> <name>';
	}

	description() {
		return _('Renames the given <item> (note or notebook) to <name>.');
	}

	async action(args) {
		const pattern = args['item'];
		const name = args['name'];

		const item = await app().loadItem('folderOrNote', pattern);
		if (!item) throw new Error(_('Cannot find "%s".', pattern));

		const newItem = {
			id: item.id,
			title: name,
			type_: item.type_,
		};

		if (item.type_ === BaseModel.TYPE_FOLDER) {
			await Folder.save(newItem);
		} else {
			await Note.save(newItem);
		}


		
		// const folder = await Folder.loadByField('title', destination);
		// if (!folder) throw new Error(_('Cannot find "%s".', destination));

		// const notes = await app().loadItems(BaseModel.TYPE_NOTE, pattern);
		// if (!notes.length) throw new Error(_('Cannot find "%s".', pattern));

		// for (let i = 0; i < notes.length; i++) {
		// 	await Note.moveToFolder(notes[i].id, folder.id);
		// }
	}

}

module.exports = Command;