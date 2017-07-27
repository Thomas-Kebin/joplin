import { BaseCommand } from './base-command.js';
import { app } from './app.js';
import { _ } from 'lib/locale.js';
import { Folder } from 'lib/models/folder.js';
import { reg } from 'lib/registry.js';

class Command extends BaseCommand {

	usage() {
		return _('mkbook <notebook>');
	}

	description() {
		return _('Creates a new notebook.');
	}

	aliases() {
		return ['mkdir'];
	}

	async action(args) {
		let folder = await Folder.save({ title: args['notebook'] }, { userSideValidation: true });		
		app().switchCurrentFolder(folder);
	}

}

module.exports = Command;