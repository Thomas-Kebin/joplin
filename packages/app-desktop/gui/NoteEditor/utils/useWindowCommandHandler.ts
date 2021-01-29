import { useEffect } from 'react';
import { FormNote, ScrollOptionTypes } from './types';
import CommandService, { CommandDeclaration, CommandRuntime, CommandContext } from '@joplin/lib/services/CommandService';
import time from '@joplin/lib/time';
import { reg } from '@joplin/lib/registry';

const commandsWithDependencies = [
	require('../commands/showLocalSearch'),
	require('../commands/focusElementNoteTitle'),
	require('../commands/focusElementNoteBody'),
];

interface HookDependencies {
	formNote: FormNote;
	setShowLocalSearch: Function;
	dispatch: Function;
	noteSearchBarRef: any;
	editorRef: any;
	titleInputRef: any;
	saveNoteAndWait: Function;
	setFormNote: Function;
	plugins: any;
}

function editorCommandRuntime(declaration: CommandDeclaration, editorRef: any, setFormNote: Function): CommandRuntime {
	return {
		execute: async (_context: CommandContext, ...args: any[]) => {
			if (!editorRef.current) {
				reg.logger().warn('Received command, but editor is gone', declaration.name);
				return;
			}

			if (!editorRef.current.execCommand) {
				reg.logger().warn('Received command, but editor cannot execute commands', declaration.name);
				return;
			}

			if (declaration.name === 'insertDateTime') {
				return editorRef.current.execCommand({
					name: 'insertText',
					value: time.formatMsToLocal(new Date().getTime()),
				});
			} else if (declaration.name === 'scrollToHash') {
				return editorRef.current.scrollTo({
					type: ScrollOptionTypes.Hash,
					value: args[0],
				});
			} else if (declaration.name === 'editor.setText') {
				setFormNote((prev: FormNote) => {
					return { ...prev, body: args[0] };
				});
			} else {
				return editorRef.current.execCommand({
					name: declaration.name,
					value: args[0],
				});
			}
		},
		enabledCondition: '!modalDialogVisible && markdownEditorPaneVisible && oneNoteSelected && noteIsMarkdown',
	};
}

export default function useWindowCommandHandler(dependencies: HookDependencies) {
	const { setShowLocalSearch, noteSearchBarRef, editorRef, titleInputRef, setFormNote, plugins } = dependencies;

	useEffect(() => {
		for (const declaration of CommandService.instance().editorCommandDeclarations()) {
			CommandService.instance().registerRuntime(declaration.name, editorCommandRuntime(declaration, editorRef, setFormNote));
		}

		const dependencies = {
			editorRef,
			setShowLocalSearch,
			noteSearchBarRef,
			titleInputRef,
		};

		for (const command of commandsWithDependencies) {
			CommandService.instance().registerRuntime(command.declaration.name, command.runtime(dependencies));
		}

		return () => {
			for (const declaration of CommandService.instance().editorCommandDeclarations()) {
				CommandService.instance().unregisterRuntime(declaration.name);
			}

			for (const command of commandsWithDependencies) {
				CommandService.instance().unregisterRuntime(command.declaration.name);
			}
		};
	}, [editorRef, setShowLocalSearch, noteSearchBarRef, titleInputRef, plugins]);
}
