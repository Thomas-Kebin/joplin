import setUpQuickActions from './setUpQuickActions';
import PluginAssetsLoader from './PluginAssetsLoader';

const React = require('react');
const { AppState, Keyboard, NativeModules, BackHandler, Animated, View, StatusBar } = require('react-native');
const shim = require('@joplin/lib/shim').default;
shim.setReact(React);

const SafeAreaView = require('./components/SafeAreaView');
const { connect, Provider } = require('react-redux');
const { BackButtonService } = require('./services/back-button.js');
const NavService = require('@joplin/lib/services/NavService.js');
const AlarmService = require('@joplin/lib/services/AlarmService.js').default;
const AlarmServiceDriver = require('./services/AlarmServiceDriver').default;
const Alarm = require('@joplin/lib/models/Alarm').default;
const { createStore, applyMiddleware } = require('redux');
const reduxSharedMiddleware = require('@joplin/lib/components/shared/reduxSharedMiddleware');
const { shimInit } = require('./utils/shim-init-react.js');
const time = require('@joplin/lib/time').default;
const { AppNav } = require('./components/app-nav.js');
const Logger = require('@joplin/lib/Logger').default;
const Note = require('@joplin/lib/models/Note.js');
const Folder = require('@joplin/lib/models/Folder.js');
const BaseSyncTarget = require('@joplin/lib/BaseSyncTarget.js');
const { FoldersScreenUtils } = require('@joplin/lib/folders-screen-utils.js');
const Resource = require('@joplin/lib/models/Resource.js');
const Tag = require('@joplin/lib/models/Tag.js');
const NoteTag = require('@joplin/lib/models/NoteTag.js');
const BaseItem = require('@joplin/lib/models/BaseItem.js');
const MasterKey = require('@joplin/lib/models/MasterKey.js');
const Revision = require('@joplin/lib/models/Revision.js');
const BaseModel = require('@joplin/lib/BaseModel').default;
const BaseService = require('@joplin/lib/services/BaseService').default;
const ResourceService = require('@joplin/lib/services/ResourceService');
const RevisionService = require('@joplin/lib/services/RevisionService');
const KvStore = require('@joplin/lib/services/KvStore');
const { JoplinDatabase } = require('@joplin/lib/joplin-database.js');
const { Database } = require('@joplin/lib/database.js');
const { NotesScreen } = require('./components/screens/notes.js');
const { TagsScreen } = require('./components/screens/tags.js');
const NoteScreen = require('./components/screens/Note').default;
const { ConfigScreen } = require('./components/screens/config.js');
const { FolderScreen } = require('./components/screens/folder.js');
const { LogScreen } = require('./components/screens/log.js');
const { StatusScreen } = require('./components/screens/status.js');
const { SearchScreen } = require('./components/screens/search.js');
const { OneDriveLoginScreen } = require('./components/screens/onedrive-login.js');
const { EncryptionConfigScreen } = require('./components/screens/encryption-config.js');
const { DropboxLoginScreen } = require('./components/screens/dropbox-login.js');
const UpgradeSyncTargetScreen = require('./components/screens/UpgradeSyncTargetScreen').default;
const Setting = require('@joplin/lib/models/Setting').default;
const { MenuContext } = require('react-native-popup-menu');
const { SideMenu } = require('./components/side-menu.js');
const { SideMenuContent } = require('./components/side-menu-content.js');
const { SideMenuContentNote } = require('./components/side-menu-content-note.js');
const { DatabaseDriverReactNative } = require('./utils/database-driver-react-native');
const { reg } = require('@joplin/lib/registry.js');
const { setLocale, closestSupportedLocale, defaultLocale } = require('@joplin/lib/locale');
const RNFetchBlob = require('rn-fetch-blob').default;
const PoorManIntervals = require('@joplin/lib/PoorManIntervals').default;
const reducer = require('@joplin/lib/reducer').default;
const { defaultState } = require('@joplin/lib/reducer');
const { FileApiDriverLocal } = require('@joplin/lib/file-api-driver-local.js');
const DropdownAlert = require('react-native-dropdownalert').default;
const ShareExtension = require('./utils/ShareExtension.js').default;
const handleShared = require('./utils/shareHandler').default;
const ResourceFetcher = require('@joplin/lib/services/ResourceFetcher');
const SearchEngine = require('@joplin/lib/services/searchengine/SearchEngine');
const WelcomeUtils = require('@joplin/lib/WelcomeUtils');
const { themeStyle } = require('./components/global-style.js');
const uuid = require('@joplin/lib/uuid').default;

