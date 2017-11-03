const { BaseModel } = require('lib/base-model.js');
const { Database } = require('lib/database.js');
const { Logger } = require('lib/logger.js');
const { sprintf } = require('sprintf-js');
const { _, supportedLocalesToLanguages, defaultLocale } = require('lib/locale.js');

class Setting extends BaseModel {

	static tableName() {
		return 'settings';
	}

	static modelType() {
		return BaseModel.TYPE_SETTING;
	}

	static settingMetadata(key) {
		if (!(key in this.metadata_)) throw new Error('Unknown key: ' + key);
		let output = Object.assign({}, this.metadata_[key]);
		output.key = key;
		return output;
	}

	static keyExists(key) {
		return key in this.metadata_;
	}

	static keys(publicOnly = false, appType = null) {
		if (!this.keys_) {
			this.keys_ = [];
			for (let n in this.metadata_) {
				if (!this.metadata_.hasOwnProperty(n)) continue;
				this.keys_.push(n);
			}
			this.keys_.sort();
		}

		if (appType || publicOnly) {
			let output = [];
			for (let i = 0; i < this.keys_.length; i++) {
				const md = this.settingMetadata(this.keys_[i]);
				if (publicOnly && !md.public) continue;
				if (appType && md.appTypes && md.appTypes.indexOf(appType) < 0) continue;
				output.push(md.key);
			}
			return output;
		} else {
			return this.keys_;
		}
	}

	static isPublic(key) {
		return this.keys(true).indexOf(key) >= 0;
	}

	static load() {
		this.cancelScheduleSave();
		this.cache_ = [];
		return this.modelSelectAll('SELECT * FROM settings').then((rows) => {
			this.cache_ = [];

			// Old keys - can be removed later
			//const ignore = ['clientId', 'sync.onedrive.auth', 'syncInterval', 'todoOnTop', 'todosOnTop', 'todoFilter'];

			for (let i = 0; i < rows.length; i++) {
				let c = rows[i];

				if (!this.keyExists(c.key)) continue;

				//if (ignore.indexOf(c.key) >= 0) continue;

				// console.info(c.key + ' = ' + c.value);

				c.value = this.formatValue(c.key, c.value);

				this.cache_.push(c);
			}

			this.dispatchUpdateAll();
		});
	}

	static dispatchUpdateAll() {
		const keys = this.keys();
		let keyToValues = {};
		for (let i = 0; i < keys.length; i++) {
			keyToValues[keys[i]] = this.value(keys[i]);
		}

		this.dispatch({
			type: 'SETTINGS_UPDATE_ALL',
			settings: keyToValues,
		});
	}

	static setConstant(key, value) {
		if (!(key in this.constants_)) throw new Error('Unknown constant key: ' + key);
		this.constants_[key] = value;
	}

	static setValue(key, value) {
		if (!this.cache_) throw new Error('Settings have not been initialized!');

		value = this.formatValue(key, value);
		
		for (let i = 0; i < this.cache_.length; i++) {
			let c = this.cache_[i];
			if (c.key == key) {
				const md = this.settingMetadata(key);

				if (md.isEnum === true) {
					if (!this.isAllowedEnumOption(key, value)) {
						throw new Error(_('Invalid option value: "%s". Possible values are: %s.', value, this.enumOptionsDoc(key)));
					}
				}

				if (c.value === value) return;

				this.logger().info('Setting: ' + key + ' = ' + c.value + ' => ' + value);

				c.value = this.formatValue(key, value);

				this.dispatch({
					type: 'SETTINGS_UPDATE_ONE',
					key: key,
					value: c.value,
				});

				this.scheduleSave();
				return;
			}
		}

		this.cache_.push({
			key: key,
			value: this.formatValue(key, value),
		});

		this.dispatch({
			type: 'SETTINGS_UPDATE_ONE',
			key: key,
			value: this.formatValue(key, value),
		});

		this.scheduleSave();
	}

	static valueToString(key, value) {
		const md = this.settingMetadata(key);
		value = this.formatValue(key, value);
		if (md.type == Setting.TYPE_INT) return value.toFixed(0);
		if (md.type == Setting.TYPE_BOOL) return value ? '1' : '0';
		return value;
	}

	static formatValue(key, value) {
		const md = this.settingMetadata(key);
		if (md.type == Setting.TYPE_INT) return Math.floor(Number(value));
		if (md.type == Setting.TYPE_BOOL) {
			if (typeof value === 'string') {
				value = value.toLowerCase();
				if (value === 'true') return true;
				if (value === 'false') return false;
				value = Number(value);
			}
			return !!value;
		}
		return value;
	}

