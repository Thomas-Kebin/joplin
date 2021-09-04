import ResourceEditWatcher from '@joplin/lib/services/ResourceEditWatcher/index';
import CommandService from '@joplin/lib/services/CommandService';
import KeymapService from '@joplin/lib/services/KeymapService';
import PluginService, { PluginSettings } from '@joplin/lib/services/plugins/PluginService';
import resourceEditWatcherReducer, { defaultState as resourceEditWatcherDefaultState } from '@joplin/lib/services/ResourceEditWatcher/reducer';
import { State } from '@joplin/lib/reducer';
import PluginRunner from './services/plugins/PluginRunner';
import PlatformImplementation from './services/plugins/PlatformImplementation';
import shim from '@joplin/lib/shim';
import AlarmService from '@joplin/lib/services/AlarmService';
import AlarmServiceDriverNode from '@joplin/lib/services/AlarmServiceDriverNode';
import Logger, { TargetType } from '@joplin/lib/Logger';
import Setting from '@joplin/lib/models/Setting';
import actionApi from '@joplin/lib/services/rest/actionApi.desktop';
import BaseApplication from '@joplin/lib/BaseApplication';
import DebugService from '@joplin/lib/debug/DebugService';
import { _, setLocale } from '@joplin/lib/locale';
import SpellCheckerService from '@joplin/lib/services/spellChecker/SpellCheckerService';
import SpellCheckerServiceDriverNative from './services/spellChecker/SpellCheckerServiceDriverNative';
import bridge from './services/bridge';
import menuCommandNames from './gui/menuCommandNames';
import { LayoutItem } from './gui/ResizableLayout/utils/types';
import stateToWhenClauseContext from './services/commands/stateToWhenClauseContext';
import ResourceService from '@joplin/lib/services/ResourceService';
import ExternalEditWatcher from '@joplin/lib/services/ExternalEditWatcher';
import appReducer, { createAppDefaultState } from './app.reducer';
const { FoldersScreenUtils } = require('@joplin/lib/folders-screen-utils.js');
import Folder from '@joplin/lib/models/Folder';
const fs = require('fs-extra');
import Tag from '@joplin/lib/models/Tag';
import { reg } from '@joplin/lib/registry';
const packageInfo = require('./packageInfo.js');
import DecryptionWorker from '@joplin/lib/services/DecryptionWorker';
import ClipperServer from '@joplin/lib/ClipperServer';
const { webFrame } = require('electron');
const Menu = bridge().Menu;
const PluginManager = require('@joplin/lib/services/PluginManager');
import RevisionService from '@joplin/lib/services/RevisionService';
import MigrationService from '@joplin/lib/services/MigrationService';
import { loadCustomCss, injectCustomStyles } from '@joplin/lib/CssUtils';
// import  populateDatabase from '@joplin/lib/services/debug/populateDatabase';