const { loadKeychainServiceAndSettings } = require('@joplin/lib/services/SettingUtils');
const KeychainServiceDriverMobile = require('@joplin/lib/services/keychain/KeychainServiceDriver.mobile').default;

const SyncTargetRegistry = require('@joplin/lib/SyncTargetRegistry.js');
const SyncTargetOneDrive = require('@joplin/lib/SyncTargetOneDrive.js');
const SyncTargetFilesystem = require('@joplin/lib/SyncTargetFilesystem.js');
const SyncTargetNextcloud = require('@joplin/lib/SyncTargetNextcloud.js');
const SyncTargetWebDAV = require('@joplin/lib/SyncTargetWebDAV.js');
const SyncTargetDropbox = require('@joplin/lib/SyncTargetDropbox.js');
const SyncTargetAmazonS3 = require('@joplin/lib/SyncTargetAmazonS3.js');

SyncTargetRegistry.addClass(SyncTargetOneDrive);
SyncTargetRegistry.addClass(SyncTargetNextcloud);
SyncTargetRegistry.addClass(SyncTargetWebDAV);
SyncTargetRegistry.addClass(SyncTargetDropbox);
SyncTargetRegistry.addClass(SyncTargetFilesystem);
SyncTargetRegistry.addClass(SyncTargetAmazonS3);

const FsDriverRN = require('./utils/fs-driver-rn.js').FsDriverRN;
const DecryptionWorker = require('@joplin/lib/services/DecryptionWorker');
const EncryptionService = require('@joplin/lib/services/EncryptionService');
const MigrationService = require('@joplin/lib/services/MigrationService');

let storeDispatch = function() {};

const logReducerAction = function(action) {
	if (['SIDE_MENU_OPEN_PERCENT', 'SYNC_REPORT_UPDATE'].indexOf(action.type) >= 0) return;

	const msg = [action.type];
	if (action.routeName) msg.push(action.routeName);

	// reg.logger().debug('Reducer action', msg.join(', '));
};

const generalMiddleware = store => next => async (action) => {
	logReducerAction(action);
	PoorManIntervals.update(); // This function needs to be called regularly so put it here

	const result = next(action);
	const newState = store.getState();

	await reduxSharedMiddleware(store, next, action);

	if (action.type == 'NAV_GO') Keyboard.dismiss();

	if (['NOTE_UPDATE_ONE', 'NOTE_DELETE', 'FOLDER_UPDATE_ONE', 'FOLDER_DELETE'].indexOf(action.type) >= 0) {
		if (!await reg.syncTarget().syncStarted()) reg.scheduleSync(5 * 1000, { syncSteps: ['update_remote', 'delete_remote'] });
		SearchEngine.instance().scheduleSyncTables();
	}

	if (['EVENT_NOTE_ALARM_FIELD_CHANGE', 'NOTE_DELETE'].indexOf(action.type) >= 0) {
		await AlarmService.updateNoteNotification(action.id, action.type === 'NOTE_DELETE');
	}

	if (action.type == 'SETTING_UPDATE_ONE' && action.key == 'sync.interval' || action.type == 'SETTING_UPDATE_ALL') {
		reg.setupRecurrentSync();
	}

	if ((action.type == 'SETTING_UPDATE_ONE' && (action.key == 'dateFormat' || action.key == 'timeFormat')) || (action.type == 'SETTING_UPDATE_ALL')) {
		time.setDateFormat(Setting.value('dateFormat'));
		time.setTimeFormat(Setting.value('timeFormat'));
	}

	if (action.type == 'SETTING_UPDATE_ONE' && action.key == 'locale' || action.type == 'SETTING_UPDATE_ALL') {
		setLocale(Setting.value('locale'));
	}

	if ((action.type == 'SETTING_UPDATE_ONE' && (action.key.indexOf('encryption.') === 0)) || (action.type == 'SETTING_UPDATE_ALL')) {
		await EncryptionService.instance().loadMasterKeysFromSettings();
		DecryptionWorker.instance().scheduleStart();
		const loadedMasterKeyIds = EncryptionService.instance().loadedMasterKeyIds();

		storeDispatch({
			type: 'MASTERKEY_REMOVE_NOT_LOADED',
			ids: loadedMasterKeyIds,
		});

		// Schedule a sync operation so that items that need to be encrypted
		// are sent to sync target.
		reg.scheduleSync();
	}

	if (action.type == 'NAV_GO' && action.routeName == 'Notes') {
		Setting.setValue('activeFolderId', newState.selectedFolderId);
	}

	if (action.type === 'SYNC_GOT_ENCRYPTED_ITEM') {
		DecryptionWorker.instance().scheduleStart();
	}

	if (action.type === 'SYNC_CREATED_OR_UPDATED_RESOURCE') {
		ResourceFetcher.instance().autoAddResources();
	}

	return result;
};

