import Setting from '@joplin/lib/models/Setting';
import PluginService from '@joplin/lib/services/plugins/PluginService';
const { waitForFolderCount, newPluginService, newPluginScript, setupDatabaseAndSynchronizer, switchClient, afterEachCleanUp } = require('../../../test-utils');
const Folder = require('@joplin/lib/models/Folder');

describe('JoplinSettings', () => {

	beforeEach(async (done) => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
		done();
	});

	afterEach(async () => {
		await afterEachCleanUp();
	});

	test('should listen to setting change event', async () => {
		const service = new newPluginService() as PluginService;

		const pluginScript = newPluginScript(`			
			joplin.plugins.register({
				onStart: async function() {
					await joplin.settings.registerSetting('myCustomSetting1', {
						value: 1,
						type: 1,
						public: true,
						label: 'My Custom Setting 1',
					});

					await joplin.settings.registerSetting('myCustomSetting2', {
						value: 2,
						type: 1,
						public: true,
						label: 'My Custom Setting 2',
					});

					joplin.settings.onChange((event) => {
						joplin.data.post(['folders'], null, { title: JSON.stringify(event.keys) });
					});
				},
			});
		`);

		const plugin = await service.loadPluginFromJsBundle('', pluginScript);
		await service.runPlugin(plugin);

		Setting.setValue('plugin-org.joplinapp.plugins.PluginTest.myCustomSetting1', 111);
		Setting.setValue('plugin-org.joplinapp.plugins.PluginTest.myCustomSetting2', 222);

		// Also change a global setting, to verify that the plugin doesn't get
		// notifications for non-plugin related events.
		Setting.setValue('locale', 'fr_FR');

		Setting.emitScheduledChangeEvent();

		await waitForFolderCount(1);

		const folder = (await Folder.all())[0];

		const settingNames: string[] = JSON.parse(folder.title);
		settingNames.sort();

		expect(settingNames.join(',')).toBe('myCustomSetting1,myCustomSetting2');

		await service.destroy();
	});

});