const commands = [
	require('./gui/MainScreen/commands/editAlarm'),
	require('./gui/MainScreen/commands/exportPdf'),
	require('./gui/MainScreen/commands/gotoAnything'),
	require('./gui/MainScreen/commands/commandPalette'),
	require('./gui/MainScreen/commands/hideModalMessage'),
	require('./gui/MainScreen/commands/moveToFolder'),
	require('./gui/MainScreen/commands/newFolder'),
	require('./gui/MainScreen/commands/newNote'),
	require('./gui/MainScreen/commands/newSubFolder'),
	require('./gui/MainScreen/commands/newTodo'),
	require('./gui/MainScreen/commands/openFolder'),
	require('./gui/MainScreen/commands/openNote'),
	require('./gui/MainScreen/commands/openTag'),
	require('./gui/MainScreen/commands/print'),
	require('./gui/MainScreen/commands/renameFolder'),
	require('./gui/MainScreen/commands/renameTag'),
	require('./gui/MainScreen/commands/search'),
	require('./gui/MainScreen/commands/setTags'),
	require('./gui/MainScreen/commands/showModalMessage'),
	require('./gui/MainScreen/commands/showNoteContentProperties'),
	require('./gui/MainScreen/commands/showNoteProperties'),
	require('./gui/MainScreen/commands/showPrompt'),
	require('./gui/MainScreen/commands/showShareFolderDialog'),
	require('./gui/MainScreen/commands/showShareNoteDialog'),
	require('./gui/MainScreen/commands/showSpellCheckerMenu'),
	require('./gui/MainScreen/commands/toggleEditors'),
	require('./gui/MainScreen/commands/toggleLayoutMoveMode'),
	require('./gui/MainScreen/commands/toggleNoteList'),
	require('./gui/MainScreen/commands/toggleSideBar'),
	require('./gui/MainScreen/commands/toggleVisiblePanes'),
	require('./gui/NoteEditor/commands/focusElementNoteBody'),
	require('./gui/NoteEditor/commands/focusElementNoteTitle'),
	require('./gui/NoteEditor/commands/showLocalSearch'),
	require('./gui/NoteEditor/commands/showRevisions'),
	require('./gui/NoteList/commands/focusElementNoteList'),
	require('./gui/NoteListControls/commands/focusSearch'),
	require('./gui/Sidebar/commands/focusElementSideBar'),
];

// Commands that are not tied to any particular component.
// The runtime for these commands can be loaded when the app starts.
const globalCommands = [
	require('./commands/copyDevCommand'),
	require('./commands/exportFolders'),
	require('./commands/exportNotes'),
	require('./commands/focusElement'),
	require('./commands/openProfileDirectory'),
	require('./commands/replaceMisspelling'),
	require('./commands/startExternalEditing'),
	require('./commands/stopExternalEditing'),
	require('./commands/toggleExternalEditing'),
	require('./commands/toggleSafeMode'),
	require('./commands/restoreNoteRevision'),
	require('@joplin/lib/commands/historyBackward'),
	require('@joplin/lib/commands/historyForward'),
	require('@joplin/lib/commands/synchronize'),
];

import editorCommandDeclarations from './gui/NoteEditor/commands/editorCommandDeclarations';
import ShareService from '@joplin/lib/services/share/ShareService';
import checkForUpdates from './checkForUpdates';

const pluginClasses = [
	require('./plugins/GotoAnything').default,
];

interface AppStateRoute {
	type: string;
	routeName: string;
	props: any;
}

export interface AppStateDialog {
	name: string;
}

export interface AppState extends State {
	route: AppStateRoute;
	navHistory: any[];
	noteVisiblePanes: string[];
	windowContentSize: any;
	watchedNoteFiles: string[];
	lastEditorScrollPercents: any;
	devToolsVisible: boolean;
	visibleDialogs: any; // empty object if no dialog is visible. Otherwise contains the list of visible dialogs.
	focusedField: string;
	layoutMoveMode: boolean;
	startupPluginsLoaded: boolean;

	// Extra reducer keys go here
	watchedResources: any;
	mainLayout: LayoutItem;
	dialogs: AppStateDialog[];
}

const appDefaultState = createAppDefaultState(
	bridge().windowContentSize(),
	resourceEditWatcherDefaultState
);

class Application extends BaseApplication {

	private checkAllPluginStartedIID_: any = null;

	constructor() {
		super();

		this.bridge_nativeThemeUpdated = this.bridge_nativeThemeUpdated.bind(this);
	}

	hasGui() {
		return true;
	}

	reducer(state: AppState = appDefaultState, action: any) {
		let newState = appReducer(state, action);
		newState = resourceEditWatcherReducer(newState, action);
		newState = super.reducer(newState, action);
		return newState;
	}

	toggleDevTools(visible: boolean) {
		if (visible) {
			bridge().openDevTools();
		} else {
			bridge().closeDevTools();
		}
	}