const navHistory = [];

function historyCanGoBackTo(route) {
	if (route.routeName === 'Note') return false;
	if (route.routeName === 'Folder') return false;

	// There's no point going back to these screens in general and, at least in OneDrive case,
	// it can be buggy to do so, due to incorrectly relying on global state (reg.syncTarget...)
	if (route.routeName === 'OneDriveLogin') return false;
	if (route.routeName === 'DropboxLogin') return false;

	return true;
}

const DEFAULT_ROUTE = {
	type: 'NAV_GO',
	routeName: 'Notes',
	smartFilterId: 'c3176726992c11e9ac940492261af972',
};

const appDefaultState = Object.assign({}, defaultState, {
	sideMenuOpenPercent: 0,
	route: DEFAULT_ROUTE,
	noteSelectionEnabled: false,
	noteSideMenuOptions: null,
});

const appReducer = (state = appDefaultState, action) => {
	let newState = state;
	let historyGoingBack = false;

	try {
		switch (action.type) {

		case 'NAV_BACK':

		{
			if (!navHistory.length) break;

			let newAction = null;
			while (navHistory.length) {
				newAction = navHistory.pop();
				if (newAction.routeName != state.route.routeName) break;
			}

			action = newAction ? newAction : navHistory.pop();

			historyGoingBack = true;
		}

		// Fall throught

		case 'NAV_GO':

			{
				const currentRoute = state.route;

				if (!historyGoingBack && historyCanGoBackTo(currentRoute, action)) {
				// If the route *name* is the same (even if the other parameters are different), we
				// overwrite the last route in the history with the current one. If the route name
				// is different, we push a new history entry.
					if (currentRoute.routeName == action.routeName) {
					// nothing
					} else {
						navHistory.push(currentRoute);
					}
				}

				// HACK: whenever a new screen is loaded, all the previous screens of that type
				// are overwritten with the new screen parameters. This is because the way notes
				// are currently loaded is not optimal (doesn't retain history properly) so
				// this is a simple fix without doing a big refactoring to change the way notes
				// are loaded. Might be good enough since going back to different folders
				// is probably not a common workflow.
				for (let i = 0; i < navHistory.length; i++) {
					const n = navHistory[i];
					if (n.routeName == action.routeName) {
						navHistory[i] = Object.assign({}, action);
					}
				}

				newState = Object.assign({}, state);

				newState.selectedNoteHash = '';

				if ('noteId' in action) {
					newState.selectedNoteIds = action.noteId ? [action.noteId] : [];
				}

				if ('folderId' in action) {
					newState.selectedFolderId = action.folderId;
					newState.notesParentType = 'Folder';
				}

				if ('tagId' in action) {
					newState.selectedTagId = action.tagId;
					newState.notesParentType = 'Tag';
				}

				if ('smartFilterId' in action) {
					newState.smartFilterId = action.smartFilterId;
					newState.notesParentType = 'SmartFilter';
				}

				if ('itemType' in action) {
					newState.selectedItemType = action.itemType;
				}

				if ('noteHash' in action) {
					newState.selectedNoteHash = action.noteHash;
				}

				if ('sharedData' in action) {
					newState.sharedData = action.sharedData;
				} else {
					newState.sharedData = null;
				}

				newState.route = action;
				newState.historyCanGoBack = !!navHistory.length;
			}
			break;

		case 'SIDE_MENU_TOGGLE':

			newState = Object.assign({}, state);
			newState.showSideMenu = !newState.showSideMenu;
			break;

		case 'SIDE_MENU_OPEN':

			newState = Object.assign({}, state);
			newState.showSideMenu = true;
			break;

		case 'SIDE_MENU_CLOSE':

			newState = Object.assign({}, state);
			newState.showSideMenu = false;
			break;

		case 'SIDE_MENU_OPEN_PERCENT':

			newState = Object.assign({}, state);
			newState.sideMenuOpenPercent = action.value;
			break;

		case 'NOTE_SELECTION_TOGGLE':

			{
				newState = Object.assign({}, state);

				const noteId = action.id;
				const newSelectedNoteIds = state.selectedNoteIds.slice();
				const existingIndex = state.selectedNoteIds.indexOf(noteId);

				if (existingIndex >= 0) {
					newSelectedNoteIds.splice(existingIndex, 1);
				} else {
					newSelectedNoteIds.push(noteId);
				}

				newState.selectedNoteIds = newSelectedNoteIds;
				newState.noteSelectionEnabled = !!newSelectedNoteIds.length;
			}
			break;

		case 'NOTE_SELECTION_START':

			if (!state.noteSelectionEnabled) {
				newState = Object.assign({}, state);
				newState.noteSelectionEnabled = true;
				newState.selectedNoteIds = [action.id];
			}
			break;

		case 'NOTE_SELECTION_END':

			newState = Object.assign({}, state);
			newState.noteSelectionEnabled = false;
			newState.selectedNoteIds = [];
			break;

		case 'NOTE_SIDE_MENU_OPTIONS_SET':

			newState = Object.assign({}, state);
			newState.noteSideMenuOptions = action.options;
			break;

		}
	} catch (error) {
		error.message = `In reducer: ${error.message} Action: ${JSON.stringify(action)}`;
		throw error;
	}

	return reducer(newState, action);
};

