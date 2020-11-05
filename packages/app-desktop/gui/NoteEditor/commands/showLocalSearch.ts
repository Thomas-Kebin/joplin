import { CommandRuntime, CommandDeclaration } from '@joplinapp/lib/services/CommandService';
import { _ } from '@joplinapp/lib/locale';

export const declaration:CommandDeclaration = {
	name: 'showLocalSearch',
	label: () => _('Search in current note'),
};

export const runtime = (comp:any):CommandRuntime => {
	return {
		execute: async () => {
			if (comp.editorRef.current && comp.editorRef.current.supportsCommand('search')) {
				comp.editorRef.current.execCommand({ name: 'search' });
			} else {
				comp.setShowLocalSearch(true);
				if (comp.noteSearchBarRef.current) comp.noteSearchBarRef.current.wrappedInstance.focus();
			}
		},
		enabledCondition: 'oneNoteSelected',
	};
};
