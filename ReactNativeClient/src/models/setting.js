import { BaseModel } from 'src/base-model.js';
import { Log } from 'src/log.js';
import { Database } from 'src/database.js';

class Setting extends BaseModel {

	static defaults_ = {
		'clientId': { value: '', type: 'string' },
		'sessionId': { value: '', type: 'string' },
		'lastUpdateTime': { value: '', type: 'int' },
		'user.email': { value: '', type: 'string' },
		'user.session': { value: '', type: 'string' },
	};

	static tableName() {
		return 'settings';
	}

	static defaultSetting(key) {
		if (!(key in this.defaults_)) throw new Error('Unknown key: ' + key);
		let output = Object.assign({}, this.defaults_[key]);
		output.key = key;
		return output;
	}

	static keys() {
		if (this.keys_) return this.keys_;
		this.keys_ = [];
		for (let n in this.defaults_) {
			if (!this.defaults_.hasOwnProperty(n)) continue;
			this.keys_.push(n);
		}
		return this.keys_;
	}

	static load() {
		this.cache_ = [];
		return this.db().selectAll('SELECT * FROM settings').then((r) => {
			for (let i = 0; i < r.rows.length; i++) {
				this.cache_.push(r.rows.item(i));
			}
		});
	}

	static setValue(key, value) {
		// if (value !== null && typeof value === 'object') {
		// 	return this.setObject(key, value);
		// }

		this.scheduleUpdate();

		for (let i = 0; i < this.cache_.length; i++) {
			if (this.cache_[i].key == key) {
				this.cache_[i].value = value;
				return;
			}
		}

		let s = this.defaultSetting(key);
		s.value = value;
		this.cache_.push(s);
	}

	// static del(key) {
	// 	this.scheduleUpdate();

	// 	for (let i = 0; i < this.cache_.length; i++) {
	// 		if (this.cache_[i].key == key) {
	// 			this.cache_[i].value = value;
	// 			return;
	// 		}
	// 	}
	// }

	static value(key) {
		for (let i = 0; i < this.cache_.length; i++) {
			if (this.cache_[i].key == key) {
				return this.cache_[i].value;
			}
		}

		let s = this.defaultSetting(key);
		return s.value;
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

	static scheduleUpdate() {
		if (this.updateTimeoutId) clearTimeout(this.updateTimeoutId);

		this.updateTimeoutId = setTimeout(() => {
			Log.info('Saving settings...');
			this.updateTimeoutId = null;
			BaseModel.db().transaction((tx) => {
				tx.executeSql('DELETE FROM settings');
				for (let i = 0; i < this.cache_.length; i++) {
					let q = Database.insertQuery(this.tableName(), this.cache_[i]);
					tx.executeSql(q.sql, q.params);
				}
			}).then(() => {
				Log.info('Settings have been saved.');
			}).catch((error) => {
				Log.warn('Could not update settings:', error);
			});
		}, 500);
	}

}

export { Setting };