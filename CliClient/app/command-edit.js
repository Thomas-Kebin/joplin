const fs = require('fs-extra');
const { BaseCommand } = require('./base-command.js');
const { uuid } = require('lib/uuid.js');
const { app } = require('./app.js');
const { _ } = require('lib/locale.js');
const { Folder } = require('lib/models/folder.js');
const { Note } = require('lib/models/note.js');
const { Setting } = require('lib/models/setting.js');
const { BaseModel } = require('lib/base-model.js');
const { cliUtils } = require('./cli-utils.js');
const { time } = require('lib/time-utils.js');

class Command extends BaseCommand {

	usage() {
		return 'edit <note>';
	}

	description() {
		return _('Edit note.');
	}

	async action(args) {
		let watcher = null;
		let tempFilePath = null;

		const onFinishedEditing = async () => {
			if (tempFilePath) fs.removeSync(tempFilePath);
		}

		const textEditorPath = () => {
			if (Setting.value('editor')) return Setting.value('editor');
			if (process.env.EDITOR) return process.env.EDITOR;
			throw new Error(_('No text editor is defined. Please set it using `config editor <editor-path>`'));
		}

		try {		
			// -------------------------------------------------------------------------
			// Load note or create it if it doesn't exist
			// -------------------------------------------------------------------------

			let title = args['note'];

			if (!app().currentFolder()) throw new Error(_('No active notebook.'));
			let note = await app().loadItem(BaseModel.TYPE_NOTE, title);

			if (!note) {
				const ok = await this.prompt(_('Note does not exist: "%s". Create it?', title));
				if (!ok) return;
				note = await Note.save({ title: title, parent_id: app().currentFolder().id });
				note = await Note.load(note.id);
			}

			// -------------------------------------------------------------------------
			// Create the file to be edited and prepare the editor program arguments
			// -------------------------------------------------------------------------

			let editorPath = textEditorPath();
			let editorArgs = editorPath.split(' ');

			editorPath = editorArgs[0];
			editorArgs = editorArgs.splice(1);

			const originalContent = await Note.serializeForEdit(note);

			tempFilePath = Setting.value('tempDir') + '/' + uuid.create() + '.md';
			editorArgs.push(tempFilePath);

			await fs.writeFile(tempFilePath, originalContent);

			// -------------------------------------------------------------------------
			// Start editing the file
			// -------------------------------------------------------------------------

			this.logger().info('Disabling fullscreen...');

			app().gui().showModalOverlay(_('Starting to edit note. Close the editor to get back to the prompt.'));
			await app().gui().forceRender();
			const termState = app().gui().term().saveState();

			const spawnSync	= require('child_process').spawnSync;
			spawnSync(editorPath, editorArgs, { stdio: 'inherit' });

			app().gui().term().restoreState(termState);
			app().gui().hideModalOverlay();
			app().gui().forceRender();

			// -------------------------------------------------------------------------
			// Save the note and clean up
			// -------------------------------------------------------------------------

			const updatedContent = await fs.readFile(tempFilePath, 'utf8');
			if (updatedContent !== originalContent) {
				let updatedNote = await Note.unserializeForEdit(updatedContent);
				updatedNote.id = note.id;
				await Note.save(updatedNote);
				this.stdout(_('Note has been saved.'));
			}

			this.dispatch({
				type: 'NOTES_SELECT',
				noteId: note.id,
			});

			await onFinishedEditing();

		} catch(error) {
			await onFinishedEditing();
			throw error;
		}
	}

}

module.exports = Command;