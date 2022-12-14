const fs = require('fs-extra');
const execa = require('execa');

const utils = {};

utils.isLinux = () => {
	return process && process.platform === 'linux';
};

utils.isWindows = () => {
	return process && process.platform === 'win32';
};

utils.isMac = () => {
	return process && process.platform === 'darwin';
};

utils.execCommandVerbose = function(commandName, args = []) {
	console.info(`> ${commandName}`, args && args.length ? args : '');
	const promise = execa(commandName, args);
	promise.stdout.pipe(process.stdout);
	return promise;
};

utils.execCommand = function(command) {
	const exec = require('child_process').exec;

	return new Promise((resolve, reject) => {
		exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
			if (error) {

				// Special case for robocopy, which will return non-zero error codes
				// when sucessful. Doc is very imprecise but <= 7 seems more or less
				// fine and >= 8 seems more errorish. https://ss64.com/nt/robocopy-exit.html
				if (command.indexOf('robocopy') === 0 && error.code <= 7) {
					resolve(stdout.trim());
					return;
				}

				if (error.signal == 'SIGTERM') {
					resolve('Process was killed');
				} else {
					const newError = new Error(`Code: ${error.code}: ${error.message}: ${stdout.trim()}`);
					reject(newError);
				}
			} else {
				resolve(stdout.trim());
			}
		});
	});
};

utils.dirname = function(path) {
	if (!path) throw new Error('Path is empty');
	const s = path.split(/\/|\\/);
	s.pop();
	return s.join('/');
};

utils.basename = function(path) {
	if (!path) throw new Error('Path is empty');
	const s = path.split(/\/|\\/);
	return s[s.length - 1];
};

utils.filename = function(path, includeDir = false) {
	if (!path) throw new Error('Path is empty');
	let output = includeDir ? path : utils.basename(path);
	if (output.indexOf('.') < 0) return output;

	output = output.split('.');
	output.pop();
	return output.join('.');
};

utils.toSystemSlashes = function(path) {
	if (utils.isWindows()) return path.replace(/\//g, '\\');
	return path.replace(/\\/g, '/');
};

utils.fileExtension = function(path) {
	if (!path) throw new Error('Path is empty');

	const output = path.split('.');
	if (output.length <= 1) return '';
	return output[output.length - 1];
};

utils.replaceFileText = async function(filePath, regex, toInsert) {
	const content = await fs.readFile(filePath, 'utf8');
	const newContent = content.replace(regex, toInsert);
	if (newContent === content) return Promise.resolve();
	await fs.writeFile(filePath, newContent);
};

utils.copyDir = async function(src, dest, options) {
	options = Object.assign({}, {
		excluded: [],
		delete: true,
	}, options);

	src = utils.toSystemSlashes(src);
	dest = utils.toSystemSlashes(dest);

	await utils.mkdir(dest);

	if (utils.isWindows()) {
		let cmd = ['robocopy'];
		cmd.push(`"${src}"`);
		cmd.push(`"${dest}"`);
		cmd.push('/e');
		cmd.push('/r:0');
		if (options.delete) cmd.push('/purge');

		if (options.excluded.length) {
			cmd.push('/xd');
			cmd = cmd.concat(options.excluded.map(p => `"${utils.toSystemSlashes(p)}"`).join(' '));
		}

		await utils.execCommand(cmd.join(' '));
	} else {
		let excludedFlag = '';
		if (options.excluded.length) {
			excludedFlag = options.excluded.map(f => {
				return `--exclude "${f}"`;
			}).join(' ');
		}

		let deleteFlag = '';
		if (options.delete) deleteFlag = '--delete';

		await utils.execCommand(`rsync -a ${deleteFlag} ${excludedFlag} "${src}/" "${dest}/"`);
	}
};

utils.mkdir = async function(dir) {
	if (utils.isWindows()) {
		return utils.execCommand(`if not exist "${utils.toSystemSlashes(dir)}" mkdir "${utils.toSystemSlashes(dir)}"`);
	} else {
		return fs.mkdirp(dir);
	}
};

utils.copyFile = async function(src, dest) {
	await fs.copy(src, dest);
};

utils.rootDir = function() {
	return utils.dirname(utils.dirname(utils.dirname(__dirname)));
};

utils.registerGulpTasks = function(gulp, tasks) {
	for (const taskName in tasks) {
		gulp.task(taskName, tasks[taskName].fn);
	}
};

utils.setPackagePrivateField = async function(filePath, value) {
	const text = await fs.readFile(filePath, 'utf8');
	const obj = JSON.parse(text);
	if (!value) {
		delete obj.private;
	} else {
		obj.private = true;
	}
	await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8');
};

utils.insertContentIntoFile = async (filePath, marker, contentToInsert, createIfNotExist = false) => {
	const fs = require('fs-extra');
	const fileExists = await fs.pathExists(filePath);

	if (!fileExists) {
		if (!createIfNotExist) throw new Error(`File not found: ${filePath}`);
		await fs.writeFile(filePath, `${marker}\n${contentToInsert}\n${marker}`);
	} else {
		let content = await fs.readFile(filePath, 'utf-8');
		// [^]* matches any character including new lines
		const regex = new RegExp(`${marker}[^]*?${marker}`);
		content = content.replace(regex, `${marker}\n${contentToInsert}\n${marker}`);
		await fs.writeFile(filePath, content);
	}
};

utils.getFilename = (path) => {
	const lastPart = path.split('/').pop();
	if (lastPart.indexOf('.') < 0) return lastPart;

	const splitted = lastPart.split('.');
	splitted.pop();
	return splitted.join('.');
};

module.exports = utils;
