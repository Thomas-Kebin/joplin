const { BaseApplication } = require('lib/BaseApplication');
const { createStore, applyMiddleware } = require('redux');
const { reducer, defaultState } = require('lib/reducer.js');
const { JoplinDatabase } = require('lib/joplin-database.js');
const { Database } = require('lib/database.js');
const { FoldersScreenUtils } = require('lib/folders-screen-utils.js');
const { DatabaseDriverNode } = require('lib/database-driver-node.js');
const { BaseModel } = require('lib/base-model.js');
const { Folder } = require('lib/models/folder.js');
const { BaseItem } = require('lib/models/base-item.js');
const { Note } = require('lib/models/note.js');
const { Tag } = require('lib/models/tag.js');
const { Setting } = require('lib/models/setting.js');
const { Logger } = require('lib/logger.js');
const { sprintf } = require('sprintf-js');
const { reg } = require('lib/registry.js');
const { fileExtension } = require('lib/path-utils.js');
const { shim } = require('lib/shim.js');
const { _, setLocale, defaultLocale, closestSupportedLocale } = require('lib/locale.js');
const os = require('os');
const fs = require('fs-extra');
const { cliUtils } = require('./cli-utils.js');
const EventEmitter = require('events');

class Application extends BaseApplication {

	constructor() {
		super();

		this.showPromptString_ = true;
		this.commands_ = {};
		this.commandMetadata_ = null;
		this.activeCommand_ = null;
		this.allCommandsLoaded_ = false;
		this.showStackTraces_ = false;
		this.gui_ = null;
	}

	gui() {
		return this.gui_;
	}

	commandStdoutMaxWidth() {
		return this.gui().stdoutMaxWidth();
	}

	async guessTypeAndLoadItem(pattern, options = null) {
		let type = BaseModel.TYPE_NOTE;
		if (pattern.indexOf('/') === 0) {
			type = BaseModel.TYPE_FOLDER;
			pattern = pattern.substr(1);
		}
		return this.loadItem(type, pattern, options);
	}

	async loadItem(type, pattern, options = null) {
		let output = await this.loadItems(type, pattern, options);

		if (output.length > 1) {
			// output.sort((a, b) => { return a.user_updated_time < b.user_updated_time ? +1 : -1; });

			// let answers = { 0: _('[Cancel]') };
			// for (let i = 0; i < output.length; i++) {
			// 	answers[i + 1] = output[i].title;
			// }

			// Not really useful with new UI?
			throw new Error(_('More than one item match "%s". Please narrow down your query.', pattern));

			// let msg = _('More than one item match "%s". Please select one:', pattern);
			// const response = await cliUtils.promptMcq(msg, answers);
			// if (!response) return null;

			return output[response - 1];
		} else {
			return output.length ? output[0] : null;
		}
	}

	async loadItems(type, pattern, options = null) {
		if (type === 'folderOrNote') {
			const folders = await this.loadItems(BaseModel.TYPE_FOLDER, pattern, options);
			if (folders.length) return folders;
			return await this.loadItems(BaseModel.TYPE_NOTE, pattern, options);
		}

		pattern = pattern ? pattern.toString() : '';

		if (type == BaseModel.TYPE_FOLDER && (pattern == Folder.conflictFolderTitle() || pattern == Folder.conflictFolderId())) return [Folder.conflictFolder()];

		if (!options) options = {};

		const parent = options.parent ? options.parent : app().currentFolder();
		const ItemClass = BaseItem.itemClass(type);

		if (type == BaseModel.TYPE_NOTE && pattern.indexOf('*') >= 0) { // Handle it as pattern
			if (!parent) throw new Error(_('No notebook selected.'));
			return await Note.previews(parent.id, { titlePattern: pattern });
		} else { // Single item
			let item = null;
			if (type == BaseModel.TYPE_NOTE) {
				if (!parent) throw new Error(_('No notebook has been specified.'));
				item = await ItemClass.loadFolderNoteByField(parent.id, 'title', pattern);
			} else {
				item = await ItemClass.loadByTitle(pattern);
			}
			if (item) return [item];

			item = await ItemClass.load(pattern); // Load by id
			if (item) return [item];

			if (pattern.length >= 2) {
				return await ItemClass.loadByPartialId(pattern);
			}
		}

		return [];
	}

	stdout(text) {
		return this.gui().stdout(text);
	}

	setupCommand(cmd) {
		cmd.setStdout((text) => {
			return this.stdout(text);
		});

		cmd.setDispatcher((action) => {
			if (this.store()) {
				return this.store().dispatch(action);
			} else {
				return (action) => {};
			}
		});

		cmd.setPrompt(async (message, options) => {
			if (!options) options = {};
			if (!options.type) options.type = 'boolean';
			if (!options.booleanAnswerDefault) options.booleanAnswerDefault = 'y';
			if (!options.answers) options.answers = options.booleanAnswerDefault === 'y' ? [_('Y'), _('n')] : [_('N'), _('y')];

			if (options.type == 'boolean') {
				message += ' (' + options.answers.join('/') + ')';
			}

			let answer = await this.gui().prompt('', message + ' ');

			if (options.type === 'boolean') {
				if (answer === null) return false; // Pressed ESCAPE
				if (!answer) answer = options.answers[0];
				let positiveIndex = options.booleanAnswerDefault == 'y' ? 0 : 1;
				return answer.toLowerCase() === options.answers[positiveIndex].toLowerCase();
			}
		});

		return cmd;
	}

