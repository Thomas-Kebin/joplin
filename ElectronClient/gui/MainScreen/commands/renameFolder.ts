import { CommandRuntime, CommandDeclaration, CommandContext } from 'lib/services/CommandService';
import { _ } from 'lib/locale';
const Folder = require('lib/models/Folder');
const bridge = require('electron').remote.require('./bridge').default;

export const declaration:CommandDeclaration = {
	name: 'renameFolder',
	label: () => _('Rename'),
};

export const runtime = (comp:any):CommandRuntime => {
	return {
		execute: async (context:CommandContext, folderId:string = null) => {
			folderId = folderId || context.state.selectedFolderId;

			const folder = await Folder.load(folderId);

			if (folder) {
				comp.setState({
					promptOptions: {
						label: _('Rename notebook:'),
						value: folder.title,
						onClose: async (answer:string) => {
							if (answer !== null) {
								try {
									folder.title = answer;
									await Folder.save(folder, { fields: ['title'], userSideValidation: true });
								} catch (error) {
									bridge().showErrorMessageBox(error.message);
								}
							}
							comp.setState({ promptOptions: null });
						},
					},
				});
			}
		},
	};
};
