import shim from '../shim';
import { _, supportedLocalesToLanguages, defaultLocale } from '../locale';
import eventManager from '../eventManager';
import BaseModel from '../BaseModel';
import Database from '../database';
const SyncTargetRegistry = require('../SyncTargetRegistry.js');
import time from '../time';
import FileHandler, { SettingValues } from './settings/FileHandler';
const { sprintf } = require('sprintf-js');
const ObjectUtils = require('../ObjectUtils');
const { toTitleCase } = require('../string-utils.js');
const { rtrimSlashes, toSystemSlashes } = require('../path-utils');

export enum SettingItemType {
	Int = 1,
	String = 2,
	Bool = 3,
	Array = 4,
	Object = 5,
	Button = 6,
}

interface KeysOptions {
	secureOnly?: boolean;
}

export enum SettingStorage {
	Database = 1,
	File = 2,
}

// This is the definition of a setting item
export interface SettingItem {
	value: any;
	type: SettingItemType;
	public: boolean;

	subType?: string;
	key?: string;
	isEnum?: boolean;
	section?: string;
	label?(): string;
	description?: Function;
	options?(): any;
	appTypes?: AppType[];
	show?(settings: any): boolean;
	filter?(value: any): any;
	secure?: boolean;
	advanced?: boolean;
	minimum?: number;
	maximum?: number;
	step?: number;
	onClick?(): void;
	unitLabel?: Function;
	needRestart?: boolean;
	autoSave?: boolean;
	storage?: SettingStorage;
}

interface SettingItems {
	[key: string]: SettingItem;
}

// This is where the actual setting values are stored.
// They are saved to database at regular intervals.
interface CacheItem {
	key: string;
	value: any;
}

export enum SettingSectionSource {
	Default = 1,
	Plugin = 2,
}

export interface SettingSection {
	label: string;
	iconName?: string;
	description?: string;
	name?: string;
	source?: SettingSectionSource;
}

export enum SyncStartupOperation {
	None = 0,
	ClearLocalSyncState = 1,
	ClearLocalData = 2,
}

export enum Env {
	Undefined = 'SET_ME',
	Dev = 'dev',
	Prod = 'prod',
}

export enum AppType {
	Desktop = 'desktop',
	Mobile = 'mobile',
	Cli = 'cli',
}

export interface Constants {
	env: Env;
	isDemo: boolean;
	appName: string;
	appId: string;
	appType: AppType;
	resourceDirName: string;
	resourceDir: string;
	profileDir: string;
	templateDir: string;
	tempDir: string;
	pluginDataDir: string;
	cacheDir: string;
	pluginDir: string;
	flagOpenDevTools: boolean;
	syncVersion: number;
	startupDevPlugins: string[];
}

interface SettingSections {
	[key: string]: SettingSection;
}

class Setting extends BaseModel {

	public static schemaUrl = 'https://joplinapp.org/schema/settings.json';

	// For backward compatibility
	public static TYPE_INT = SettingItemType.Int;
	public static TYPE_STRING = SettingItemType.String;
	public static TYPE_BOOL = SettingItemType.Bool;
	public static TYPE_ARRAY = SettingItemType.Array;
	public static TYPE_OBJECT = SettingItemType.Object;
	public static TYPE_BUTTON = SettingItemType.Button;

	public static THEME_LIGHT = 1;
	public static THEME_DARK = 2;
	public static THEME_OLED_DARK = 22;
	public static THEME_SOLARIZED_LIGHT = 3;
	public static THEME_SOLARIZED_DARK = 4;
	public static THEME_DRACULA = 5;
	public static THEME_NORD = 6;
	public static THEME_ARITIM_DARK = 7;

	public static FONT_DEFAULT = 0;
	public static FONT_MENLO = 1;
	public static FONT_COURIER_NEW = 2;
	public static FONT_AVENIR = 3;
	public static FONT_MONOSPACE = 4;

	public static LAYOUT_ALL = 0;
	public static LAYOUT_EDITOR_VIEWER = 1;
	public static LAYOUT_EDITOR_SPLIT = 2;
	public static LAYOUT_VIEWER_SPLIT = 3;

	public static DATE_FORMAT_1 = 'DD/MM/YYYY';
	public static DATE_FORMAT_2 = 'DD/MM/YY';
	public static DATE_FORMAT_3 = 'MM/DD/YYYY';
	public static DATE_FORMAT_4 = 'MM/DD/YY';
	public static DATE_FORMAT_5 = 'YYYY-MM-DD';
	public static DATE_FORMAT_6 = 'DD.MM.YYYY';
	public static DATE_FORMAT_7 = 'YYYY.MM.DD';
	public static DATE_FORMAT_8 = 'YYMMDD';

	public static TIME_FORMAT_1 = 'HH:mm';
	public static TIME_FORMAT_2 = 'h:mm A';

	public static SHOULD_REENCRYPT_NO = 0; // Data doesn't need to be re-encrypted
	public static SHOULD_REENCRYPT_YES = 1; // Data should be re-encrypted
	public static SHOULD_REENCRYPT_NOTIFIED = 2; // Data should be re-encrypted, and user has been notified

	public static SYNC_UPGRADE_STATE_IDLE = 0; // Doesn't need to be upgraded
	public static SYNC_UPGRADE_STATE_SHOULD_DO = 1; // Should be upgraded, but waiting for user to confirm
	public static SYNC_UPGRADE_STATE_MUST_DO = 2; // Must be upgraded - on next restart, the upgrade will start

	public static custom_css_files = {
		JOPLIN_APP: 'userchrome.css',
		RENDERED_MARKDOWN: 'userstyle.css',
	};

	// Contains constants that are set by the application and
	// cannot be modified by the user:
	public static constants_: Constants = {
		env: Env.Undefined,
		isDemo: false,
		appName: 'joplin',
		appId: 'SET_ME', // Each app should set this identifier
		appType: 'SET_ME' as any, // 'cli' or 'mobile'
		resourceDirName: '',
		resourceDir: '',
		profileDir: '',
		templateDir: '',
		tempDir: '',
		pluginDataDir: '',
		cacheDir: '',
		pluginDir: '',
		flagOpenDevTools: false,
		syncVersion: 2,
		startupDevPlugins: [],
	};

	public static autoSaveEnabled = true;

	private static metadata_: SettingItems = null;
	private static keychainService_: any = null;
	private static keys_: string[] = null;
	private static cache_: CacheItem[] = [];
	private static saveTimeoutId_: any = null;
	private static changeEventTimeoutId_: any = null;
	private static customMetadata_: SettingItems = {};
	private static customSections_: SettingSections = {};
	private static changedKeys_: string[] = [];
	private static fileHandler_: FileHandler = null;

	static tableName() {
		return 'settings';
	}

	static modelType() {
		return BaseModel.TYPE_SETTING;
	}

	static async reset() {
		if (this.saveTimeoutId_) shim.clearTimeout(this.saveTimeoutId_);
		if (this.changeEventTimeoutId_) shim.clearTimeout(this.changeEventTimeoutId_);

		this.saveTimeoutId_ = null;
		this.changeEventTimeoutId_ = null;
		this.metadata_ = null;
		this.keys_ = null;
		this.cache_ = [];
		this.customMetadata_ = {};
		this.fileHandler_ = null;
	}

	public static get settingFilePath(): string {
		return `${this.value('profileDir')}/settings.json`;
	}

	public static get fileHandler(): FileHandler {
		if (!this.fileHandler_) {
			this.fileHandler_ = new FileHandler(this.settingFilePath);
		}
		return this.fileHandler_;
	}

	static keychainService() {
		if (!this.keychainService_) throw new Error('keychainService has not been set!!');
		return this.keychainService_;
	}

	static setKeychainService(s: any) {
		this.keychainService_ = s;
	}

