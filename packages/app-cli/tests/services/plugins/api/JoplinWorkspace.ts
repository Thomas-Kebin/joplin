import Setting from '@joplin/lib/models/Setting';
import PluginService from '@joplin/lib/services/plugins/PluginService';

const { newPluginService, newPluginScript, setupDatabaseAndSynchronizer, switchClient, afterEachCleanUp } = require('../../../test-utils');
import Note from '@joplin/lib/models/Note';
import Folder from '@joplin/lib/models/Folder';
import ItemChange from '@joplin/lib/models/ItemChange';

describe('JoplinWorkspace', () => {

	beforeEach(async (done) => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
		done();
	});

	afterEach(async () => {
		await afterEachCleanUp();
	});

	test('should listen to noteChange events', async () => {
		const service = new newPluginService() as PluginService;

		const pluginScript = newPluginScript(`			
			joplin.plugins.register({
				onStart: async function() {
					await joplin.workspace.onNoteChange(async (event) => {
						await joplin.data.post(['folders'], null, { title: JSON.stringify(event) });
					});
				},
			});
		`);

		const note = await Note.save({});
		await ItemChange.waitForAllSaved();

		const plugin = await service.loadPluginFromJsBundle('', pluginScript);
		await service.runPlugin(plugin);

		await Note.save({ id: note.id, body: 'testing' });
		await ItemChange.waitForAllSaved();

		const folder = (await Folder.all())[0];

		const result: any = JSON.parse(folder.title);

		expect(result.id).toBe(note.id);
		expect(result.event).toBe(ItemChange.TYPE_UPDATE);

		await service.destroy();
	});

	test('should return the selected folder', async () => {
		const service = new newPluginService() as PluginService;

		const pluginScript = newPluginScript(`			
			joplin.plugins.register({
				onStart: async function() {
					const folder = await joplin.workspace.selectedFolder();
					await joplin.data.put(['folders', folder.id], null, { title: "changedtitle" });
				},
			});
		`);

		const folder = await Folder.save({ title: 'folder' });
		Setting.setValue('activeFolderId', folder.id);

		const plugin = await service.loadPluginFromJsBundle('', pluginScript);
		await service.runPlugin(plugin);

		const modFolder = await Folder.load(folder.id);
		expect(modFolder.title).toBe('changedtitle');
	});

});