	async generalMiddleware(store: any, next: any, action: any) {
		if (action.type == 'SETTING_UPDATE_ONE' && action.key == 'locale' || action.type == 'SETTING_UPDATE_ALL') {
			setLocale(Setting.value('locale'));
			// The bridge runs within the main process, with its own instance of locale.js
			// so it needs to be set too here.
			bridge().setLocale(Setting.value('locale'));
		}

		if (action.type == 'SETTING_UPDATE_ONE' && action.key == 'showTrayIcon' || action.type == 'SETTING_UPDATE_ALL') {
			this.updateTray();
		}

		if (action.type == 'SETTING_UPDATE_ONE' && action.key == 'style.editor.fontFamily' || action.type == 'SETTING_UPDATE_ALL') {
			this.updateEditorFont();
		}

		if (action.type == 'SETTING_UPDATE_ONE' && action.key == 'windowContentZoomFactor' || action.type == 'SETTING_UPDATE_ALL') {
			webFrame.setZoomFactor(Setting.value('windowContentZoomFactor') / 100);
		}

		if (['EVENT_NOTE_ALARM_FIELD_CHANGE', 'NOTE_DELETE'].indexOf(action.type) >= 0) {
			await AlarmService.updateNoteNotification(action.id, action.type === 'NOTE_DELETE');
		}

		const result = await super.generalMiddleware(store, next, action);
		const newState = store.getState();

		if (['NOTE_VISIBLE_PANES_TOGGLE', 'NOTE_VISIBLE_PANES_SET'].indexOf(action.type) >= 0) {
			Setting.setValue('noteVisiblePanes', newState.noteVisiblePanes);
		}

		if (['NOTE_DEVTOOLS_TOGGLE', 'NOTE_DEVTOOLS_SET'].indexOf(action.type) >= 0) {
			this.toggleDevTools(newState.devToolsVisible);
		}

		if (action.type === 'FOLDER_AND_NOTE_SELECT') {
			await Folder.expandTree(newState.folders, action.folderId);
		}

		if (this.hasGui() && ((action.type == 'SETTING_UPDATE_ONE' && ['themeAutoDetect', 'theme', 'preferredLightTheme', 'preferredDarkTheme'].includes(action.key)) || action.type == 'SETTING_UPDATE_ALL')) {
			this.handleThemeAutoDetect();
		}

		return result;
	}

	handleThemeAutoDetect() {
		if (!Setting.value('themeAutoDetect')) return;

		if (bridge().shouldUseDarkColors()) {
			Setting.setValue('theme', Setting.value('preferredDarkTheme'));
		} else {
			Setting.setValue('theme', Setting.value('preferredLightTheme'));
		}
	}

	bridge_nativeThemeUpdated() {
		this.handleThemeAutoDetect();
	}

	updateTray() {
		const app = bridge().electronApp();

		if (app.trayShown() === Setting.value('showTrayIcon')) return;

		if (!Setting.value('showTrayIcon')) {
			app.destroyTray();
		} else {
			const contextMenu = Menu.buildFromTemplate([
				{ label: _('Open %s', app.electronApp().name), click: () => { app.window().show(); } },
				{ type: 'separator' },
				{ label: _('Quit'), click: () => { void app.quit(); } },
			]);
			app.createTray(contextMenu);
		}
	}

	updateEditorFont() {
		const fontFamilies = [];
		if (Setting.value('style.editor.fontFamily')) fontFamilies.push(`"${Setting.value('style.editor.fontFamily')}"`);
		fontFamilies.push('Avenir, Arial, sans-serif');

		// The '*' and '!important' parts are necessary to make sure Russian text is displayed properly
		// https://github.com/laurent22/joplin/issues/155

		const css = `.CodeMirror * { font-family: ${fontFamilies.join(', ')} !important; }`;
		const styleTag = document.createElement('style');
		styleTag.type = 'text/css';
		styleTag.appendChild(document.createTextNode(css));
		document.head.appendChild(styleTag);
	}