	static value(key) {
		if (key in this.constants_) {
			let output = this.constants_[key];
			if (output == 'SET_ME') throw new Error('Setting constant has not been set: ' + key);
			return output;
		}

		if (!this.cache_) throw new Error('Settings have not been initialized!');

		for (let i = 0; i < this.cache_.length; i++) {
			if (this.cache_[i].key == key) {
				return this.cache_[i].value;
			}
		}

		const md = this.settingMetadata(key);
		return md.value;
	}

	static isEnum(key) {
		const md = this.settingMetadata(key);
		return md.isEnum === true;
	}

	static enumOptionValues(key) {
		const options = this.enumOptions(key);
		let output = [];
		for (let n in options) {
			if (!options.hasOwnProperty(n)) continue;
			output.push(n);
		}
		return output;
	}

	static enumOptionLabel(key, value) {
		const options = this.enumOptions(key);
		for (let n in options) {
			if (n == value) return options[n];
		}
		return '';
	}

	static enumOptions(key) {
		if (!this.metadata_[key]) throw new Error('Unknown key: ' + key);
		if (!this.metadata_[key].options) throw new Error('No options for: ' + key);
		return this.metadata_[key].options();
	}

	static enumOptionsDoc(key, templateString = null) {
		if (templateString === null) templateString = '%s: %s';
		const options = this.enumOptions(key);
		let output = [];
		for (let n in options) {
			if (!options.hasOwnProperty(n)) continue;
			output.push(sprintf(templateString, n, options[n]));
		}
		return output.join(', ');
	}

	static isAllowedEnumOption(key, value) {
		const options = this.enumOptions(key);
		return !!options[value];
	}

	// Currently only supports objects with properties one level deep
	static object(key) {
		let output = {};
		let keys = this.keys();
		for (let i = 0; i < keys.length; i++) {
			let k = keys[i].split('.');
			if (k[0] == key) {
				output[k[1]] = this.value(keys[i]);
			}
		}
		return output;
	}

	// Currently only supports objects with properties one level deep
	static setObject(key, object) {
		for (let n in object) {
			if (!object.hasOwnProperty(n)) continue;
			this.setValue(key + '.' + n, object[n]);
		}
	}

	static saveAll() {
		if (!this.saveTimeoutId_) return Promise.resolve();

		this.logger().info('Saving settings...');
		clearTimeout(this.saveTimeoutId_);
		this.saveTimeoutId_ = null;

		let queries = [];
		queries.push('DELETE FROM settings');
		for (let i = 0; i < this.cache_.length; i++) {
			let s = Object.assign({}, this.cache_[i]);
			s.value = this.valueToString(s.key, s.value);
			queries.push(Database.insertQuery(this.tableName(), s));
		}

		return BaseModel.db().transactionExecBatch(queries).then(() => {
			this.logger().info('Settings have been saved.');
		});
	}

	static scheduleSave() {
		if (this.saveTimeoutId_) clearTimeout(this.saveTimeoutId_);

		this.saveTimeoutId_ = setTimeout(() => {
			this.saveAll();
		}, 500);
	}

	static cancelScheduleSave() {
		if (this.saveTimeoutId_) clearTimeout(this.saveTimeoutId_);
		this.saveTimeoutId_ = null;
	}

	static publicSettings(appType) {
		if (!appType) throw new Error('appType is required');

		let output = {};
		for (let key in Setting.metadata_) {
			if (!Setting.metadata_.hasOwnProperty(key)) continue;
			let s = Object.assign({}, Setting.metadata_[key]);
			if (!s.public) continue;
			if (s.appTypes && s.appTypes.indexOf(appType) < 0) continue;
			s.value = this.value(key);
			output[key] = s;
		}
		return output;
	}

	static typeToString(typeId) {
		if (typeId === Setting.TYPE_INT) return 'int';
		if (typeId === Setting.TYPE_STRING) return 'string';
		if (typeId === Setting.TYPE_BOOL) return 'bool';
	}

}

Setting.SYNC_TARGET_MEMORY = 1;
Setting.SYNC_TARGET_FILESYSTEM = 2;
Setting.SYNC_TARGET_ONEDRIVE = 3;

Setting.TYPE_INT = 1;
Setting.TYPE_STRING = 2;
Setting.TYPE_BOOL = 3;

