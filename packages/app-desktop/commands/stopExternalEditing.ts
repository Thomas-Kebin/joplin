import { CommandRuntime, CommandDeclaration, CommandContext } from '@joplinapp/lib/services/CommandService';
import { _ } from '@joplinapp/lib/locale';
import { stateUtils } from '@joplinapp/lib/reducer';
const ExternalEditWatcher = require('@joplinapp/lib/services/ExternalEditWatcher');

export const declaration:CommandDeclaration = {
	name: 'stopExternalEditing',
	label: () => _('Stop external editing'),
	iconName: 'fa-stop',
};

export const runtime = ():CommandRuntime => {
	return {
		execute: async (context:CommandContext, noteId:string = null) => {
			noteId = noteId || stateUtils.selectedNoteId(context.state);
			ExternalEditWatcher.instance().stopWatching(noteId);
		},
		enabledCondition: 'oneNoteSelected',
	};
};
