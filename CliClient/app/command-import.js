const { BaseCommand } = require('./base-command.js');
const InteropService = require('lib/services/InteropService.js');
const BaseModel = require('lib/BaseModel.js');
const Note = require('lib/models/Note.js');
const { reg } = require('lib/registry.js');
const { app } = require('./app.js');
const { _ } = require('lib/locale.js');
const fs = require('fs-extra');

class Command extends BaseCommand {

	usage() {
		return 'import <path>';
	}

	description() {
		return _('Imports data into Joplin.');
	}

	options() {
		return [
			//['--format <format>', 'jex, markdown'],
		];
	}
	
	async action(args) {
		const importOptions = {};
		importOptions.path = args.path;
		importOptions.format = args.options.format ? args.options.format : 'jex';

		const service = new InteropService();
		const result = await service.import(importOptions);

		result.warnings.map((w) => this.stdout(w));
	}

}

module.exports = Command;