Setting.THEME_LIGHT = 1;
Setting.THEME_DARK = 2;

Setting.metadata_ = {
	'activeFolderId': { value: '', type: Setting.TYPE_STRING, public: false },
	'firstStart': { value: true, type: Setting.TYPE_BOOL, public: false },
	'sync.2.path': { value: '', type: Setting.TYPE_STRING, public: true, appTypes: ['cli'], label: () => _('File system synchronisation target directory'), description: () => _('The path to synchronise with when file system synchronisation is enabled. See `sync.target`.') },
	'sync.3.auth': { value: '', type: Setting.TYPE_STRING, public: false },
	'sync.target': { value: Setting.SYNC_TARGET_ONEDRIVE, type: Setting.TYPE_INT, isEnum: true, public: true, label: () => _('Synchronisation target'), description: () => _('The target to synchonise to. If synchronising with the file system, set `sync.2.path` to specify the target directory.'), options: () => {
		let output = {};
		output[Setting.SYNC_TARGET_MEMORY] = 'Memory';
		output[Setting.SYNC_TARGET_FILESYSTEM] = _('File system');
		output[Setting.SYNC_TARGET_ONEDRIVE] = _('OneDrive');
		return output;
	}},
	'sync.1.context': { value: '', type: Setting.TYPE_STRING, public: false },
	'sync.2.context': { value: '', type: Setting.TYPE_STRING, public: false },
	'sync.3.context': { value: '', type: Setting.TYPE_STRING, public: false },
	'sync.4.context': { value: '', type: Setting.TYPE_STRING, public: false },
	'sync.5.context': { value: '', type: Setting.TYPE_STRING, public: false },
	'sync.6.context': { value: '', type: Setting.TYPE_STRING, public: false },
	'editor': { value: '', type: Setting.TYPE_STRING, public: true, appTypes: ['cli'], label: () => _('Text editor'), description: () => _('The editor that will be used to open a note. If none is provided it will try to auto-detect the default editor.') },
	'locale': { value: defaultLocale(), type: Setting.TYPE_STRING, isEnum: true, public: true, label: () => _('Language'), options: () => {
		return supportedLocalesToLanguages();
	}},
	// 'logLevel': { value: Logger.LEVEL_INFO, type: Setting.TYPE_STRING, isEnum: true, public: true, label: () => _('Log level'), options: () => {
	// 	return Logger.levelEnum();
	// }},
	// Not used for now:
	// 'todoFilter': { value: 'all', type: Setting.TYPE_STRING, isEnum: true, public: false, appTypes: ['mobile'], label: () => _('Todo filter'), options: () => ({
	// 	all: _('Show all'),
	// 	recent: _('Non-completed and recently completed ones'),
	// 	nonCompleted: _('Non-completed ones only'),
	// })},
	'uncompletedTodosOnTop': { value: true, type: Setting.TYPE_BOOL, public: true, label: () => _('Show uncompleted todos on top of the lists') },
	'showAdvancedOptions': { value: false, type: Setting.TYPE_BOOL, public: true, appTypes: ['mobile'], label: () => _('Show advanced options') },
	'trackLocation': { value: true, type: Setting.TYPE_BOOL, public: true, label: () => _('Save geo-location with notes') },
	'sync.interval': { value: 300, type: Setting.TYPE_INT, isEnum: true, public: true, label: () => _('Synchronisation interval'), options: () => {
		return {
			0: _('Disabled'),
			300: _('%d minutes', 5),
			600: _('%d minutes', 10),
			1800: _('%d minutes', 30),
			3600: _('%d hour', 1),
			43200: _('%d hours', 12),
			86400: _('%d hours', 24),
		};
	}},
	'theme': { value: Setting.THEME_LIGHT, type: Setting.TYPE_INT, public: true, appTypes: ['mobile'], isEnum: true, label: () => _('Theme'), options: () => {
		let output = {};
		output[Setting.THEME_LIGHT] = _('Light');
		output[Setting.THEME_DARK] = _('Dark');
		return output;
	}},
};

// Contains constants that are set by the application and
// cannot be modified by the user:
Setting.constants_ = {
	env: 'SET_ME',
	isDemo: false,
	appName: 'joplin',
	appId: 'SET_ME', // Each app should set this identifier
	appType: 'SET_ME', // 'cli' or 'mobile'
	resourceDir: '',
	profileDir: '',
	tempDir: '',
}

module.exports = { Setting };