const store = createStore(appReducer, applyMiddleware(generalMiddleware));
storeDispatch = store.dispatch;

function resourceFetcher_downloadComplete(event) {
	if (event.encrypted) {
		DecryptionWorker.instance().scheduleStart();
	}
}

function decryptionWorker_resourceMetadataButNotBlobDecrypted() {
	ResourceFetcher.instance().scheduleAutoAddResources();
}

async function initialize(dispatch) {
	shimInit();

	Setting.setConstant('env', __DEV__ ? 'dev' : 'prod');
	Setting.setConstant('appId', 'net.cozic.joplin-mobile');
	Setting.setConstant('appType', 'mobile');
	Setting.setConstant('resourceDir', RNFetchBlob.fs.dirs.DocumentDir);

	const logDatabase = new Database(new DatabaseDriverReactNative());
	await logDatabase.open({ name: 'log.sqlite' });
	await logDatabase.exec(Logger.databaseCreateTableSql());

	const mainLogger = new Logger();
	mainLogger.addTarget('database', { database: logDatabase, source: 'm' });
	mainLogger.setLevel(Logger.LEVEL_INFO);

	if (Setting.value('env') == 'dev') {
		mainLogger.addTarget('console');
		mainLogger.setLevel(Logger.LEVEL_DEBUG);
	}

	reg.setLogger(mainLogger);
	reg.setShowErrorMessageBoxHandler((message) => { alert(message); });

	BaseService.logger_ = mainLogger;
	// require('@joplin/lib/ntpDate').setLogger(reg.logger());

	reg.logger().info('====================================');
	reg.logger().info(`Starting application ${Setting.value('appId')} (${Setting.value('env')})`);

	const dbLogger = new Logger();
	dbLogger.addTarget('database', { database: logDatabase, source: 'm' });
	if (Setting.value('env') == 'dev') {
		dbLogger.addTarget('console');
		dbLogger.setLevel(Logger.LEVEL_INFO); // Set to LEVEL_DEBUG for full SQL queries
	} else {
		dbLogger.setLevel(Logger.LEVEL_INFO);
	}

	const db = new JoplinDatabase(new DatabaseDriverReactNative());
	db.setLogger(dbLogger);
	reg.setDb(db);

	reg.dispatch = dispatch;
	BaseModel.dispatch = dispatch;
	FoldersScreenUtils.dispatch = dispatch;
	BaseSyncTarget.dispatch = dispatch;
	NavService.dispatch = dispatch;
	BaseModel.setDb(db);

	KvStore.instance().setDb(reg.db());

	BaseItem.loadClass('Note', Note);
	BaseItem.loadClass('Folder', Folder);
	BaseItem.loadClass('Resource', Resource);
	BaseItem.loadClass('Tag', Tag);
	BaseItem.loadClass('NoteTag', NoteTag);
	BaseItem.loadClass('MasterKey', MasterKey);
	BaseItem.loadClass('Revision', Revision);

	const fsDriver = new FsDriverRN();

	Resource.fsDriver_ = fsDriver;
	FileApiDriverLocal.fsDriver_ = fsDriver;

	AlarmService.setDriver(new AlarmServiceDriver(mainLogger));
	AlarmService.setLogger(mainLogger);

	try {
		if (Setting.value('env') == 'prod') {
			await db.open({ name: 'joplin.sqlite' });
		} else {
			await db.open({ name: 'joplin-76.sqlite' });

			// await db.clearForTesting();
		}

		reg.logger().info('Database is ready.');
		reg.logger().info('Loading settings...');

		await loadKeychainServiceAndSettings(KeychainServiceDriverMobile);

		if (!Setting.value('clientId')) Setting.setValue('clientId', uuid.create());

		if (Setting.value('firstStart')) {
			let locale = NativeModules.I18nManager.localeIdentifier;
			if (!locale) locale = defaultLocale();
			Setting.setValue('locale', closestSupportedLocale(locale));
			Setting.setValue('firstStart', 0);
		}

		if (Setting.value('db.ftsEnabled') === -1) {
			const ftsEnabled = await db.ftsEnabled();
			Setting.setValue('db.ftsEnabled', ftsEnabled ? 1 : 0);
			reg.logger().info('db.ftsEnabled = ', Setting.value('db.ftsEnabled'));
		}

		if (Setting.value('env') === 'dev') {
			Setting.setValue('welcome.enabled', false);
		}

		PluginAssetsLoader.instance().setLogger(mainLogger);
		await PluginAssetsLoader.instance().importAssets();

		// eslint-disable-next-line require-atomic-updates
		BaseItem.revisionService_ = RevisionService.instance();

		// Note: for now we hard-code the folder sort order as we need to
		// create a UI to allow customisation (started in branch mobile_add_sidebar_buttons)
		Setting.setValue('folders.sortOrder.field', 'title');
		Setting.setValue('folders.sortOrder.reverse', false);

		reg.logger().info(`Sync target: ${Setting.value('sync.target')}`);

		setLocale(Setting.value('locale'));

		// ----------------------------------------------------------------
		// E2EE SETUP
		// ----------------------------------------------------------------

		EncryptionService.fsDriver_ = fsDriver;
		EncryptionService.instance().setLogger(mainLogger);
		// eslint-disable-next-line require-atomic-updates
		BaseItem.encryptionService_ = EncryptionService.instance();
		DecryptionWorker.instance().dispatch = dispatch;
		DecryptionWorker.instance().setLogger(mainLogger);
		DecryptionWorker.instance().setKvStore(KvStore.instance());
		DecryptionWorker.instance().setEncryptionService(EncryptionService.instance());
		await EncryptionService.instance().loadMasterKeysFromSettings();
		DecryptionWorker.instance().on('resourceMetadataButNotBlobDecrypted', decryptionWorker_resourceMetadataButNotBlobDecrypted);

		// ----------------------------------------------------------------
		// / E2EE SETUP
		// ----------------------------------------------------------------

		reg.logger().info('Loading folders...');

		await FoldersScreenUtils.refreshFolders();

		const tags = await Tag.allWithNotes();

		dispatch({
			type: 'TAG_UPDATE_ALL',
			items: tags,
		});

		const masterKeys = await MasterKey.all();

		dispatch({
			type: 'MASTERKEY_UPDATE_ALL',
			items: masterKeys,
		});

		const folderId = Setting.value('activeFolderId');
		let folder = await Folder.load(folderId);

		if (!folder) folder = await Folder.defaultFolder();

		dispatch({
			type: 'FOLDER_SET_COLLAPSED_ALL',
			ids: Setting.value('collapsedFolderIds'),
		});

		if (!folder) {
			dispatch(DEFAULT_ROUTE);
		} else {
			dispatch({
				type: 'NAV_GO',
				routeName: 'Notes',
				folderId: folder.id,
			});
		}

		setUpQuickActions(dispatch, folderId);
	} catch (error) {
		alert(`Initialization error: ${error.message}`);
		reg.logger().error('Initialization error:', error);
	}

	reg.setupRecurrentSync();

	PoorManIntervals.setTimeout(() => {
		AlarmService.garbageCollect();
	}, 1000 * 60 * 60);

	ResourceService.runInBackground();

	ResourceFetcher.instance().setFileApi(() => { return reg.syncTarget().fileApi(); });
	ResourceFetcher.instance().setLogger(reg.logger());
	ResourceFetcher.instance().dispatch = dispatch;
	ResourceFetcher.instance().on('downloadComplete', resourceFetcher_downloadComplete);
	ResourceFetcher.instance().start();

	SearchEngine.instance().setDb(reg.db());
	SearchEngine.instance().setLogger(reg.logger());
	SearchEngine.instance().scheduleSyncTables();

	await MigrationService.instance().run();

	// When the app starts we want the full sync to
	// start almost immediately to get the latest data.
	reg.scheduleSync(1000).then(() => {
		// Wait for the first sync before updating the notifications, since synchronisation
		// might change the notifications.
		AlarmService.updateAllNotifications();

		DecryptionWorker.instance().scheduleStart();
	});

	await WelcomeUtils.install(dispatch);

	// Collect revisions more frequently on mobile because it doesn't auto-save
	// and it cannot collect anything when the app is not active.
	RevisionService.instance().runInBackground(1000 * 30);

	reg.logger().info('Application initialized');
}

