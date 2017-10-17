import { BaseCommand } from './base-command.js';
import { app } from './app.js';
import { renderCommandHelp } from './help-utils.js';
import { Database } from 'lib/database.js';
import { Setting } from 'lib/models/setting.js';
import { wrap } from 'lib/string-utils.js';
import { _ } from 'lib/locale.js';
import { cliUtils } from './cli-utils.js';

class Command extends BaseCommand {

	usage() {
		return 'help [command]';
	}

	description() {
		return _('Displays usage information.');
	}

	async action(args) {
		const stdoutWidth = app().commandStdoutMaxWidth();

		if (args.command === 'shortcuts') {
			const shortcuts = app().gui().shortcuts();

			let rows = [];

			for (let n in shortcuts) {
				if (!shortcuts.hasOwnProperty(n)) continue;
				const shortcut = shortcuts[n];
				if (!shortcut.description) continue;
				n = shortcut.friendlyName ? shortcut.friendlyName : n;
				rows.push([n, shortcut.description]);
			}

			cliUtils.printArray(this.stdout.bind(this), rows);
		} else if (args.command) {
			const command = app().findCommandByName(args['command']);
			if (!command) throw new Error(_('Cannot find "%s".', args.command));
			this.stdout(renderCommandHelp(command, stdoutWidth));
		} else {
			const commands = app().commands();
			let commandNames = [];
			for (let n in commands) {
				if (!commands.hasOwnProperty(n)) continue;
				const command = commands[n];
				commandNames.push(command.name());
			}

			commandNames.sort();

			this.stdout(_('Type `help [command]` for more information about a command.'));
			this.stdout('');
			this.stdout(_('The possible commands are:'));
			this.stdout('');
			this.stdout(commandNames.join(', '));
			this.stdout('');
			this.stdout(_('To maximise/minimise the console, press "C".'));
			this.stdout(_('To enter command line mode, press ":"'));
			this.stdout(_('To exit command line mode, press ESCAPE'));
			this.stdout(_('To view a list of available shortcuts type `help shortcuts`'));
		}

		app().gui().showConsole();
		app().gui().maximizeConsole();
	}

}

module.exports = Command;