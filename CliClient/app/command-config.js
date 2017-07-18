import { BaseCommand } from './base-command.js';
import { _, setLocale } from 'lib/locale.js';
import { app } from './app.js';
import { Setting } from 'lib/models/setting.js';

class Command extends BaseCommand {

	usage() {
		return 'config [name] [value]';
	}

	description() {
		return _('Gets or sets a config value. If [value] is not provided, it will show the value of [name]. If neither [name] nor [value] is provided, it will list the current configuration.');
	}

	async action(args) {
		if (!args.name && !args.value) {
			let keys = Setting.publicKeys();
			for (let i = 0; i < keys.length; i++) {
				this.log(keys[i] + ' = ' + Setting.value(keys[i]));
			}
			return;
		}

		if (args.name && !args.value) {
			this.log(args.name + ' = ' + Setting.value(args.name));
			return;
		}

		Setting.setValue(args.name, args.value);

		if (args.name == 'locale') {
			setLocale(Setting.value('locale'));
			app().onLocaleChanged();
		}

		await Setting.saveAll();
	}

}

module.exports = Command;