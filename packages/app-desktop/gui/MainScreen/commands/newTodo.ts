import CommandService, { CommandContext, CommandDeclaration, CommandRuntime } from '@joplin/lib/services/CommandService';
import { _ } from '@joplin/lib/locale';

export const declaration: CommandDeclaration = {
	name: 'newTodo',
	label: () => _('New to-do'),
	iconName: 'fa-check-square',
};

export const runtime = (): CommandRuntime => {
	return {
		execute: async (_context: CommandContext, body: string = '') => {
			return CommandService.instance().execute('newNote', body, true);
		},
		enabledCondition: 'oneFolderSelected && !inConflictFolder',
	};
};
