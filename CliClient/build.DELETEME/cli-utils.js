const yargParser = require('yargs-parser');
const { _ } = require('lib/locale.js');
const { time } = require('lib/time-utils.js');
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

cliUtils.promptMcq = function(message, answers) {
	const readline = require('readline');

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	message += "\n\n";
	for (let n in answers) {
		if (!answers.hasOwnProperty(n)) continue;
		message += _('%s: %s', n, answers[n]) + "\n";
	}

	message += "\n";
	message += _('Your choice: ');

	return new Promise((resolve, reject) => {
		rl.question(message, (answer) => {
			rl.close();

			if (!(answer in answers)) {
				reject(new Error(_('Invalid answer: %s', answer)));
				return;
			}

			resolve(answer);
		});
	});
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

// Note: initialText is there to have the same signature as statusBar.prompt() so that
// it can be a drop-in replacement, however initialText is not used (and cannot be
// with readline.question?).
cliUtils.prompt = function(initialText = '', promptString = ':', options = null) {
	if (!options) options = {};

	const readline = require('readline');
	const Writable = require('stream').Writable;

	const mutableStdout = new Writable({
		write: function(chunk, encoding, callback) {
			if (!this.muted)
			process.stdout.write(chunk, encoding);
			callback();
		}
	});

	const rl = readline.createInterface({
		input: process.stdin,
		output: mutableStdout,
		terminal: true,
	});

	return new Promise((resolve, reject) => {
		mutableStdout.muted = false;

		rl.question(promptString, (answer) => {
			rl.close();
			if (!!options.secure) this.stdout_('');
			resolve(answer);
		});

		mutableStdout.muted = !!options.secure;
	});
}

let redrawStarted_ = false;
let redrawLastLog_ = null;
let redrawLastUpdateTime_ = 0;

cliUtils.setStdout = function(v) {
	this.stdout_ = v;
}

cliUtils.redraw = function(s) {
	const now = time.unixMs();

	if (now - redrawLastUpdateTime_ > 4000) {
		this.stdout_(s);
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
		this.stdout_(redrawLastLog_);
	}

	redrawLastLog_ = null;
	redrawStarted_ = false;
}

module.exports = { cliUtils };