class AppComponent extends React.Component {

	constructor() {
		super();

		this.state = {
			sideMenuContentOpacity: new Animated.Value(0),
		};

		this.lastSyncStarted_ = defaultState.syncStarted;

		this.backButtonHandler_ = () => {
			return this.backButtonHandler();
		};

		this.onAppStateChange_ = () => {
			PoorManIntervals.update();
		};
	}

	// 2020-10-08: It seems the initialisation code is quite fragile in general and should be kept simple.
	// For example, adding a loading screen as was done in this commit: https://github.com/laurent22/joplin/commit/569355a3182bc12e50a54249882e3d68a72c2b28.
	// had for effect that sharing with the app would create multiple instances of the app, thus breaking
	// database access and so on. It's unclear why it happens and how to fix it but reverting that commit
	// fixed the issue for now.
	//
	// Changing app launch mode doesn't help.
	//
	// It's possible that it's a bug in React Native, or perhaps the framework expects that the whole app can be
	// mounted/unmounted or multiple ones can be running at the same time, but the app was not designed in this
	// way.
	//
	// More reports and info about the multiple instance bug:
	//
	// https://github.com/laurent22/joplin/issues/3800
	// https://github.com/laurent22/joplin/issues/3804
	// https://github.com/laurent22/joplin/issues/3807
	// https://discourse.joplinapp.org/t/webdav-config-encryption-config-randomly-lost-on-android/11364
	// https://discourse.joplinapp.org/t/android-keeps-on-resetting-my-sync-and-theme/11443
	async componentDidMount() {
		if (this.props.appState == 'starting') {
			this.props.dispatch({
				type: 'APP_STATE_SET',
				state: 'initializing',
			});

			await initialize(this.props.dispatch);

			this.props.dispatch({
				type: 'APP_STATE_SET',
				state: 'ready',
			});
		}

		BackButtonService.initialize(this.backButtonHandler_);

		AlarmService.setInAppNotificationHandler(async (alarmId) => {
			const alarm = await Alarm.load(alarmId);
			const notification = await Alarm.makeNotification(alarm);
			this.dropdownAlert_.alertWithType('info', notification.title, notification.body ? notification.body : '');
		});

		AppState.addEventListener('change', this.onAppStateChange_);

		const sharedData = await ShareExtension.data();
		if (sharedData) {
			reg.logger().info('Received shared data');
			if (this.props.selectedFolderId) {
				handleShared(sharedData, this.props.selectedFolderId, this.props.dispatch);
			} else {
				reg.logger.info('Cannot handle share - default folder id is not set');
			}
		}
	}

