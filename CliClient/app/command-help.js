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

	allCommands() {
		const commands = app().commands();
		let output = [];
		for (let n in commands) {
			if (!commands.hasOwnProperty(n)) continue;
			const command = commands[n];
			if (command.hidden()) continue;
			if (!command.enabled()) continue;
			output.push(command);
		}

		output.sort((a, b) => a.name() < b.name() ? -1 : +1);

		return output;
	}

	async action(args) {
		const stdoutWidth = app().commandStdoutMaxWidth();

		if (args.command === 'shortcuts') {
			if (app().gui().isDummy()) {
				throw new Error(_('Shortcuts are not available in CLI mode.'));
			}

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
		} else if (args.command === 'all') {
			const commands = this.allCommands();
			const output = commands.map((c) => renderCommandHelp(c));
			this.stdout(output.join('\n\n'));
		} else if (args.command) {
			const command = app().findCommandByName(args['command']);
			if (!command) throw new Error(_('Cannot find "%s".', args.command));
			this.stdout(renderCommandHelp(command, stdoutWidth));
		} else {
			const commandNames = this.allCommands().map((a) => a.name());

			this.stdout(_('Type `help [command]` for more information about a command.'));
			this.stdout('');
			this.stdout(_('The possible commands are:'));
			this.stdout('');
			this.stdout(commandNames.join(', '));
			this.stdout('');
			this.stdout(_('In any command, a note or notebook can be refered to by title or ID, or using the shortcuts `$n` or `$b` for, respectively, the currently selected note or notebook. `$c` can be used to refer to the currently selected item.'));
			this.stdout('');
			this.stdout(_('To move from one widget to another, press Tab or Shift+Tab.'));
			this.stdout(_('Use the arrows and page up/down to scroll the lists and text areas (including this console).'));
			this.stdout(_('To maximise/minimise the console, press "C".'));
			this.stdout(_('To enter command line mode, press ":"'));
			this.stdout(_('To exit command line mode, press ESCAPE'));
			this.stdout(_('For the complete list of available keyboard shortcuts, type `help shortcuts`'));
		}

		app().gui().showConsole();
		app().gui().maximizeConsole();
	}

}

module.exports = Command;