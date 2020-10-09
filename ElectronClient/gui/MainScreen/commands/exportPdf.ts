import { CommandRuntime, CommandDeclaration } from '../../../lib/services/CommandService';
import shim from 'lib/shim';
import InteropServiceHelper from '../../../InteropServiceHelper';
import { _ } from 'lib/locale';
const Note = require('lib/models/Note');
const bridge = require('electron').remote.require('./bridge').default;

export const declaration:CommandDeclaration = {
	name: 'exportPdf',
	label: () => `PDF - ${_('PDF File')}`,
};

export const runtime = (comp:any):CommandRuntime => {
	return {
		execute: async ({ noteIds }:any) => {
			try {
				if (!noteIds.length) throw new Error('No notes selected for pdf export');

				let path = null;
				if (noteIds.length === 1) {
					path = bridge().showSaveDialog({
						filters: [{ name: _('PDF File'), extensions: ['pdf'] }],
						defaultPath: await InteropServiceHelper.defaultFilename(noteIds[0], 'pdf'),
					});

				} else {
					path = bridge().showOpenDialog({
						properties: ['openDirectory', 'createDirectory'],
					});
				}

				if (!path) return;

				for (let i = 0; i < noteIds.length; i++) {
					const note = await Note.load(noteIds[i]);

					let pdfPath = '';

					if (noteIds.length === 1) {
						pdfPath = path;
					} else {
						const n = await InteropServiceHelper.defaultFilename(note.id, 'pdf');
						pdfPath = await shim.fsDriver().findUniqueFilename(`${path}/${n}`);
					}

					await comp.printTo_('pdf', { path: pdfPath, noteId: note.id });
				}
			} catch (error) {
				console.error(error);
				bridge().showErrorMessageBox(error.message);
			}
		},
		isEnabled: (props:any):boolean => {
			return !!props.noteIds.length;
		},
		mapStateToProps: (state:any):any => {
			return {
				noteIds: state.selectedNoteIds,
			};
		},
	};
};