	componentWillUnmount() {
		AppState.removeEventListener('change', this.onAppStateChange_);
	}

	componentDidUpdate(prevProps) {
		if (this.props.showSideMenu !== prevProps.showSideMenu) {
			Animated.timing(this.state.sideMenuContentOpacity, {
				toValue: this.props.showSideMenu ? 0.5 : 0,
				duration: 600,
			}).start();
		}
	}

	async backButtonHandler() {
		if (this.props.noteSelectionEnabled) {
			this.props.dispatch({ type: 'NOTE_SELECTION_END' });
			return true;
		}

		if (this.props.showSideMenu) {
			this.props.dispatch({ type: 'SIDE_MENU_CLOSE' });
			return true;
		}

		if (this.props.historyCanGoBack) {
			this.props.dispatch({ type: 'NAV_BACK' });
			return true;
		}

		BackHandler.exitApp();

		return false;
	}

	UNSAFE_componentWillReceiveProps(newProps) {
		if (newProps.syncStarted != this.lastSyncStarted_) {
			if (!newProps.syncStarted) FoldersScreenUtils.refreshFolders();
			this.lastSyncStarted_ = newProps.syncStarted;
		}
	}

	sideMenu_change(isOpen) {
		// Make sure showSideMenu property of state is updated
		// when the menu is open/closed.
		this.props.dispatch({
			type: isOpen ? 'SIDE_MENU_OPEN' : 'SIDE_MENU_CLOSE',
		});
	}

