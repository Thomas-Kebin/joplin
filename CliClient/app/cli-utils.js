import yargParser from 'yargs-parser';
import { _ } from 'lib/locale.js';
import { time } from 'lib/time-utils.js';
const stringPadding = require('string-padding');

const cliUtils = {};

cliUtils.printArray = function(logFunction, rows, headers = null) {
	if (!rows.length) return '';

	const ALIGN_LEFT = 0;
	const ALIGN_RIGHT = 1;

	let colWidths = [];
	let colAligns = [];

	for (let i = 0; i < rows.length; i++) {
		let row = rows[i];
		
		for (let j = 0; j < row.length; j++) {
			let item = row[j];
			let width = item ? item.toString().length : 0;
			let align = typeof item == 'number' ? ALIGN_RIGHT : ALIGN_LEFT;
			if (!colWidths[j] || colWidths[j] < width) colWidths[j] = width;
			if (colAligns.length <= j) colAligns[j] = align;
		}
	}

	let lines = [];
	for (let row = 0; row < rows.length; row++) {
		let line = [];
		for (let col = 0; col < colWidths.length; col++) {
			let item = rows[row][col];
			let width = colWidths[col];
			let dir = colAligns[col] == ALIGN_LEFT ? stringPadding.RIGHT : stringPadding.LEFT;
			line.push(stringPadding(item, width, ' ', dir));
		}
		logFunction(line.join(' '));
	}
}

cliUtils.parseFlags = function(flags) {
	let output = {};
	flags = flags.split(',');
	for (let i = 0; i < flags.length; i++) {
		let f = flags[i].trim();

		if (f.substr(0, 2) == '--') {
			f = f.split(' ');
			output.long = f[0].substr(2).trim();
			if (f.length == 2) {
				output.arg = cliUtils.parseCommandArg(f[1].trim());
			}
		} else if (f.substr(0, 1) == '-') {
			output.short = f.substr(1);
		}
	}
	return output;
}

cliUtils.parseCommandArg = function(arg) {
	if (arg.length <= 2) throw new Error('Invalid command arg: ' + arg);

	const c1 = arg[0];
	const c2 = arg[arg.length - 1];
	const name = arg.substr(1, arg.length - 2);

	if (c1 == '<' && c2 == '>') {
		return { required: true, name: name };
	} else if (c1 == '[' && c2 == ']') {
		return { required: false, name: name };
	} else {
		throw new Error('Invalid command arg: ' + arg);
	}
}

cliUtils.makeCommandArgs = function(cmd, argv) {
	let cmdUsage = cmd.usage();
	cmdUsage = yargParser(cmdUsage);
	let output = {};

	let options = cmd.options();
	let booleanFlags = [];
	let aliases = {};
	for (let i = 0; i < options.length; i++) {
		if (options[i].length != 2) throw new Error('Invalid options: ' + options[i]);
		let flags = options[i][0];
		let text = options[i][1];

		flags = cliUtils.parseFlags(flags);

		if (!flags.arg) {
			booleanFlags.push(flags.short);
			if (flags.long) booleanFlags.push(flags.long);
		}

		if (flags.short && flags.long) {
			aliases[flags.long] = [flags.short];
		}
	}

	let args = yargParser(argv, {
		boolean: booleanFlags,
		alias: aliases,
		string: ['_'],
	});

	for (let i = 1; i < cmdUsage['_'].length; i++) {
		const a = cliUtils.parseCommandArg(cmdUsage['_'][i]);
		if (a.required && !args['_'][i]) throw new Error(_('Missing required argument: %s', a.name));
		if (i >= a.length) {
			output[a.name] = null;
		} else {
			output[a.name] = args['_'][i];
		}
	}

	let argOptions = {};
	for (let key in args) {
		if (!args.hasOwnProperty(key)) continue;
		if (key == '_') continue;
		argOptions[key] = args[key];
	}

	output.options = argOptions;

	return output;
}

cliUtils.promptConfirm = function(message, answers = null) {
	if (!answers) answers = [_('Y'), _('n')];
	const readline = require('readline');

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	message += ' (' + answers.join('/') + ')';

	return new Promise((resolve, reject) => {
		rl.question(message + ' ', (answer) => {
			const ok = !answer || answer.toLowerCase() == answers[0].toLowerCase();
			rl.close();
			resolve(ok);
		});
	});
}

cliUtils.promptInput = function(message) {
	const readline = require('readline');

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise((resolve, reject) => {
		rl.question(message + ' ', (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

let redrawStarted_ = false;
let redrawLastLog_ = null;
let redrawLastUpdateTime_ = 0;

cliUtils.redraw = function(s) {
	const now = time.unixMs();

	if (now - redrawLastUpdateTime_ > 4000) {
		console.info(s);
		redrawLastUpdateTime_ = now;
		redrawLastLog_ = null;
	} else {
		redrawLastLog_ = s;
	}

   redrawStarted_ = true;
}

cliUtils.redrawDone = function() {
	if (!redrawStarted_) return;

	if (redrawLastLog_) {
		console.info(redrawLastLog_);
	}

	redrawLastLog_ = null;
	redrawStarted_ = false;
}

export { cliUtils };