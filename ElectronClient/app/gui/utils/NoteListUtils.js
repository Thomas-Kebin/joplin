const BaseModel = require('lib/BaseModel');
const { _ } = require('lib/locale.js');
const { bridge } = require('electron').remote.require('./bridge');
const Menu = bridge().Menu;
const MenuItem = bridge().MenuItem;
const eventManager = require('../../eventManager');
const InteropService = require('lib/services/InteropService');
const InteropServiceHelper = require('../../InteropServiceHelper.js');
const Note = require('lib/models/Note');
const { substrWithEllipsis } = require('lib/string-utils');

class NoteListUtils {
	static makeContextMenu(noteIds, props) {
		const notes = noteIds.map(id => BaseModel.byId(props.notes, id));

		let hasEncrypted = false;
		for (let i = 0; i < notes.length; i++) {
			if (notes[i].encryption_applied) hasEncrypted = true;
		}

		const menu = new Menu();

		if (!hasEncrypted) {
			menu.append(
				new MenuItem({
					label: _('Add or remove tags'),
					enabled: noteIds.length === 1,
					click: async () => {
						props.dispatch({
							type: 'WINDOW_COMMAND',
							name: 'setTags',
							noteId: noteIds[0],
						});
					},
				})
			);

			menu.append(
				new MenuItem({
					label: _('Duplicate'),
					click: async () => {
						for (let i = 0; i < noteIds.length; i++) {
							const note = await Note.load(noteIds[i]);
							await Note.duplicate(noteIds[i], {
								uniqueTitle: _('%s - Copy', note.title),
							});
						}
					},
				})
			);

			if (noteIds.length <= 1) {
				menu.append(
					new MenuItem({
						label: _('Switch between note and to-do type'),
						click: async () => {
							for (let i = 0; i < noteIds.length; i++) {
								const note = await Note.load(noteIds[i]);
								await Note.save(Note.toggleIsTodo(note), { userSideValidation: true });
								eventManager.emit('noteTypeToggle', { noteId: note.id });
							}
						},
					})
				);
			} else {
				const switchNoteType = async (noteIds, type) => {
					for (let i = 0; i < noteIds.length; i++) {
						const note = await Note.load(noteIds[i]);
						const newNote = Note.changeNoteType(note, type);
						if (newNote === note) continue;
						await Note.save(newNote, { userSideValidation: true });
						eventManager.emit('noteTypeToggle', { noteId: note.id });
					}
				};

				menu.append(
					new MenuItem({
						label: _('Switch to note type'),
						click: async () => {
							await switchNoteType(noteIds, 'note');
						},
					})
				);

				menu.append(
					new MenuItem({
						label: _('Switch to to-do type'),
						click: async () => {
							await switchNoteType(noteIds, 'todo');
						},
					})
				);
			}

			menu.append(
				new MenuItem({
					label: _('Copy Markdown link'),
					click: async () => {
						const { clipboard } = require('electron');
						const links = [];
						for (let i = 0; i < noteIds.length; i++) {
							const note = await Note.load(noteIds[i]);
							links.push(Note.markdownTag(note));
						}
						clipboard.writeText(links.join(' '));
					},
				})
			);

			const exportMenu = new Menu();

			const ioService = new InteropService();
			const ioModules = ioService.modules();
			for (let i = 0; i < ioModules.length; i++) {
				const module = ioModules[i];
				if (module.type !== 'exporter') continue;

				exportMenu.append(
					new MenuItem({
						label: module.fullLabel(),
						click: async () => {
							await InteropServiceHelper.export(props.dispatch.bind(this), module, { sourceNoteIds: noteIds });
						},
					})
				);
			}

			if (noteIds.length === 1) {
				exportMenu.append(
					new MenuItem({
						label: `PDF - ${_('PDF File')}`,
						click: () => {
							props.dispatch({
								type: 'WINDOW_COMMAND',
								name: 'exportPdf',
							});
						},
					})
				);
			}

			const exportMenuItem = new MenuItem({ label: _('Export'), submenu: exportMenu });

			menu.append(exportMenuItem);
		}

		menu.append(
			new MenuItem({
				label: _('Delete'),
				click: async () => {
					await this.confirmDeleteNotes(noteIds);
				},
			})
		);

		return menu;
	}

	static async confirmDeleteNotes(noteIds) {
		if (!noteIds.length) return;

		let msg = '';
		if (noteIds.length === 1) {
			const note = await Note.load(noteIds[0]);
			if (!note) return;
			msg = _('Delete note "%s"?', substrWithEllipsis(note.title, 0, 32));
		} else {
			msg = _('Delete these %d notes?', noteIds.length);
		}

		const ok = bridge().showConfirmMessageBox(msg, {
			buttons: [_('Delete'), _('Cancel')],
			defaultId: 1,
		});

		if (!ok) return;
		await Note.batchDelete(noteIds);
	}
}

module.exports = NoteListUtils;