	render() {
		if (this.props.appState != 'ready') return null;
		const theme = themeStyle(this.props.themeId);

		let sideMenuContent = null;
		let menuPosition = 'left';

		if (this.props.routeName === 'Note') {
			sideMenuContent = <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}><SideMenuContentNote options={this.props.noteSideMenuOptions}/></SafeAreaView>;
			menuPosition = 'right';
		} else {
			sideMenuContent = <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}><SideMenuContent/></SafeAreaView>;
		}

		const appNavInit = {
			Notes: { screen: NotesScreen },
			Note: { screen: NoteScreen },
			Tags: { screen: TagsScreen },
			Folder: { screen: FolderScreen },
			OneDriveLogin: { screen: OneDriveLoginScreen },
			DropboxLogin: { screen: DropboxLoginScreen },
			EncryptionConfig: { screen: EncryptionConfigScreen },
			UpgradeSyncTarget: { screen: UpgradeSyncTargetScreen },
			Log: { screen: LogScreen },
			Status: { screen: StatusScreen },
			Search: { screen: SearchScreen },
			Config: { screen: ConfigScreen },
		};

		const statusBarStyle = theme.appearance === 'light' ? 'dark-content' : 'light-content';

		return (
			<View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
				<SideMenu
					menu={sideMenuContent}
					edgeHitWidth={5}
					menuPosition={menuPosition}
					onChange={(isOpen) => this.sideMenu_change(isOpen)}
					onSliding={(percent) => {
						this.props.dispatch({
							type: 'SIDE_MENU_OPEN_PERCENT',
							value: percent,
						});
					}}
				>
					<StatusBar barStyle={statusBarStyle} />
					<MenuContext style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
						<SafeAreaView style={{ flex: 1 }}>
							<View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
								<AppNav screens={appNavInit} />
							</View>
							<DropdownAlert ref={ref => this.dropdownAlert_ = ref} tapToCloseEnabled={true} />
							<Animated.View pointerEvents='none' style={{ position: 'absolute', backgroundColor: 'black', opacity: this.state.sideMenuContentOpacity, width: '100%', height: '120%' }}/>
						</SafeAreaView>
					</MenuContext>
				</SideMenu>
			</View>
		);
	}
}

const mapStateToProps = (state) => {
	return {
		historyCanGoBack: state.historyCanGoBack,
		showSideMenu: state.showSideMenu,
		syncStarted: state.syncStarted,
		appState: state.appState,
		noteSelectionEnabled: state.noteSelectionEnabled,
		selectedFolderId: state.selectedFolderId,
		routeName: state.route.routeName,
		themeId: state.settings.theme,
		noteSideMenuOptions: state.noteSideMenuOptions,
	};
};

const App = connect(mapStateToProps)(AppComponent);

class Root extends React.Component {
	render() {
		return (
			<Provider store={store}>
				<App/>
			</Provider>
		);
	}
}

module.exports = { Root };
