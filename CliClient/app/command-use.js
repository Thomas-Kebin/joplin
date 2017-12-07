const { BaseCommand } = require('./base-command.js');
const { app } = require('./app.js');
const { _ } = require('lib/locale.js');
const { BaseModel } = require('lib/base-model.js');
const { Folder } = require('lib/models/folder.js');

class Command extends BaseCommand {

	usage() {
		return 'use <notebook>';
	}

	description() {
		return _('Switches to [notebook] - all further operations will happen within this notebook.');
	}

	autocomplete() {
		return { data: autocompleteFolders };
	}

	compatibleUis() {
		return ['cli'];
	}

	async action(args) {
		let folder = await app().loadItem(BaseModel.TYPE_FOLDER, args['notebook']);
		if (!folder) throw new Error(_('Cannot find "%s".', args['notebook']));
		app().switchCurrentFolder(folder);
	}

}

module.exports = Command;