	async exit(code = 0) {
		const doExit = async () => {
			this.gui().exit();
			await super.exit(code);
		};

		// Give it a few seconds to cancel otherwise exit anyway
		setTimeout(async () => {
			await doExit();
		}, 5000);

		if (await reg.syncStarted()) {
			this.stdout(_('Cancelling background synchronisation... Please wait.'));
			const sync = await reg.synchronizer(Setting.value('sync.target'));
			await sync.cancel();
		}

		await doExit();
	}

	commands() {
		if (this.allCommandsLoaded_) return this.commands_;

		fs.readdirSync(__dirname).forEach((path) => {
			if (path.indexOf('command-') !== 0) return;
			const ext = fileExtension(path)
			if (ext != 'js') return;

			let CommandClass = require('./' + path);
			let cmd = new CommandClass();
			if (!cmd.enabled()) return;
			cmd = this.setupCommand(cmd);
			this.commands_[cmd.name()] = cmd;
		});

		this.allCommandsLoaded_ = true;

		return this.commands_;
	}

	async commandNames() {
		const metadata = await this.commandMetadata();
		let output = [];
		for (let n in metadata) {
			if (!metadata.hasOwnProperty(n)) continue;
			output.push(n);
		}
		return output;
	}

	async commandMetadata() {
		if (this.commandMetadata_) return this.commandMetadata_;

		const osTmpdir = require('os-tmpdir');
		const storage = require('node-persist');
		await storage.init({ dir: osTmpdir() + '/commandMetadata', ttl: 1000 * 60 * 60 * 24 });

		let output = await storage.getItem('metadata');
		if (Setting.value('env') != 'dev' && output) {
			this.commandMetadata_ = output;
			return Object.assign({}, this.commandMetadata_);
		}

		const commands = this.commands();

		output = {};
		for (let n in commands) {
			if (!commands.hasOwnProperty(n)) continue;
			const cmd = commands[n];
			output[n] = cmd.metadata();
		}

		await storage.setItem('metadata', output);

		this.commandMetadata_ = output;
		return Object.assign({}, this.commandMetadata_);
	}

	findCommandByName(name) {
		if (this.commands_[name]) return this.commands_[name];

		let CommandClass = null;
		try {
			CommandClass = require(__dirname + '/command-' + name + '.js');
		} catch (error) {
			let e = new Error('No such command: ' + name);
			e.type = 'notFound';
			throw e;
		}

		let cmd = new CommandClass();
		cmd = this.setupCommand(cmd);
		this.commands_[name] = cmd;
		return this.commands_[name];
	}

	dummyGui() {
		return {
			isDummy: () => { return true; },
			prompt: (initialText = '', promptString = '') => { return cliUtils.prompt(initialText, promptString); },
			showConsole: () => {},
			maximizeConsole: () => {},
			stdout: (text) => { console.info(text); },
			fullScreen: (b=true) => {},
			exit: () => {},
			showModalOverlay: (text) => {},
			hideModalOverlay: () => {},
			stdoutMaxWidth: () => { return 78; }
		};
	}

	async execCommand(argv) {
		if (!argv.length) return this.execCommand(['help']);
		reg.logger().info('execCommand()', argv);
		const commandName = argv[0];
		this.activeCommand_ = this.findCommandByName(commandName);

		let outException = null;
		try {
			if (this.gui().isDummy() && !this.activeCommand_.supportsUi('cli')) throw new Error(_('The command "%s" is only available in GUI mode', this.activeCommand_.name()));			
			const cmdArgs = cliUtils.makeCommandArgs(this.activeCommand_, argv);
			await this.activeCommand_.action(cmdArgs);
		} catch (error) {
			outException = error;
		}
		this.activeCommand_ = null;
		if (outException) throw outException;
	}

	currentCommand() {
		return this.activeCommand_;
	}

	async start(argv) {
		argv = await super.start(argv);

		cliUtils.setStdout((object) => {
			return this.stdout(object);
		});

		// If we have some arguments left at this point, it's a command
		// so execute it.
		if (argv.length) {
			this.gui_ = this.dummyGui();

			try {
				await this.execCommand(argv);
			} catch (error) {
				if (this.showStackTraces_) {
					console.info(error);
				} else {
					console.info(error.message);
				}
			}
		} else { // Otherwise open the GUI
			this.initRedux();

			const AppGui = require('./app-gui.js');
			this.gui_ = new AppGui(this, this.store());
			this.gui_.setLogger(this.logger_);
			await this.gui_.start();

			// Since the settings need to be loaded before the store is created, it will never
			// receive the SETTINGS_UPDATE_ALL even, which mean state.settings will not be
			// initialised. So we manually call dispatchUpdateAll() to force an update.
			Setting.dispatchUpdateAll();

			await FoldersScreenUtils.refreshFolders();

			const tags = await Tag.allWithNotes();

			this.dispatch({
				type: 'TAGS_UPDATE_ALL',
				tags: tags,
			});

			this.store().dispatch({
				type: 'FOLDERS_SELECT',
				id: Setting.value('activeFolderId'),
			});
		}
	}

}

let application_ = null;

function app() {
	if (application_) return application_;
	application_ = new Application();
	return application_;
}

module.exports = { app };