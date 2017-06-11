const sqlite3 = require('sqlite3').verbose();
const Promise = require('promise');

class DatabaseDriverNode {

	open(options) {
		return new Promise((resolve, reject) => {
			this.db_ = new sqlite3.Database(options.name, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}

	setDebugEnabled(v) {
		// ??
	}

	selectOne(sql, params = null) {
		if (!params) params = {};
		return new Promise((resolve, reject) => {
			this.db_.get(sql, params, (error, row) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(row);
			});
		});
	}

	selectAll(sql, params = null) {
		if (!params) params = {};
		return new Promise((resolve, reject) => {
			this.db_.all(sql, params, (error, row) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(row);
			});
		});
	}

	exec(sql, params = null) {
		if (!params) params = {};
		return new Promise((resolve, reject) => {
			this.db_.run(sql, params, (error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}

}

export { DatabaseDriverNode };