	static metadata(): SettingItems {
		if (this.metadata_) return this.metadata_;

		const platform = shim.platformName();
		const mobilePlatform = shim.mobilePlatform();

		let wysiwygYes = '';
		let wysiwygNo = '';
		if (shim.isElectron()) {
			wysiwygYes = ` ${_('(wysiwyg: %s)', _('yes'))}`;
			wysiwygNo = ` ${_('(wysiwyg: %s)', _('no'))}`;
		}

		const emptyDirWarning = _('Attention: If you change this location, make sure you copy all your content to it before syncing, otherwise all files will be removed! See the FAQ for more details: %s', 'https://joplinapp.org/faq/');

		// A "public" setting means that it will show up in the various config screens (or config command for the CLI tool), however
		// if if private a setting might still be handled and modified by the app. For instance, the settings related to sorting notes are not
		// public for the mobile and desktop apps because they are handled separately in menus.

		const themeOptions = () => {
			const output: any = {};
			output[Setting.THEME_LIGHT] = _('Light');
			output[Setting.THEME_DARK] = _('Dark');
			output[Setting.THEME_DRACULA] = _('Dracula');
			output[Setting.THEME_SOLARIZED_LIGHT] = _('Solarised Light');
			output[Setting.THEME_SOLARIZED_DARK] = _('Solarised Dark');
			output[Setting.THEME_NORD] = _('Nord');
			output[Setting.THEME_ARITIM_DARK] = _('Aritim Dark');
			output[Setting.THEME_OLED_DARK] = _('OLED Dark');
			return output;
		};

		this.metadata_ = {
			'clientId': {
				value: '',
				type: SettingItemType.String,
				public: false,
			},
			'editor.codeView': {
				value: true,
				type: SettingItemType.Bool,
				public: false,
				appTypes: [AppType.Desktop],
				storage: SettingStorage.File,
			},
			'sync.target': {
				value: SyncTargetRegistry.nameToId('dropbox'),
				type: SettingItemType.Int,
				isEnum: true,
				public: true,
				section: 'sync',
				label: () => _('Synchronisation target'),
				description: (appType: AppType) => {
					return appType !== 'cli' ? null : _('The target to synchronise to. Each sync target may have additional parameters which are named as `sync.NUM.NAME` (all documented below).');
				},
				options: () => {
					return SyncTargetRegistry.idAndLabelPlainObject(platform);
				},
				storage: SettingStorage.File,
			},

			'sync.upgradeState': {
				value: Setting.SYNC_UPGRADE_STATE_IDLE,
				type: SettingItemType.Int,
				public: false,
			},

			'sync.startupOperation': {
				value: SyncStartupOperation.None,
				type: SettingItemType.Int,
				public: false,
			},

			'sync.2.path': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					try {
						return settings['sync.target'] == SyncTargetRegistry.nameToId('filesystem');
					} catch (error) {
						return false;
					}
				},
				filter: (value: any) => {
					return value ? rtrimSlashes(value) : '';
				},
				public: true,
				label: () => _('Directory to synchronise with (absolute path)'),
				description: () => emptyDirWarning,
				storage: SettingStorage.File,
			},

