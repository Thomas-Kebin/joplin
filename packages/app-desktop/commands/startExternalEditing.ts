import { CommandRuntime, CommandDeclaration, CommandContext } from '@joplin/lib/services/CommandService';
import { _ } from '@joplin/lib/locale';
import { stateUtils } from '@joplin/lib/reducer';
import ExternalEditWatcher from '@joplin/lib/services/ExternalEditWatcher';
const Note = require('@joplin/lib/models/Note');
const bridge = require('electron').remote.require('./bridge').default;

export const declaration: CommandDeclaration = {
	name: 'startExternalEditing',
	label: () => _('Edit in external editor'),
	iconName: 'icon-share',
};

export const runtime = (): CommandRuntime => {
	return {
		execute: async (context: CommandContext, noteId: string = null) => {
			noteId = noteId || stateUtils.selectedNoteId(context.state);

			try {
				const note = await Note.load(noteId);
				ExternalEditWatcher.instance().openAndWatch(note);
			} catch (error) {
				bridge().showErrorMessageBox(_('Error opening note in editor: %s', error.message));
			}
		},
		enabledCondition: 'oneNoteSelected',
	};
};
