import { CommandRuntime, CommandDeclaration, CommandContext } from '@joplinapp/lib/services/CommandService';
import { _ } from '@joplinapp/lib/locale';
import { stateUtils } from '@joplinapp/lib/reducer';
const Note = require('@joplinapp/lib/models/Note');

export const declaration:CommandDeclaration = {
	name: 'showNoteContentProperties',
	label: () => _('Statistics...'),
};

export const runtime = (comp:any):CommandRuntime => {
	return {
		execute: async (context:CommandContext, noteId:string = null) => {
			noteId = noteId || stateUtils.selectedNoteId(context.state);

			const note = await Note.load(noteId);
			if (note) {
				comp.setState({
					noteContentPropertiesDialogOptions: {
						visible: true,
						text: note.body,
						markupLanguage: note.markup_language,
					},
				});
			}
		},

		enabledCondition: 'oneNoteSelected',
	};
};