			'sync.5.path': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('nextcloud');
				},
				public: true,
				label: () => _('Nextcloud WebDAV URL'),
				description: () => emptyDirWarning,
				storage: SettingStorage.File,
			},
			'sync.5.username': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('nextcloud');
				},
				public: true,
				label: () => _('Nextcloud username'),
				storage: SettingStorage.File,
			},
			'sync.5.password': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('nextcloud');
				},
				public: true,
				label: () => _('Nextcloud password'),
				secure: true,
			},

			'sync.6.path': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('webdav');
				},
				public: true,
				label: () => _('WebDAV URL'),
				description: () => emptyDirWarning,
				storage: SettingStorage.File,
			},
			'sync.6.username': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('webdav');
				},
				public: true,
				label: () => _('WebDAV username'),
				storage: SettingStorage.File,
			},
			'sync.6.password': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('webdav');
				},
				public: true,
				label: () => _('WebDAV password'),
				secure: true,
			},

			'sync.8.path': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					try {
						return settings['sync.target'] == SyncTargetRegistry.nameToId('amazon_s3');
					} catch (error) {
						return false;
					}
				},
				filter: value => {
					return value ? rtrimSlashes(value) : '';
				},
				public: true,
				label: () => _('AWS S3 bucket'),
				description: () => emptyDirWarning,
				storage: SettingStorage.File,
			},
			'sync.8.url': {
				value: 'https://s3.amazonaws.com/',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('amazon_s3');
				},
				public: true,
				label: () => _('AWS S3 URL'),
				storage: SettingStorage.File,
			},
			'sync.8.username': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('amazon_s3');
				},
				public: true,
				label: () => _('AWS key'),
				storage: SettingStorage.File,
			},
			'sync.8.password': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('amazon_s3');
				},
				public: true,
				label: () => _('AWS secret'),
				secure: true,
			},

			'sync.9.path': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('joplinServer');
				},
				public: true,
				label: () => _('Joplin Server URL'),
				description: () => emptyDirWarning,
				storage: SettingStorage.File,
			},
			'sync.9.userContentPath': {
				value: '',
				type: SettingItemType.String,
				public: false,
				storage: SettingStorage.Database,
			},
			'sync.9.username': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('joplinServer');
				},
				public: true,
				label: () => _('Joplin Server email'),
				storage: SettingStorage.File,
			},
			'sync.9.password': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('joplinServer');
				},
				public: true,
				label: () => _('Joplin Server password'),
				secure: true,
			},

			// Although sync.10.path is essentially a constant, we still define
			// it here so that both Joplin Server and Joplin Cloud can be
			// handled in the same consistent way. Also having it a setting
			// means it can be set to something else for development.
			'sync.10.path': {
				value: 'https://api.joplincloud.com',
				type: SettingItemType.String,
				public: false,
				storage: SettingStorage.Database,
			},
			'sync.10.userContentPath': {
				value: 'https://joplinusercontent.com',
				type: SettingItemType.String,
				public: false,
				storage: SettingStorage.Database,
			},
			'sync.10.username': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('joplinCloud');
				},
				public: true,
				label: () => _('Joplin Cloud email'),
				storage: SettingStorage.File,
			},
			'sync.10.password': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				show: (settings: any) => {
					return settings['sync.target'] == SyncTargetRegistry.nameToId('joplinCloud');
				},
				public: true,
				label: () => _('Joplin Cloud password'),
				secure: true,
			},

			'sync.5.syncTargets': { value: {}, type: SettingItemType.Object, public: false },

			'sync.resourceDownloadMode': {
				value: 'always',
				type: SettingItemType.String,
				section: 'sync',
				public: true,
				advanced: true,
				isEnum: true,
				appTypes: [AppType.Mobile, AppType.Desktop],
				label: () => _('Attachment download behaviour'),
				description: () => _('In "Manual" mode, attachments are downloaded only when you click on them. In "Auto", they are downloaded when you open the note. In "Always", all the attachments are downloaded whether you open the note or not.'),
				options: () => {
					return {
						always: _('Always'),
						manual: _('Manual'),
						auto: _('Auto'),
					};
				},
				storage: SettingStorage.File,
			},

			'sync.3.auth': { value: '', type: SettingItemType.String, public: false },
			'sync.4.auth': { value: '', type: SettingItemType.String, public: false },
			'sync.7.auth': { value: '', type: SettingItemType.String, public: false },
			'sync.9.auth': { value: '', type: SettingItemType.String, public: false },
			'sync.10.auth': { value: '', type: SettingItemType.String, public: false },
			'sync.1.context': { value: '', type: SettingItemType.String, public: false },
			'sync.2.context': { value: '', type: SettingItemType.String, public: false },
			'sync.3.context': { value: '', type: SettingItemType.String, public: false },
			'sync.4.context': { value: '', type: SettingItemType.String, public: false },
			'sync.5.context': { value: '', type: SettingItemType.String, public: false },
			'sync.6.context': { value: '', type: SettingItemType.String, public: false },
			'sync.7.context': { value: '', type: SettingItemType.String, public: false },
			'sync.8.context': { value: '', type: SettingItemType.String, public: false },
			'sync.9.context': { value: '', type: SettingItemType.String, public: false },
			'sync.10.context': { value: '', type: SettingItemType.String, public: false },

			'sync.maxConcurrentConnections': { value: 5, type: SettingItemType.Int, storage: SettingStorage.File, public: true, advanced: true, section: 'sync', label: () => _('Max concurrent connections'), minimum: 1, maximum: 20, step: 1 },

			// The active folder ID is guaranteed to be valid as long as there's at least one
			// existing folder, so it is a good default in contexts where there's no currently
			// selected folder. It corresponds in general to the currently selected folder or
			// to the last folder that was selected.
			activeFolderId: { value: '', type: SettingItemType.String, public: false },

			richTextBannerDismissed: { value: false, type: SettingItemType.Bool, public: false },

			firstStart: { value: true, type: SettingItemType.Bool, public: false },
			locale: {
				value: defaultLocale(),
				type: SettingItemType.String,
				isEnum: true,
				public: true,
				label: () => _('Language'),
				options: () => {
					return ObjectUtils.sortByValue(supportedLocalesToLanguages({ includeStats: true }));
				},
				storage: SettingStorage.File,
			},
			dateFormat: {
				value: Setting.DATE_FORMAT_1,
				type: SettingItemType.String,
				isEnum: true,
				public: true,
				label: () => _('Date format'),
				options: () => {
					const options: any = {};
					const now = new Date('2017-01-30T12:00:00').getTime();
					options[Setting.DATE_FORMAT_1] = time.formatMsToLocal(now, Setting.DATE_FORMAT_1);
					options[Setting.DATE_FORMAT_2] = time.formatMsToLocal(now, Setting.DATE_FORMAT_2);
					options[Setting.DATE_FORMAT_3] = time.formatMsToLocal(now, Setting.DATE_FORMAT_3);
					options[Setting.DATE_FORMAT_4] = time.formatMsToLocal(now, Setting.DATE_FORMAT_4);
					options[Setting.DATE_FORMAT_5] = time.formatMsToLocal(now, Setting.DATE_FORMAT_5);
					options[Setting.DATE_FORMAT_6] = time.formatMsToLocal(now, Setting.DATE_FORMAT_6);
					options[Setting.DATE_FORMAT_7] = time.formatMsToLocal(now, Setting.DATE_FORMAT_7);
					options[Setting.DATE_FORMAT_8] = time.formatMsToLocal(now, Setting.DATE_FORMAT_8);
					return options;
				},
				storage: SettingStorage.File,
			},
			timeFormat: {
				value: Setting.TIME_FORMAT_1,
				type: SettingItemType.String,
				isEnum: true,
				public: true,
				label: () => _('Time format'),
				options: () => {
					const options: any = {};
					const now = new Date('2017-01-30T20:30:00').getTime();
					options[Setting.TIME_FORMAT_1] = time.formatMsToLocal(now, Setting.TIME_FORMAT_1);
					options[Setting.TIME_FORMAT_2] = time.formatMsToLocal(now, Setting.TIME_FORMAT_2);
					return options;
				},
				storage: SettingStorage.File,
			},

			theme: {
				value: Setting.THEME_LIGHT,
				type: SettingItemType.Int,
				public: true,
				appTypes: [AppType.Mobile, AppType.Desktop],
				show: (settings) => {
					return !settings['themeAutoDetect'];
				},
				isEnum: true,
				label: () => _('Theme'),
				section: 'appearance',
				options: () => themeOptions(),
				storage: SettingStorage.File,
			},

			themeAutoDetect: {
				value: false,
				type: SettingItemType.Bool,
				section: 'appearance',
				appTypes: [AppType.Desktop],
				public: true,
				label: () => _('Automatically switch theme to match system theme'),
				storage: SettingStorage.File,
			},

			preferredLightTheme: {
				value: Setting.THEME_LIGHT,
				type: SettingItemType.Int,
				public: true,
				show: (settings) => {
					return settings['themeAutoDetect'];
				},
				appTypes: [AppType.Desktop],
				isEnum: true,
				label: () => _('Preferred light theme'),
				section: 'appearance',
				options: () => themeOptions(),
				storage: SettingStorage.File,
			},

			preferredDarkTheme: {
				value: Setting.THEME_DARK,
				type: SettingItemType.Int,
				public: true,
				show: (settings) => {
					return settings['themeAutoDetect'];
				},
				appTypes: [AppType.Desktop],
				isEnum: true,
				label: () => _('Preferred dark theme'),
				section: 'appearance',
				options: () => themeOptions(),
				storage: SettingStorage.File,
			},

			notificationPermission: {
				value: '',
				type: SettingItemType.String,
				public: false,
			},

			showNoteCounts: { value: true, type: SettingItemType.Bool, storage: SettingStorage.File, public: false, advanced: true, appTypes: [AppType.Desktop], label: () => _('Show note counts') },

			layoutButtonSequence: {
				value: Setting.LAYOUT_ALL,
				type: SettingItemType.Int,
				public: false,
				appTypes: [AppType.Desktop],
				isEnum: true,
				options: () => ({
					[Setting.LAYOUT_ALL]: _('%s / %s / %s', _('Editor'), _('Viewer'), _('Split View')),
					[Setting.LAYOUT_EDITOR_VIEWER]: _('%s / %s', _('Editor'), _('Viewer')),
					[Setting.LAYOUT_EDITOR_SPLIT]: _('%s / %s', _('Editor'), _('Split View')),
					[Setting.LAYOUT_VIEWER_SPLIT]: _('%s / %s', _('Viewer'), _('Split View')),
				}),
				storage: SettingStorage.File,
			},
			uncompletedTodosOnTop: { value: true, type: SettingItemType.Bool, storage: SettingStorage.File, section: 'note', public: true, appTypes: [AppType.Cli], label: () => _('Uncompleted to-dos on top') },
			showCompletedTodos: { value: true, type: SettingItemType.Bool, storage: SettingStorage.File, section: 'note', public: true, appTypes: [AppType.Cli], label: () => _('Show completed to-dos') },
			'notes.sortOrder.field': {
				value: 'user_updated_time',
				type: SettingItemType.String,
				section: 'note',
				isEnum: true,
				public: true,
				appTypes: [AppType.Cli],
				label: () => _('Sort notes by'),
				options: () => {
					const Note = require('./Note').default;
					const noteSortFields = ['user_updated_time', 'user_created_time', 'title', 'order'];
					const options: any = {};
					for (let i = 0; i < noteSortFields.length; i++) {
						options[noteSortFields[i]] = toTitleCase(Note.fieldToLabel(noteSortFields[i]));
					}
					return options;
				},
				storage: SettingStorage.File,
			},
			'editor.autoMatchingBraces': {
				value: true,
				type: SettingItemType.Bool,
				public: true,
				section: 'note',
				appTypes: [AppType.Desktop],
				label: () => _('Auto-pair braces, parenthesis, quotations, etc.'),
				storage: SettingStorage.File,
			},
			'notes.sortOrder.reverse': { value: true, type: SettingItemType.Bool, storage: SettingStorage.File, section: 'note', public: true, label: () => _('Reverse sort order'), appTypes: [AppType.Cli] },
			'folders.sortOrder.field': {
				value: 'title',
				type: SettingItemType.String,
				isEnum: true,
				public: true,
				appTypes: [AppType.Cli],
				label: () => _('Sort notebooks by'),
				options: () => {
					const Folder = require('./Folder').default;
					const folderSortFields = ['title', 'last_note_user_updated_time'];
					const options: any = {};
					for (let i = 0; i < folderSortFields.length; i++) {
						options[folderSortFields[i]] = toTitleCase(Folder.fieldToLabel(folderSortFields[i]));
					}
					return options;
				},
				storage: SettingStorage.File,
			},
			'folders.sortOrder.reverse': { value: false, type: SettingItemType.Bool, storage: SettingStorage.File, public: true, label: () => _('Reverse sort order'), appTypes: [AppType.Cli] },
			trackLocation: { value: true, type: SettingItemType.Bool, section: 'note', storage: SettingStorage.File, public: true, label: () => _('Save geo-location with notes') },

			// 2020-10-29: For now disable the beta editor due to
			// underlying bugs in the TextInput component which we cannot
			// fix. Also the editor crashes in Android and in some cases in
			// iOS.
			// https://discourse.joplinapp.org/t/anyone-using-the-beta-editor-on-ios/11658/9
			'editor.beta': {
				value: false,
				type: SettingItemType.Bool,
				section: 'note',
				public: true,
				appTypes: [AppType.Mobile],
				label: () => 'Opt-in to the editor beta',
				description: () => 'This beta adds list continuation and syntax highlighting. If you find bugs, please report them in the Discourse forum.',
			},

			newTodoFocus: {
				value: 'title',
				type: SettingItemType.String,
				section: 'note',
				isEnum: true,
				public: true,
				appTypes: [AppType.Desktop],
				label: () => _('When creating a new to-do:'),
				options: () => {
					return {
						title: _('Focus title'),
						body: _('Focus body'),
					};
				},
				storage: SettingStorage.File,
			},
			newNoteFocus: {
				value: 'body',
				type: SettingItemType.String,
				section: 'note',
				isEnum: true,
				public: true,
				appTypes: [AppType.Desktop],
				label: () => _('When creating a new note:'),
				options: () => {
					return {
						title: _('Focus title'),
						body: _('Focus body'),
					};
				},
				storage: SettingStorage.File,
			},

			'plugins.states': {
				value: '',
				type: SettingItemType.Object,
				section: 'plugins',
				public: true,
				appTypes: [AppType.Desktop],
				needRestart: true,
				autoSave: true,
			},

			'plugins.devPluginPaths': {
				value: '',
				type: SettingItemType.String,
				section: 'plugins',
				public: true,
				advanced: true,
				appTypes: [AppType.Desktop],
				label: () => 'Development plugins',
				description: () => 'You may add multiple plugin paths, each separated by a comma. You will need to restart the application for the changes to take effect.',
				storage: SettingStorage.File,
			},

			// Deprecated - use markdown.plugin.*
			'markdown.softbreaks': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, public: false, appTypes: [AppType.Mobile, AppType.Desktop] },
			'markdown.typographer': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, public: false, appTypes: [AppType.Mobile, AppType.Desktop] },
			// Deprecated

			'markdown.plugin.softbreaks': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable soft breaks')}${wysiwygYes}` },
			'markdown.plugin.typographer': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable typographer support')}${wysiwygYes}` },
			'markdown.plugin.linkify': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable Linkify')}${wysiwygYes}` },

			'markdown.plugin.katex': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable math expressions')}${wysiwygYes}` },
			'markdown.plugin.fountain': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable Fountain syntax support')}${wysiwygYes}` },
			'markdown.plugin.mermaid': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable Mermaid diagrams support')}${wysiwygYes}` },

			'markdown.plugin.audioPlayer': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable audio player')}${wysiwygNo}` },
			'markdown.plugin.videoPlayer': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable video player')}${wysiwygNo}` },
			'markdown.plugin.pdfViewer': { storage: SettingStorage.File, value: !mobilePlatform, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Desktop], label: () => `${_('Enable PDF viewer')}${wysiwygNo}` },
			'markdown.plugin.mark': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable ==mark== syntax')}${wysiwygYes}` },
			'markdown.plugin.footnote': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable footnotes')}${wysiwygNo}` },
			'markdown.plugin.toc': { storage: SettingStorage.File, value: true, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable table of contents extension')}${wysiwygNo}` },
			'markdown.plugin.sub': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable ~sub~ syntax')}${wysiwygYes}` },
			'markdown.plugin.sup': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable ^sup^ syntax')}${wysiwygYes}` },
			'markdown.plugin.deflist': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable deflist syntax')}${wysiwygNo}` },
			'markdown.plugin.abbr': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable abbreviation syntax')}${wysiwygNo}` },
			'markdown.plugin.emoji': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable markdown emoji')}${wysiwygNo}` },
			'markdown.plugin.insert': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable ++insert++ syntax')}${wysiwygYes}` },
			'markdown.plugin.multitable': { storage: SettingStorage.File, value: false, type: SettingItemType.Bool, section: 'markdownPlugins', public: true, appTypes: [AppType.Mobile, AppType.Desktop], label: () => `${_('Enable multimarkdown table extension')}${wysiwygNo}` },

			// Tray icon (called AppIndicator) doesn't work in Ubuntu
			// http://www.webupd8.org/2017/04/fix-appindicator-not-working-for.html
			// Might be fixed in Electron 18.x but no non-beta release yet. So for now
			// by default we disable it on Linux.
			showTrayIcon: {
				value: platform !== 'linux',
				type: SettingItemType.Bool,
				section: 'application',
				public: true,
				appTypes: [AppType.Desktop],
				label: () => _('Show tray icon'),
				description: () => {
					return platform === 'linux' ? _('Note: Does not work in all desktop environments.') : _('This will allow Joplin to run in the background. It is recommended to enable this setting so that your notes are constantly being synchronised, thus reducing the number of conflicts.');
				},
				storage: SettingStorage.File,
			},

			startMinimized: { value: false, type: SettingItemType.Bool, storage: SettingStorage.File, section: 'application', public: true, appTypes: [AppType.Desktop], label: () => _('Start application minimised in the tray icon') },

			collapsedFolderIds: { value: [], type: SettingItemType.Array, public: false },

			'keychain.supported': { value: -1, type: SettingItemType.Int, public: false },
			'db.ftsEnabled': { value: -1, type: SettingItemType.Int, public: false },
			'db.fuzzySearchEnabled': { value: -1, type: SettingItemType.Int, public: false },
			'encryption.enabled': { value: false, type: SettingItemType.Bool, public: false },
			'encryption.activeMasterKeyId': { value: '', type: SettingItemType.String, public: false },
			'encryption.passwordCache': { value: {}, type: SettingItemType.Object, public: false, secure: true },
			'encryption.shouldReencrypt': {
				value: -1, // will be set on app startup
				type: SettingItemType.Int,
				public: false,
			},

			'sync.userId': {
				value: '',
				type: SettingItemType.String,
				public: false,
			},

			// Deprecated in favour of windowContentZoomFactor
			'style.zoom': { value: 100, type: SettingItemType.Int, public: false, storage: SettingStorage.File, appTypes: [AppType.Desktop], section: 'appearance', label: () => '', minimum: 50, maximum: 500, step: 10 },

			'style.editor.fontSize': { value: 15, type: SettingItemType.Int, public: true, storage: SettingStorage.File, appTypes: [AppType.Desktop], section: 'appearance', label: () => _('Editor font size'), minimum: 4, maximum: 50, step: 1 },
			'style.editor.fontFamily':
				(mobilePlatform) ?
					({
						value: Setting.FONT_DEFAULT,
						type: SettingItemType.String,
						isEnum: true,
						public: true,
						label: () => _('Editor font'),
						appTypes: [AppType.Mobile],
						section: 'appearance',
						options: () => {
							// IMPORTANT: The font mapping must match the one in global-styles.js::editorFont()
							if (mobilePlatform === 'ios') {
								return {
									[Setting.FONT_DEFAULT]: _('Default'),
									[Setting.FONT_MENLO]: 'Menlo',
									[Setting.FONT_COURIER_NEW]: 'Courier New',
									[Setting.FONT_AVENIR]: 'Avenir',
								};
							}
							return {
								[Setting.FONT_DEFAULT]: _('Default'),
								[Setting.FONT_MONOSPACE]: 'Monospace',
							};
						},
						storage: SettingStorage.File,
					}) : {
						value: '',
						type: SettingItemType.String,
						public: true,
						appTypes: [AppType.Desktop],
						section: 'appearance',
						label: () => _('Editor font family'),
						description: () =>
							_('Used for most text in the markdown editor. If not found, a generic proportional (variable width) font is used.'),
						storage: SettingStorage.File,
					},
			'style.editor.monospaceFontFamily': {
				value: '',
				type: SettingItemType.String,
				public: true,
				appTypes: [AppType.Desktop],
				section: 'appearance',
				label: () => _('Editor monospace font family'),
				description: () =>
					_('Used where a fixed width font is needed to lay out text legibly (e.g. tables, checkboxes, code). If not found, a generic monospace (fixed width) font is used.'),
				storage: SettingStorage.File,
			},

			'ui.layout': { value: {}, type: SettingItemType.Object, storage: SettingStorage.File, public: false, appTypes: [AppType.Desktop] },

			// TODO: Is there a better way to do this? The goal here is to simply have
			// a way to display a link to the customizable stylesheets, not for it to
			// serve as a customizable Setting. But because the Setting page is auto-
			// generated from this list of settings, there wasn't a really elegant way
			// to do that directly in the React markup.
			'style.customCss.renderedMarkdown': {
				value: null,
				onClick: () => {
					const dir = Setting.value('profileDir');
					const filename = Setting.custom_css_files.RENDERED_MARKDOWN;
					const filepath = `${dir}/${filename}`;
					const defaultContents = '/* For styling the rendered Markdown */';

					shim.openOrCreateFile(filepath, defaultContents);
				},
				type: SettingItemType.Button,
				public: true,
				appTypes: [AppType.Desktop],
				label: () => _('Custom stylesheet for rendered Markdown'),
				section: 'appearance',
				advanced: true,
			},
			'style.customCss.joplinApp': {
				value: null,
				onClick: () => {
					const dir = Setting.value('profileDir');
					const filename = Setting.custom_css_files.JOPLIN_APP;
					const filepath = `${dir}/${filename}`;
					const defaultContents = `/* For styling the entire Joplin app (except the rendered Markdown, which is defined in \`${Setting.custom_css_files.RENDERED_MARKDOWN}\`) */`;

					shim.openOrCreateFile(filepath, defaultContents);
				},
				type: SettingItemType.Button,
				public: true,
				appTypes: [AppType.Desktop],
				label: () => _('Custom stylesheet for Joplin-wide app styles'),
				section: 'appearance',
				advanced: true,
				description: () => 'CSS file support is provided for your convenience, but they are advanced settings, and styles you define may break from one version to the next. If you want to use them, please know that it might require regular development work from you to keep them working. The Joplin team cannot make a commitment to keep the application HTML structure stable.',
			},

			'sync.clearLocalSyncStateButton': {
				value: null,
				type: SettingItemType.Button,
				public: true,
				appTypes: [AppType.Desktop],
				label: () => _('Re-upload local data to sync target'),
				section: 'sync',
				advanced: true,
				description: () => 'If the data on the sync target is incorrect or empty, you can use this button to force a re-upload of your data to the sync target. Application will have to be restarted',
			},

			'sync.clearLocalDataButton': {
				value: null,
				type: SettingItemType.Button,
				public: true,
				appTypes: [AppType.Desktop],
				label: () => _('Delete local data and re-download from sync target'),
				section: 'sync',
				advanced: true,
				description: () => 'If the data on the sync target is correct but your local data is not, you can use this button to clear your local data and force re-downloading everything from the sync target. As your local data will be deleted first, it is recommended to export your data as JEX first. Application will have to be restarted',
			},


			autoUpdateEnabled: { value: true, type: SettingItemType.Bool, storage: SettingStorage.File, section: 'application', public: platform !== 'linux', appTypes: [AppType.Desktop], label: () => _('Automatically update the application') },
			'autoUpdate.includePreReleases': { value: false, type: SettingItemType.Bool, section: 'application', storage: SettingStorage.File, public: true, appTypes: [AppType.Desktop], label: () => _('Get pre-releases when checking for updates'), description: () => _('See the pre-release page for more details: %s', 'https://joplinapp.org/prereleases') },
			'clipperServer.autoStart': { value: false, type: SettingItemType.Bool, storage: SettingStorage.File, public: false },
			'sync.interval': {
				value: 300,
				type: SettingItemType.Int,
				section: 'sync',
				isEnum: true,
				public: true,
				label: () => _('Synchronisation interval'),
				options: () => {
					return {
						0: _('Disabled'),
						300: _('%d minutes', 5),
						600: _('%d minutes', 10),
						1800: _('%d minutes', 30),
						3600: _('%d hour', 1),
						43200: _('%d hours', 12),
						86400: _('%d hours', 24),
					};
				},
				storage: SettingStorage.File,
			},
			'sync.mobileWifiOnly': {
				value: false,
				type: SettingItemType.Bool,
				section: 'sync',
				public: true,
				label: () => _('Synchronise only over WiFi connection'),
				storage: SettingStorage.File,
				appTypes: [AppType.Mobile],
			},
			noteVisiblePanes: { value: ['editor', 'viewer'], type: SettingItemType.Array, storage: SettingStorage.File, public: false, appTypes: [AppType.Desktop] },
			tagHeaderIsExpanded: { value: true, type: SettingItemType.Bool, public: false, appTypes: [AppType.Desktop] },
			folderHeaderIsExpanded: { value: true, type: SettingItemType.Bool, public: false, appTypes: [AppType.Desktop] },
			editor: { value: '', type: SettingItemType.String, subType: 'file_path_and_args', storage: SettingStorage.File, public: true, appTypes: [AppType.Cli, AppType.Desktop], label: () => _('Text editor command'), description: () => _('The editor command (may include arguments) that will be used to open a note. If none is provided it will try to auto-detect the default editor.') },
			'export.pdfPageSize': { value: 'A4', type: SettingItemType.String, advanced: true, storage: SettingStorage.File, isEnum: true, public: true, appTypes: [AppType.Desktop], label: () => _('Page size for PDF export'), options: () => {
				return {
					'A4': _('A4'),
					'Letter': _('Letter'),
					'A3': _('A3'),
					'A5': _('A5'),
					'Tabloid': _('Tabloid'),
					'Legal': _('Legal'),
				};
			} },
			'export.pdfPageOrientation': { value: 'portrait', type: SettingItemType.String, storage: SettingStorage.File, advanced: true, isEnum: true, public: true, appTypes: [AppType.Desktop], label: () => _('Page orientation for PDF export'), options: () => {
				return {
					'portrait': _('Portrait'),
					'landscape': _('Landscape'),
				};
			} },

			'editor.keyboardMode': {
				value: '',
				type: SettingItemType.String,
				public: true,
				appTypes: [AppType.Desktop],
				isEnum: true,
				advanced: true,
				label: () => _('Keyboard Mode'),
				options: () => {
					const output: any = {};
					output[''] = _('Default');
					output['emacs'] = _('Emacs');
					output['vim'] = _('Vim');
					return output;
				},
				storage: SettingStorage.File,
			},

			'editor.spellcheckBeta': {
				value: false,
				type: SettingItemType.Bool,
				public: true,
				appTypes: [AppType.Desktop],
				label: () => 'Enable spell checking in Markdown editor? (WARNING BETA feature)',
				description: () => 'Spell checker in the Markdown editor was previously unstable (cursor location was not stable, sometimes edits would not be saved or reflected in the viewer, etc.) however it appears to be more reliable now. If you notice any issue, please report it on GitHub or the Joplin Forum (Help -> Joplin Forum)',
			},

			'net.customCertificates': {
				value: '',
				type: SettingItemType.String,
				section: 'sync',
				advanced: true,
				show: (settings: any) => {
					return [
						SyncTargetRegistry.nameToId('nextcloud'),
						SyncTargetRegistry.nameToId('webdav'),
						SyncTargetRegistry.nameToId('joplinServer'),
					].indexOf(settings['sync.target']) >= 0;
				},
				public: true,
				appTypes: [AppType.Desktop, AppType.Cli],
				label: () => _('Custom TLS certificates'),
				description: () => _('Comma-separated list of paths to directories to load the certificates from, or path to individual cert files. For example: /my/cert_dir, /other/custom.pem. Note that if you make changes to the TLS settings, you must save your changes before clicking on "Check synchronisation configuration".'),
				storage: SettingStorage.File,
			},
			'net.ignoreTlsErrors': {
				value: false,
				type: SettingItemType.Bool,
				advanced: true,
				section: 'sync',
				show: (settings: any) => {
					return (shim.isNode() || shim.mobilePlatform() === 'android') &&
						[
							SyncTargetRegistry.nameToId('nextcloud'),
							SyncTargetRegistry.nameToId('webdav'),
							SyncTargetRegistry.nameToId('joplinServer'),
							// Needs to be enabled for Joplin Cloud too because
							// some companies filter all traffic and swap TLS
							// certificates, which result in error
							// UNABLE_TO_GET_ISSUER_CERT_LOCALLY
							SyncTargetRegistry.nameToId('joplinCloud'),
						].indexOf(settings['sync.target']) >= 0;
				},
				public: true,
				label: () => _('Ignore TLS certificate errors'),
				storage: SettingStorage.File,
			},

			'sync.wipeOutFailSafe': {
				value: true,
				type: SettingItemType.Bool,
				advanced: true,
				public: true,
				section: 'sync',
				label: () => _('Fail-safe'),
				description: () => _('Fail-safe: Do not wipe out local data when sync target is empty (often the result of a misconfiguration or bug)'),
				storage: SettingStorage.File,
			},

			'api.token': { value: null, type: SettingItemType.String, public: false, storage: SettingStorage.File },
			'api.port': { value: null, type: SettingItemType.Int, storage: SettingStorage.File, public: true, appTypes: [AppType.Cli], description: () => _('Specify the port that should be used by the API server. If not set, a default will be used.') },

			'resourceService.lastProcessedChangeId': { value: 0, type: SettingItemType.Int, public: false },
			'searchEngine.lastProcessedChangeId': { value: 0, type: SettingItemType.Int, public: false },
			'revisionService.lastProcessedChangeId': { value: 0, type: SettingItemType.Int, public: false },

			'searchEngine.initialIndexingDone': { value: false, type: SettingItemType.Bool, public: false },

			'revisionService.enabled': { section: 'revisionService', storage: SettingStorage.File, value: true, type: SettingItemType.Bool, public: true, label: () => _('Enable note history') },
			'revisionService.ttlDays': {
				section: 'revisionService',
				value: 90,
				type: SettingItemType.Int,
				public: true,
				minimum: 1,
				maximum: 365 * 2,
				step: 1,
				unitLabel: (value: number = null) => {
					return value === null ? _('days') : _('%d days', value);
				},
				label: () => _('Keep note history for'),
				storage: SettingStorage.File,
			},
			'revisionService.intervalBetweenRevisions': { section: 'revisionService', value: 1000 * 60 * 10, type: SettingItemType.Int, public: false },
			'revisionService.oldNoteInterval': { section: 'revisionService', value: 1000 * 60 * 60 * 24 * 7, type: SettingItemType.Int, public: false },

			'welcome.wasBuilt': { value: false, type: SettingItemType.Bool, public: false },
			'welcome.enabled': { value: true, type: SettingItemType.Bool, public: false },

			'camera.type': { value: 0, type: SettingItemType.Int, public: false, appTypes: [AppType.Mobile] },
			'camera.ratio': { value: '4:3', type: SettingItemType.String, public: false, appTypes: [AppType.Mobile] },

			'spellChecker.enabled': { value: true, type: SettingItemType.Bool, storage: SettingStorage.File, public: false },
			'spellChecker.language': { value: '', type: SettingItemType.String, storage: SettingStorage.File, public: false },

			windowContentZoomFactor: {
				value: 100,
				type: SettingItemType.Int,
				public: false,
				appTypes: [AppType.Desktop],
				minimum: 30,
				maximum: 300,
				step: 10,
				storage: SettingStorage.File,
			},

			'layout.folderList.factor': {
				value: 1,
				type: SettingItemType.Int,
				section: 'appearance',
				public: true,
				appTypes: [AppType.Cli],
				label: () => _('Notebook list growth factor'),
				description: () =>
					_('The factor property sets how the item will grow or shrink ' +
				'to fit the available space in its container with respect to the other items. ' +
				'Thus an item with a factor of 2 will take twice as much space as an item with a factor of 1.' +
				'Restart app to see changes.'),
				storage: SettingStorage.File,
			},
			'layout.noteList.factor': {
				value: 1,
				type: SettingItemType.Int,
				section: 'appearance',
				public: true,
				appTypes: [AppType.Cli],
				label: () => _('Note list growth factor'),
				description: () =>
					_('The factor property sets how the item will grow or shrink ' +
				'to fit the available space in its container with respect to the other items. ' +
				'Thus an item with a factor of 2 will take twice as much space as an item with a factor of 1.' +
				'Restart app to see changes.'),
				storage: SettingStorage.File,
			},
			'layout.note.factor': {
				value: 2,
				type: SettingItemType.Int,
				section: 'appearance',
				public: true,
				appTypes: [AppType.Cli],
				label: () => _('Note area growth factor'),
				description: () =>
					_('The factor property sets how the item will grow or shrink ' +
				'to fit the available space in its container with respect to the other items. ' +
				'Thus an item with a factor of 2 will take twice as much space as an item with a factor of 1.' +
				'Restart app to see changes.'),
				storage: SettingStorage.File,
			},

			isSafeMode: {
				value: false,
				type: SettingItemType.Bool,
				public: false,
				appTypes: [AppType.Desktop],
				storage: SettingStorage.Database,
			},

			// 'featureFlag.syncAccurateTimestamps': {
			// 	value: false,
			// 	type: SettingItemType.Bool,
			// 	public: false,
			// 	storage: SettingStorage.File,
			// },

			// 'featureFlag.syncMultiPut': {
			// 	value: false,
			// 	type: SettingItemType.Bool,
			// 	public: false,
			// 	storage: SettingStorage.File,
			// },

		};

		this.metadata_ = Object.assign(this.metadata_, this.customMetadata_);

		return this.metadata_;
	}

	public static featureFlagKeys(appType: AppType): string[] {
		const keys = this.keys(false, appType);
		return keys.filter(k => k.indexOf('featureFlag.') === 0);
	}

	private static validateKey(key: string) {
		if (!key) throw new Error('Cannot register empty key');
		if (key.length > 128) throw new Error(`Key length cannot be longer than 128 characters: ${key}`);
		if (!key.match(/^[a-zA-Z0-9_\-.]+$/)) throw new Error(`Key must only contain characters /a-zA-Z0-9_-./ : ${key}`);
	}

	static async registerSetting(key: string, metadataItem: SettingItem) {
		if (metadataItem.isEnum && !metadataItem.options) throw new Error('The `options` property is required for enum types');

		this.validateKey(key);

		this.customMetadata_[key] = metadataItem;

		// Clear cache
		this.metadata_ = null;
		this.keys_ = null;

		// Reload the value from the database, if it was already present
		const valueRow = await this.loadOne(key);
		if (valueRow) {
			this.cache_.push({
				key: key,
				value: this.formatValue(key, valueRow.value),
			});
		}

		this.dispatch({
			type: 'SETTING_UPDATE_ONE',
			key: key,
			value: this.value(key),
		});
	}

	static async registerSection(name: string, source: SettingSectionSource, section: SettingSection) {
		this.customSections_[name] = { ...section, name: name, source: source };
	}

	static settingMetadata(key: string): SettingItem {
		const metadata = this.metadata();
		if (!(key in metadata)) throw new Error(`Unknown key: ${key}`);
		const output = Object.assign({}, metadata[key]);
		output.key = key;
		return output;
	}

	// Resets the key to its default value.
	public static resetKey(key: string) {
		const md = this.settingMetadata(key);
		this.setValue(key, md.value);
	}

	public static keyExists(key: string) {
		return key in this.metadata();
	}

	static keyDescription(key: string, appType: AppType = null) {
		const md = this.settingMetadata(key);
		if (!md.description) return null;
		return md.description(appType);
	}

	static isSecureKey(key: string) {
		return this.metadata()[key] && this.metadata()[key].secure === true;
	}

	static keys(publicOnly: boolean = false, appType: AppType = null, options: KeysOptions = null) {
		options = Object.assign({}, {
			secureOnly: false,
		}, options);

		if (!this.keys_) {
			const metadata = this.metadata();
			this.keys_ = [];
			for (const n in metadata) {
				if (!metadata.hasOwnProperty(n)) continue;
				this.keys_.push(n);
			}
		}

		if (appType || publicOnly || options.secureOnly) {
			const output = [];
			for (let i = 0; i < this.keys_.length; i++) {
				const md = this.settingMetadata(this.keys_[i]);
				if (publicOnly && !md.public) continue;
				if (appType && md.appTypes && md.appTypes.indexOf(appType) < 0) continue;
				if (options.secureOnly && !md.secure) continue;
				output.push(md.key);
			}
			return output;
		} else {
			return this.keys_;
		}
	}

	static isPublic(key: string) {
		return this.keys(true).indexOf(key) >= 0;
	}

	// Low-level method to load a setting directly from the database. Should not be used in most cases.
	public static async loadOne(key: string): Promise<CacheItem> {
		if (this.keyStorage(key) === SettingStorage.File) {
			const fromFile = await this.fileHandler.load();
			return {
				key,
				value: fromFile[key],
			};
		} else if (this.settingMetadata(key).secure) {
			return {
				key,
				value: await this.keychainService().password(`setting.${key}`),
			};
		} else {
			return this.modelSelectOne('SELECT * FROM settings WHERE key = ?', [key]);
		}
	}

	static load() {
		this.cancelScheduleSave();
		this.cancelScheduleChangeEvent();

		this.cache_ = [];
		return this.modelSelectAll('SELECT * FROM settings').then(async (rows: CacheItem[]) => {
			this.cache_ = [];

			const pushItemsToCache = (items: CacheItem[]) => {
				for (let i = 0; i < items.length; i++) {
					const c = items[i];

					if (!this.keyExists(c.key)) continue;

					c.value = this.formatValue(c.key, c.value);
					c.value = this.filterValue(c.key, c.value);

					this.cache_.push(c);
				}
			};

			// Keys in the database takes precedence over keys in the keychain because
			// they are more likely to be up to date (saving to keychain can fail, but
			// saving to database shouldn't). When the keychain works, the secure keys
			// are deleted from the database and transfered to the keychain in saveAll().

			const rowKeys = rows.map((r: any) => r.key);
			const secureKeys = this.keys(false, null, { secureOnly: true });
			const secureItems: CacheItem[] = [];
			for (const key of secureKeys) {
				if (rowKeys.includes(key)) continue;

				const password = await this.keychainService().password(`setting.${key}`);
				if (password) {
					secureItems.push({
						key: key,
						value: password,
					});
				}
			}

			const itemsFromFile: CacheItem[] = [];

			if (this.canUseFileStorage()) {
				const fromFile = await this.fileHandler.load();
				for (const k of Object.keys(fromFile)) {
					itemsFromFile.push({
						key: k,
						value: fromFile[k],
					});
				}
			}

			pushItemsToCache(rows);
			pushItemsToCache(secureItems);
			pushItemsToCache(itemsFromFile);

			this.dispatchUpdateAll();
		});
	}

	private static canUseFileStorage(): boolean {
		return !shim.mobilePlatform();
	}

	private static keyStorage(key: string): SettingStorage {
		if (!this.canUseFileStorage()) return SettingStorage.Database;
		const md = this.settingMetadata(key);
		return md.storage || SettingStorage.Database;
	}

	static toPlainObject() {
		const keys = this.keys();
		const keyToValues: any = {};
		for (let i = 0; i < keys.length; i++) {
			keyToValues[keys[i]] = this.value(keys[i]);
		}
		return keyToValues;
	}

	static dispatchUpdateAll() {
		this.dispatch({
			type: 'SETTING_UPDATE_ALL',
			settings: this.toPlainObject(),
		});
	}

	static setConstant(key: string, value: any) {
		if (!(key in this.constants_)) throw new Error(`Unknown constant key: ${key}`);
		(this.constants_ as any)[key] = value;
	}

	public static setValue(key: string, value: any) {
		if (!this.cache_) throw new Error('Settings have not been initialized!');

		value = this.formatValue(key, value);
		value = this.filterValue(key, value);

		for (let i = 0; i < this.cache_.length; i++) {
			const c = this.cache_[i];
			if (c.key == key) {
				const md = this.settingMetadata(key);

				if (md.isEnum === true) {
					if (!this.isAllowedEnumOption(key, value)) {
						throw new Error(_('Invalid option value: "%s". Possible values are: %s.', value, this.enumOptionsDoc(key)));
					}
				}

				if (c.value === value) return;

				this.changedKeys_.push(key);

				// Don't log this to prevent sensitive info (passwords, auth tokens...) to end up in logs
				// this.logger().info('Setting: ' + key + ' = ' + c.value + ' => ' + value);

				if ('minimum' in md && value < md.minimum) value = md.minimum;
				if ('maximum' in md && value > md.maximum) value = md.maximum;

				c.value = value;

				this.dispatch({
					type: 'SETTING_UPDATE_ONE',
					key: key,
					value: c.value,
				});

				this.scheduleSave();
				this.scheduleChangeEvent();
				return;
			}
		}

		this.cache_.push({
			key: key,
			value: this.formatValue(key, value),
		});

		this.dispatch({
			type: 'SETTING_UPDATE_ONE',
			key: key,
			value: this.formatValue(key, value),
		});

		this.changedKeys_.push(key);

		this.scheduleSave();
		this.scheduleChangeEvent();
	}

	static incValue(key: string, inc: any) {
		return this.setValue(key, this.value(key) + inc);
	}

	static toggle(key: string) {
		return this.setValue(key, !this.value(key));
	}

	static objectValue(settingKey: string, objectKey: string, defaultValue: any = null) {
		const o = this.value(settingKey);
		if (!o || !(objectKey in o)) return defaultValue;
		return o[objectKey];
	}

	static setObjectValue(settingKey: string, objectKey: string, value: any) {
		let o = this.value(settingKey);
		if (typeof o !== 'object') o = {};
		o[objectKey] = value;
		this.setValue(settingKey, o);
	}

	static deleteObjectValue(settingKey: string, objectKey: string) {
		const o = this.value(settingKey);
		if (typeof o !== 'object') return;
		delete o[objectKey];
		this.setValue(settingKey, o);
	}

	static async deleteKeychainPasswords() {
		const secureKeys = this.keys(false, null, { secureOnly: true });
		for (const key of secureKeys) {
			await this.keychainService().deletePassword(`setting.${key}`);
		}
	}

	static valueToString(key: string, value: any) {
		const md = this.settingMetadata(key);
		value = this.formatValue(key, value);
		if (md.type == SettingItemType.Int) return value.toFixed(0);
		if (md.type == SettingItemType.Bool) return value ? '1' : '0';
		if (md.type == SettingItemType.Array) return value ? JSON.stringify(value) : '[]';
		if (md.type == SettingItemType.Object) return value ? JSON.stringify(value) : '{}';
		if (md.type == SettingItemType.String) return value ? `${value}` : '';

		throw new Error(`Unhandled value type: ${md.type}`);
	}

	static filterValue(key: string, value: any) {
		const md = this.settingMetadata(key);
		return md.filter ? md.filter(value) : value;
	}

	static formatValue(key: string, value: any) {
		const md = this.settingMetadata(key);

		if (md.type == SettingItemType.Int) return !value ? 0 : Math.floor(Number(value));

		if (md.type == SettingItemType.Bool) {
			if (typeof value === 'string') {
				value = value.toLowerCase();
				if (value === 'true') return true;
				if (value === 'false') return false;
				value = Number(value);
			}
			return !!value;
		}

		if (md.type === SettingItemType.Array) {
			if (!value) return [];
			if (Array.isArray(value)) return value;
			if (typeof value === 'string') return JSON.parse(value);
			return [];
		}

		if (md.type === SettingItemType.Object) {
			if (!value) return {};
			if (typeof value === 'object') return value;
			if (typeof value === 'string') return JSON.parse(value);
			return {};
		}

		if (md.type === SettingItemType.String) {
			if (!value) return '';
			return `${value}`;
		}

		throw new Error(`Unhandled value type: ${md.type}`);
	}

	static value(key: string) {
		// Need to copy arrays and objects since in setValue(), the old value and new one is compared
		// with strict equality and the value is updated only if changed. However if the caller acquire
		// and object and change a key, the objects will be detected as equal. By returning a copy
		// we avoid this problem.
		function copyIfNeeded(value: any) {
			if (value === null || value === undefined) return value;
			if (Array.isArray(value)) return value.slice();
			if (typeof value === 'object') return Object.assign({}, value);
			return value;
		}

		if (key in this.constants_) {
			const v = (this.constants_ as any)[key];
			const output = typeof v === 'function' ? v() : v;
			if (output == 'SET_ME') throw new Error(`SET_ME constant has not been set: ${key}`);
			return output;
		}

		if (!this.cache_) throw new Error('Settings have not been initialized!');

		for (let i = 0; i < this.cache_.length; i++) {
			if (this.cache_[i].key == key) {
				return copyIfNeeded(this.cache_[i].value);
			}
		}

		const md = this.settingMetadata(key);
		return copyIfNeeded(md.value);
	}

	static isEnum(key: string) {
		const md = this.settingMetadata(key);
		return md.isEnum === true;
	}

	static enumOptionValues(key: string) {
		const options = this.enumOptions(key);
		const output = [];
		for (const n in options) {
			if (!options.hasOwnProperty(n)) continue;
			output.push(n);
		}
		return output;
	}

	static enumOptionLabel(key: string, value: any) {
		const options = this.enumOptions(key);
		for (const n in options) {
			if (n == value) return options[n];
		}
		return '';
	}

	static enumOptions(key: string) {
		const metadata = this.metadata();
		if (!metadata[key]) throw new Error(`Unknown key: ${key}`);
		if (!metadata[key].options) throw new Error(`No options for: ${key}`);
		return metadata[key].options();
	}

	static enumOptionsDoc(key: string, templateString: string = null) {
		if (templateString === null) templateString = '%s: %s';
		const options = this.enumOptions(key);
		const output = [];
		for (const n in options) {
			if (!options.hasOwnProperty(n)) continue;
			output.push(sprintf(templateString, n, options[n]));
		}
		return output.join(', ');
	}

	static isAllowedEnumOption(key: string, value: any) {
		const options = this.enumOptions(key);
		return !!options[value];
	}

	// For example, if settings is:
	// { sync.5.path: 'http://example', sync.5.username: 'testing' }
	// and baseKey is 'sync.5', the function will return
	// { path: 'http://example', username: 'testing' }
	static subValues(baseKey: string, settings: any, options: any = null) {
		const includeBaseKeyInName = !!options && !!options.includeBaseKeyInName;

		const output: any = {};
		for (const key in settings) {
			if (!settings.hasOwnProperty(key)) continue;
			if (key.indexOf(baseKey) === 0) {
				const subKey = includeBaseKeyInName ? key : key.substr(baseKey.length + 1);
				output[subKey] = settings[key];
			}
		}
		return output;
	}

	public static async saveAll() {
		if (Setting.autoSaveEnabled && !this.saveTimeoutId_) return Promise.resolve();

		this.logger().debug('Saving settings...');
		shim.clearTimeout(this.saveTimeoutId_);
		this.saveTimeoutId_ = null;

		const keys = this.keys();

		const valuesForFile: SettingValues = {};

		const queries = [];
		queries.push(`DELETE FROM settings WHERE key IN ("${keys.join('","')}")`);

		for (let i = 0; i < this.cache_.length; i++) {
			const s = Object.assign({}, this.cache_[i]);
			const valueAsString = this.valueToString(s.key, s.value);

			if (this.isSecureKey(s.key)) {
				// We need to be careful here because there's a bug in the macOS keychain that can
				// make it fail to save a password. https://github.com/desktop/desktop/issues/3263
				// So we try to set it and if it fails, we set it on the database instead. This is not
				// ideal because they won't be crypted, but better than losing all the user's passwords.
				// The passwords would be set again on the keychain once it starts working again (probably
				// after the user switch their computer off and on again).
				//
				// Also we don't control what happens on the keychain - the values can be edited or deleted
				// outside the application. For that reason, we rewrite it every time the values are saved,
				// even if, internally, they haven't changed.
				// As an optimisation, we check if the value exists on the keychain before writing it again.
				try {
					const passwordName = `setting.${s.key}`;
					const currentValue = await this.keychainService().password(passwordName);
					if (currentValue !== valueAsString) {
						const wasSet = await this.keychainService().setPassword(passwordName, valueAsString);
						if (wasSet) continue;
					} else {
						// The value is already in the keychain - so nothing to do
						// Make sure to `continue` here otherwise it will save the password
						// in clear text in the database.
						continue;
					}
				} catch (error) {
					this.logger().error(`Could not set setting on the keychain. Will be saved to database instead: ${s.key}:`, error);
				}
			}

			if (this.keyStorage(s.key) === SettingStorage.File) {
				valuesForFile[s.key] = s.value;
			} else {
				queries.push(Database.insertQuery(this.tableName(), {
					key: s.key,
					value: valueAsString,
				}));
			}
		}

		await BaseModel.db().transactionExecBatch(queries);

		if (this.canUseFileStorage()) await this.fileHandler.save(valuesForFile);

		this.logger().debug('Settings have been saved.');
	}

	static scheduleChangeEvent() {
		if (this.changeEventTimeoutId_) shim.clearTimeout(this.changeEventTimeoutId_);

		this.changeEventTimeoutId_ = shim.setTimeout(() => {
			this.emitScheduledChangeEvent();
		}, 1000);
	}

	static cancelScheduleChangeEvent() {
		if (this.changeEventTimeoutId_) shim.clearTimeout(this.changeEventTimeoutId_);
		this.changeEventTimeoutId_ = null;
	}

	public static emitScheduledChangeEvent() {
		if (!this.changeEventTimeoutId_) return;

		shim.clearTimeout(this.changeEventTimeoutId_);
		this.changeEventTimeoutId_ = null;

		if (!this.changedKeys_.length) {
			// Sanity check - shouldn't happen
			this.logger().warn('Trying to dispatch a change event without any changed keys');
			return;
		}

		const keys = this.changedKeys_.slice();
		this.changedKeys_ = [];
		eventManager.emit('settingsChange', { keys });
	}

	static scheduleSave() {
		if (!Setting.autoSaveEnabled) return;

		if (this.saveTimeoutId_) shim.clearTimeout(this.saveTimeoutId_);

		this.saveTimeoutId_ = shim.setTimeout(async () => {
			try {
				await this.saveAll();
			} catch (error) {
				this.logger().error('Could not save settings', error);
			}
		}, 500);
	}

	static cancelScheduleSave() {
		if (this.saveTimeoutId_) shim.clearTimeout(this.saveTimeoutId_);
		this.saveTimeoutId_ = null;
	}

	static publicSettings(appType: AppType) {
		if (!appType) throw new Error('appType is required');

		const metadata = this.metadata();

		const output: any = {};
		for (const key in metadata) {
			if (!metadata.hasOwnProperty(key)) continue;
			const s = Object.assign({}, metadata[key]);
			if (!s.public) continue;
			if (s.appTypes && s.appTypes.indexOf(appType) < 0) continue;
			s.value = this.value(key);
			output[key] = s;
		}
		return output;
	}

	static typeToString(typeId: number) {
		if (typeId === SettingItemType.Int) return 'int';
		if (typeId === SettingItemType.String) return 'string';
		if (typeId === SettingItemType.Bool) return 'bool';
		if (typeId === SettingItemType.Array) return 'array';
		if (typeId === SettingItemType.Object) return 'object';
		throw new Error(`Invalid type ID: ${typeId}`);
	}

	private static sectionSource(sectionName: string): SettingSectionSource {
		if (this.customSections_[sectionName]) return this.customSections_[sectionName].source || SettingSectionSource.Default;
		return SettingSectionSource.Default;
	}

	static groupMetadatasBySections(metadatas: SettingItem[]) {
		const sections = [];
		const generalSection: any = { name: 'general', metadatas: [] };
		const nameToSections: any = {};
		nameToSections['general'] = generalSection;
		sections.push(generalSection);
		for (let i = 0; i < metadatas.length; i++) {
			const md = metadatas[i];
			if (!md.section) {
				generalSection.metadatas.push(md);
			} else {
				if (!nameToSections[md.section]) {
					nameToSections[md.section] = {
						name: md.section,
						metadatas: [],
						source: this.sectionSource(md.section),
					};
					sections.push(nameToSections[md.section]);
				}
				nameToSections[md.section].metadatas.push(md);
			}
		}

		// for (const name in this.customSections_) {
		// 	nameToSections[name] = {
		// 		name: name,
		// 		source: this.customSections_[name].source,
		// 		metadatas: [],
		// 	};
		// }

		return sections;
	}

	static sectionNameToLabel(name: string) {
		if (name === 'general') return _('General');
		if (name === 'sync') return _('Synchronisation');
		if (name === 'appearance') return _('Appearance');
		if (name === 'note') return _('Note');
		if (name === 'markdownPlugins') return _('Markdown');
		if (name === 'plugins') return _('Plugins');
		if (name === 'application') return _('Application');
		if (name === 'revisionService') return _('Note History');
		if (name === 'encryption') return _('Encryption');
		if (name === 'server') return _('Web Clipper');
		if (name === 'keymap') return _('Keyboard Shortcuts');

		if (this.customSections_[name] && this.customSections_[name].label) return this.customSections_[name].label;

		return name;
	}

	static sectionDescription(name: string) {
		if (name === 'markdownPlugins') return _('These plugins enhance the Markdown renderer with additional features. Please note that, while these features might be useful, they are not standard Markdown and thus most of them will only work in Joplin. Additionally, some of them are *incompatible* with the WYSIWYG editor. If you open a note that uses one of these plugins in that editor, you will lose the plugin formatting. It is indicated below which plugins are compatible or not with the WYSIWYG editor.');
		if (name === 'general') return _('Notes and settings are stored in: %s', toSystemSlashes(this.value('profileDir'), process.platform));

		if (this.customSections_[name] && this.customSections_[name].description) return this.customSections_[name].description;

		return '';
	}

	static sectionNameToIcon(name: string) {
		if (name === 'general') return 'icon-general';
		if (name === 'sync') return 'icon-sync';
		if (name === 'appearance') return 'icon-appearance';
		if (name === 'note') return 'icon-note';
		if (name === 'plugins') return 'icon-plugins';
		if (name === 'markdownPlugins') return 'fab fa-markdown';
		if (name === 'application') return 'icon-application';
		if (name === 'revisionService') return 'icon-note-history';
		if (name === 'encryption') return 'icon-encryption';
		if (name === 'server') return 'far fa-hand-scissors';
		if (name === 'keymap') return 'fa fa-keyboard';

		if (this.customSections_[name] && this.customSections_[name].iconName) return this.customSections_[name].iconName;

		return 'fas fa-cog';
	}

	static appTypeToLabel(name: string) {
		// Not translated for now because only used on Welcome notes (which are not translated)
		if (name === 'cli') return 'CLI';
		return name[0].toUpperCase() + name.substr(1).toLowerCase();
	}
}

export default Setting;