	setupContextMenu() {
		const MenuItem = bridge().MenuItem;

		// The context menu must be setup in renderer process because that's where
		// the spell checker service lives.
		require('electron-context-menu')({
			shouldShowMenu: (_event: any, params: any) => {
				// params.inputFieldType === 'none' when right-clicking the text editor. This is a bit of a hack to detect it because in this
				// case we don't want to use the built-in context menu but a custom one.
				return params.isEditable && params.inputFieldType !== 'none';
			},

			menu: (actions: any, props: any) => {
				const spellCheckerMenuItems = SpellCheckerService.instance().contextMenuItems(props.misspelledWord, props.dictionarySuggestions).map((item: any) => new MenuItem(item));

				const output = [
					actions.cut(),
					actions.copy(),
					actions.paste(),
					...spellCheckerMenuItems,
				];

				return output;
			},
		});
	}

	async loadCustomCss(filePath: string) {
		let cssString = '';
		if (await fs.pathExists(filePath)) {
			try {
				cssString = await fs.readFile(filePath, 'utf-8');

			} catch (error) {
				let msg = error.message ? error.message : '';
				msg = `Could not load custom css from ${filePath}\n${msg}`;
				error.message = msg;
				throw error;
			}
		}

		return cssString;
	}

	private async checkForLegacyTemplates() {
		const templatesDir = `${Setting.value('profileDir')}/templates`;
		if (await shim.fsDriver().exists(templatesDir)) {
			try {
				const files = await shim.fsDriver().readDirStats(templatesDir);
				for (const file of files) {
					if (file.path.endsWith('.md')) {
						// There is atleast one template.
						this.store().dispatch({
							type: 'CONTAINS_LEGACY_TEMPLATES',
						});
						break;
					}
				}
			} catch (error) {
				reg.logger().error(`Failed to read templates directory: ${error}`);
			}
		}
	}

	private async initPluginService() {
		const service = PluginService.instance();

		const pluginRunner = new PluginRunner();
		service.initialize(packageInfo.version, PlatformImplementation.instance(), pluginRunner, this.store());
		service.isSafeMode = Setting.value('isSafeMode');

		const pluginSettings = service.unserializePluginSettings(Setting.value('plugins.states'));

		{
			// Users can add and remove plugins from the config screen at any
			// time, however we only effectively uninstall the plugin the next
			// time the app is started. What plugin should be uninstalled is
			// stored in the settings.
			const newSettings = service.clearUpdateState(await service.uninstallPlugins(pluginSettings));
			Setting.setValue('plugins.states', newSettings);
		}

		try {
			if (await shim.fsDriver().exists(Setting.value('pluginDir'))) {
				await service.loadAndRunPlugins(Setting.value('pluginDir'), pluginSettings);
			}
		} catch (error) {
			this.logger().error(`There was an error loading plugins from ${Setting.value('pluginDir')}:`, error);
		}

		try {
			if (Setting.value('plugins.devPluginPaths')) {
				const paths = Setting.value('plugins.devPluginPaths').split(',').map((p: string) => p.trim());
				await service.loadAndRunPlugins(paths, pluginSettings, true);
			}

			// Also load dev plugins that have passed via command line arguments
			if (Setting.value('startupDevPlugins')) {
				await service.loadAndRunPlugins(Setting.value('startupDevPlugins'), pluginSettings, true);
			}
		} catch (error) {
			this.logger().error(`There was an error loading plugins from ${Setting.value('plugins.devPluginPaths')}:`, error);
		}

		{
			// Users can potentially delete files from /plugins or even delete
			// the complete folder. When that happens, we still have the plugin
			// info in the state, which can cause various issues, so to sort it
			// out we remove from the state any plugin that has *not* been loaded
			// above (meaning the file was missing).
			// https://github.com/laurent22/joplin/issues/5253
			const oldSettings = service.unserializePluginSettings(Setting.value('plugins.states'));
			const newSettings: PluginSettings = {};
			for (const pluginId of Object.keys(oldSettings)) {
				if (!service.pluginIds.includes(pluginId)) {
					this.logger().warn('Found a plugin in the state that has not been loaded, which means the plugin might have been deleted outside Joplin - removing it from the state:', pluginId);
					continue;
				}
				newSettings[pluginId] = oldSettings[pluginId];
			}
			Setting.setValue('plugins.states', newSettings);
		}

		this.checkAllPluginStartedIID_ = setInterval(() => {
			if (service.allPluginsStarted) {
				clearInterval(this.checkAllPluginStartedIID_);
				this.dispatch({
					type: 'STARTUP_PLUGINS_LOADED',
					value: true,
				});
			}
		}, 500);
	}

