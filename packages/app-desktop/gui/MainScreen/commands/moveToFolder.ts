import { CommandRuntime, CommandDeclaration, CommandContext } from '@joplinapp/lib/services/CommandService';
import { _ } from '@joplinapp/lib/locale';
const Folder = require('@joplinapp/lib/models/Folder');
const Note = require('@joplinapp/lib/models/Note');

export const declaration:CommandDeclaration = {
	name: 'moveToFolder',
	label: () => _('Move to notebook'),
};

export const runtime = (comp:any):CommandRuntime => {
	return {
		execute: async (context:CommandContext, noteIds:string[] = null) => {
			noteIds = noteIds || context.state.selectedNoteIds;

			const folders:any[] = await Folder.sortFolderTree();
			const startFolders:any[] = [];
			const maxDepth = 15;

			const addOptions = (folders:any[], depth:number) => {
				for (let i = 0; i < folders.length; i++) {
					const folder = folders[i];
					startFolders.push({ key: folder.id, value: folder.id, label: folder.title, indentDepth: depth });
					if (folder.children) addOptions(folder.children, (depth + 1) < maxDepth ? depth + 1 : maxDepth);
				}
			};

			addOptions(folders, 0);

			comp.setState({
				promptOptions: {
					label: _('Move to notebook:'),
					inputType: 'dropdown',
					value: '',
					autocomplete: startFolders,
					onClose: async (answer:any) => {
						if (answer != null) {
							for (let i = 0; i < noteIds.length; i++) {
								await Note.moveToFolder(noteIds[i], answer.value);
							}
						}
						comp.setState({ promptOptions: null });
					},
				},
			});
		},
		enabledCondition: 'someNotesSelected',
	};
};
