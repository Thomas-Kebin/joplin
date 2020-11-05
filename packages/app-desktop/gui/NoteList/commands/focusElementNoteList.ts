import { CommandRuntime, CommandDeclaration, CommandContext } from '@joplinapp/lib/services/CommandService';
import { _ } from '@joplinapp/lib/locale';
import { stateUtils } from '@joplinapp/lib/reducer';

export const declaration:CommandDeclaration = {
	name: 'focusElementNoteList',
	label: () => _('Note list'),
	parentLabel: () => _('Focus'),
};

export const runtime = (comp:any):CommandRuntime => {
	return {
		execute: async (context:CommandContext, noteId:string = null) => {
			noteId = noteId || stateUtils.selectedNoteId(context.state);

			if (noteId) {
				const ref = comp.itemAnchorRef(noteId);
				if (ref) ref.focus();
			}
		},
		enabledCondition: 'noteListHasNotes',
	};
};