	async start(argv: string[]): Promise<any> {
		const electronIsDev = require('electron-is-dev');

		// If running inside a package, the command line, instead of being "node.exe <path> <flags>" is "joplin.exe <flags>" so
		// insert an extra argument so that they can be processed in a consistent way everywhere.
		if (!electronIsDev) argv.splice(1, 0, '.');

		argv = await super.start(argv);

		await this.applySettingsSideEffects();

		if (Setting.value('sync.upgradeState') === Setting.SYNC_UPGRADE_STATE_MUST_DO) {
			reg.logger().info('app.start: doing upgradeSyncTarget action');
			bridge().window().show();
			return { action: 'upgradeSyncTarget' };
		}

		reg.logger().info('app.start: doing regular boot');

		const dir = Setting.value('profileDir');

		// Loads app-wide styles. (Markdown preview-specific styles loaded in app.js)
		const filename = Setting.custom_css_files.JOPLIN_APP;
		await injectCustomStyles('appStyles', `${dir}/${filename}`);

		AlarmService.setDriver(new AlarmServiceDriverNode({ appName: packageInfo.build.appId }));
		AlarmService.setLogger(reg.logger());

		reg.setShowErrorMessageBoxHandler((message: string) => { bridge().showErrorMessageBox(message); });

		if (Setting.value('flagOpenDevTools')) {
			bridge().openDevTools();
		}

		PluginManager.instance().dispatch_ = this.dispatch.bind(this);
		PluginManager.instance().setLogger(reg.logger());
		PluginManager.instance().register(pluginClasses);

		this.initRedux();

		CommandService.instance().initialize(this.store(), Setting.value('env') == 'dev', stateToWhenClauseContext);

		for (const command of commands) {
			CommandService.instance().registerDeclaration(command.declaration);
		}

		for (const command of globalCommands) {
			CommandService.instance().registerDeclaration(command.declaration);
			CommandService.instance().registerRuntime(command.declaration.name, command.runtime());
		}

		for (const declaration of editorCommandDeclarations) {
			CommandService.instance().registerDeclaration(declaration);
		}

		const keymapService = KeymapService.instance();
		// We only add the commands that appear in the menu because only
		// those can have a shortcut associated with them.
		keymapService.initialize(menuCommandNames());

		try {
			await keymapService.loadCustomKeymap(`${dir}/keymap-desktop.json`);
		} catch (error) {
			reg.logger().error(error);
		}

		// Since the settings need to be loaded before the store is
		// created, it will never receive the SETTING_UPDATE_ALL even,
		// which mean state.settings will not be initialised. So we
		// manually call dispatchUpdateAll() to force an update.
		Setting.dispatchUpdateAll();

		await FoldersScreenUtils.refreshFolders();

		const tags = await Tag.allWithNotes();

		this.dispatch({
			type: 'TAG_UPDATE_ALL',
			items: tags,
		});

		// const masterKeys = await MasterKey.all();

		// this.dispatch({
		// 	type: 'MASTERKEY_UPDATE_ALL',
		// 	items: masterKeys,
		// });

		this.store().dispatch({
			type: 'FOLDER_SELECT',
			id: Setting.value('activeFolderId'),
		});

		this.store().dispatch({
			type: 'FOLDER_SET_COLLAPSED_ALL',
			ids: Setting.value('collapsedFolderIds'),
		});

		// Loads custom Markdown preview styles
		const cssString = await loadCustomCss(`${Setting.value('profileDir')}/userstyle.css`);
		this.store().dispatch({
			type: 'CUSTOM_CSS_APPEND',
			css: cssString,
		});

		this.store().dispatch({
			type: 'NOTE_DEVTOOLS_SET',
			value: Setting.value('flagOpenDevTools'),
		});

		await this.checkForLegacyTemplates();

		// Note: Auto-update currently doesn't work in Linux: it downloads the update
		// but then doesn't install it on exit.
		if (shim.isWindows() || shim.isMac()) {
			const runAutoUpdateCheck = () => {
				if (Setting.value('autoUpdateEnabled')) {
					void checkForUpdates(true, bridge().window(), { includePreReleases: Setting.value('autoUpdate.includePreReleases') });
				}
			};

			// Initial check on startup
			shim.setTimeout(() => { runAutoUpdateCheck(); }, 5000);
			// Then every x hours
			shim.setInterval(() => { runAutoUpdateCheck(); }, 12 * 60 * 60 * 1000);
		}

		this.updateTray();

		shim.setTimeout(() => {
			void AlarmService.garbageCollect();
		}, 1000 * 60 * 60);

		if (Setting.value('startMinimized') && Setting.value('showTrayIcon')) {
			// Keep it hidden
		} else {
			bridge().window().show();
		}

		void ShareService.instance().maintenance();

		ResourceService.runInBackground();

		if (Setting.value('env') === 'dev') {
			void AlarmService.updateAllNotifications();
		} else {
			void reg.scheduleSync(1000).then(() => {
				// Wait for the first sync before updating the notifications, since synchronisation
				// might change the notifications.
				void AlarmService.updateAllNotifications();

				void DecryptionWorker.instance().scheduleStart();
			});
		}

		const clipperLogger = new Logger();
		clipperLogger.addTarget(TargetType.File, { path: `${Setting.value('profileDir')}/log-clipper.txt` });
		clipperLogger.addTarget(TargetType.Console);

		ClipperServer.instance().initialize(actionApi);
		ClipperServer.instance().setLogger(clipperLogger);
		ClipperServer.instance().setDispatch(this.store().dispatch);

		if (Setting.value('clipperServer.autoStart')) {
			void ClipperServer.instance().start();
		}

		ExternalEditWatcher.instance().setLogger(reg.logger());
		ExternalEditWatcher.instance().initialize(bridge, this.store().dispatch);

		ResourceEditWatcher.instance().initialize(reg.logger(), (action: any) => { this.store().dispatch(action); });

		RevisionService.instance().runInBackground();

		// Make it available to the console window - useful to call revisionService.collectRevisions()
		if (Setting.value('env') === 'dev') {
			(window as any).joplin = {
				revisionService: RevisionService.instance(),
				migrationService: MigrationService.instance(),
				decryptionWorker: DecryptionWorker.instance(),
				commandService: CommandService.instance(),
				bridge: bridge(),
				debug: new DebugService(reg.db()),
			};
		}

		bridge().addEventListener('nativeThemeUpdated', this.bridge_nativeThemeUpdated);

		await this.initPluginService();

		this.setupContextMenu();

		await SpellCheckerService.instance().initialize(new SpellCheckerServiceDriverNative());

		// await populateDatabase(reg.db());

		// setTimeout(() => {
		// 	console.info(CommandService.instance().commandsToMarkdownTable(this.store().getState()));
		// }, 2000);

		// setTimeout(() => {
		// 	this.dispatch({
		// 		type: 'NAV_GO',
		// 		routeName: 'Config',
		// 		props: {
		// 			defaultSection: 'encryption',
		// 		},
		// 	});
		// }, 2000);


		// setTimeout(() => {
		// 	this.dispatch({
		// 		type: 'DIALOG_OPEN',
		// 		name: 'syncWizard',
		// 	});
		// }, 2000);

		// setTimeout(() => {
		// 	this.dispatch({
		// 		type: 'NAV_GO',
		// 		routeName: 'Config',
		// 		props: {
		// 			defaultSection: 'plugins',
		// 		},
		// 	});
		// }, 2000);

		return null;
	}

}

let application_: Application = null;

function app() {
	if (!application_) application_ = new Application();
	return application_;
}

export default app;
