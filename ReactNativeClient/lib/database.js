import { uuid } from 'lib/uuid.js';
import { promiseChain } from 'lib/promise-utils.js';
import { Logger } from 'lib/logger.js'
import { time } from 'lib/time-utils.js'
import { _ } from 'lib/locale.js'
import { sprintf } from 'sprintf-js';

const structureSql = `
CREATE TABLE folders (
	id TEXT PRIMARY KEY,
	parent_id TEXT NOT NULL DEFAULT "",
	title TEXT NOT NULL DEFAULT "",
	created_time INT NOT NULL,
	updated_time INT NOT NULL,
	sync_time INT NOT NULL DEFAULT 0
);

CREATE INDEX folders_title ON folders (title);
CREATE INDEX folders_updated_time ON folders (updated_time);
CREATE INDEX folders_sync_time ON folders (sync_time);

CREATE TABLE notes (
	id TEXT PRIMARY KEY,
	parent_id TEXT NOT NULL DEFAULT "",
	title TEXT NOT NULL DEFAULT "",
	body TEXT NOT NULL DEFAULT "",
	created_time INT NOT NULL,
	updated_time INT NOT NULL,
	sync_time INT NOT NULL DEFAULT 0,
	is_conflict INT NOT NULL DEFAULT 0,
	latitude NUMERIC NOT NULL DEFAULT 0,
	longitude NUMERIC NOT NULL DEFAULT 0,
	altitude NUMERIC NOT NULL DEFAULT 0,
	author TEXT NOT NULL DEFAULT "",
	source_url TEXT NOT NULL DEFAULT "",
	is_todo INT NOT NULL DEFAULT 0,
	todo_due INT NOT NULL DEFAULT 0,
	todo_completed INT NOT NULL DEFAULT 0,
	source TEXT NOT NULL DEFAULT "",
	source_application TEXT NOT NULL DEFAULT "",
	application_data TEXT NOT NULL DEFAULT "",
	\`order\` INT NOT NULL DEFAULT 0
);

CREATE INDEX notes_title ON notes (title);
CREATE INDEX notes_updated_time ON notes (updated_time);
CREATE INDEX notes_sync_time ON notes (sync_time);
CREATE INDEX notes_is_conflict ON notes (is_conflict);
CREATE INDEX notes_is_todo ON notes (is_todo);
CREATE INDEX notes_order ON notes (\`order\`);

CREATE TABLE deleted_items (
	id INTEGER PRIMARY KEY,
	item_type INT NOT NULL,
	item_id TEXT NOT NULL,
	deleted_time INT NOT NULL
);

CREATE TABLE tags (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL DEFAULT "",
	created_time INT NOT NULL,
	updated_time INT NOT NULL,
	sync_time INT NOT NULL DEFAULT 0
);

CREATE TABLE note_tags (
	id TEXT PRIMARY KEY,
	note_id TEXT NOT NULL,
	tag_id TEXT NOT NULL,
	created_time INT NOT NULL,
	updated_time INT NOT NULL,
	sync_time INT NOT NULL DEFAULT 0
);

CREATE TABLE resources (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL DEFAULT "",
	mime TEXT NOT NULL,
	filename TEXT NOT NULL,
	created_time INT NOT NULL,
	updated_time INT NOT NULL,
	sync_time INT NOT NULL DEFAULT 0
);

CREATE TABLE settings (
	\`key\` TEXT PRIMARY KEY,
	\`value\` TEXT,
	\`type\` INT
);

CREATE TABLE table_fields (
	id INTEGER PRIMARY KEY,
	table_name TEXT,
	field_name TEXT,
	field_type INT,
	field_default TEXT
);

CREATE TABLE version (
	version INT
);

INSERT INTO version (version) VALUES (1);
`;

class Database {

	constructor(driver) {
		this.debugMode_ = false;
		this.initialized_ = false;
		this.tableFields_ = null;
		this.driver_ = driver;
		this.inTransaction_ = false;

		this.logger_ = new Logger();
		this.logger_.addTarget('console');
		this.logger_.setLevel(Logger.LEVEL_DEBUG);
	}

	// Converts the SQLite error to a regular JS error
	// so that it prints a stacktrace when passed to
	// console.error()
	sqliteErrorToJsError(error, sql = null, params = null) {
		let msg = [error.toString()];
		if (sql) msg.push(sql);
		if (params) msg.push(params);
		let output = new Error(msg.join(': '));
		if (error.code) output.code = error.code;
		return output;
	}

	setLogger(l) {
		this.logger_ = l;
	}

	logger() {
		return this.logger_;
	}

	initialized() {
		return this.initialized_;
	}

	driver() {
		return this.driver_;
	}

	async open(options) {
		await this.driver().open(options);
		this.logger().info('Database was open successfully');
		return this.initialize();
	}

	escapeField(field) {
		if (field == '*') return '*';
		return '`' + field + '`';
	}

	escapeFields(fields) {
		if (fields == '*') return '*';

		let output = [];
		for (let i = 0; i < fields.length; i++) {
			output.push(this.escapeField(fields[i]));
		}
		return output;
	}

	async tryCall(callName, sql, params) {
		if (typeof sql === 'object') {
			params = sql.params;
			sql = sql.sql;
		}

		let waitTime = 50;
		let totalWaitTime = 0;
		while (true) {
			try {
				this.logQuery(sql, params);
				let result = await this.driver()[callName](sql, params);
				return result; // No exception was thrown
			} catch (error) {
				if (error && (error.code == 'SQLITE_IOERR' || error.code == 'SQLITE_BUSY')) {
					if (totalWaitTime >= 20000) throw this.sqliteErrorToJsError(error, sql, params);
					this.logger().warn(sprintf('Error %s: will retry in %s milliseconds', error.code, waitTime));
					this.logger().warn('Error was: ' + error.toString());
					await time.msleep(waitTime);
					totalWaitTime += waitTime;
					waitTime *= 1.5;
				} else {
					throw this.sqliteErrorToJsError(error, sql, params);
				}
			}
		}
	}

	async selectOne(sql, params = null) {
		return this.tryCall('selectOne', sql, params);
	}

	async selectAll(sql, params = null) {
		return this.tryCall('selectAll', sql, params);
	}

	async exec(sql, params = null) {
		return this.tryCall('exec', sql, params);
	}

	transactionExecBatch(queries) {
		if (queries.length <= 0) return Promise.resolve();

		if (queries.length == 1) {
			let q = this.wrapQuery(queries[0]);
			return this.exec(q.sql, q.params);
		}

		// There can be only one transaction running at a time so queue
		// any new transaction here.
		if (this.inTransaction_) {
			return new Promise((resolve, reject) => {
				let iid = setInterval(() => {
					if (!this.inTransaction_) {
						clearInterval(iid);
						this.transactionExecBatch(queries).then(() => {
							resolve();
						}).catch((error) => {
							reject(error);
						});
					}
				}, 100);
			});
		}

		this.inTransaction_ = true;

		queries.splice(0, 0, 'BEGIN TRANSACTION');
		queries.push('COMMIT'); // Note: ROLLBACK is currently not supported

		let chain = [];
		for (let i = 0; i < queries.length; i++) {
			let query = this.wrapQuery(queries[i]);
			chain.push(() => {
				return this.exec(query.sql, query.params);
			});
		}

		return promiseChain(chain).then(() => {
			this.inTransaction_ = false;
		});
	}

	static enumId(type, s) {
		if (type == 'settings') {
			if (s == 'int') return 1;
			if (s == 'string') return 2;
		}
		if (type == 'fieldType') {
			return this['TYPE_' + s];
		}
		throw new Error('Unknown enum type or value: ' + type + ', ' + s);
	}

	tableFieldNames(tableName) {
		let tf = this.tableFields(tableName);
		let output = [];
		for (let i = 0; i < tf.length; i++) {
			output.push(tf[i].name);
		}
		return output;
	}

	tableFields(tableName) {
		if (!this.tableFields_) throw new Error('Fields have not been loaded yet');
		if (!this.tableFields_[tableName]) throw new Error('Unknown table: ' + tableName);
		return this.tableFields_[tableName];
	}

	static formatValue(type, value) {
		if (value === null || value === undefined) return null;
		if (type == this.TYPE_INT) return Number(value);
		if (type == this.TYPE_TEXT) return value;
		if (type == this.TYPE_NUMERIC) return Number(value);
		throw new Error('Unknown type: ' + type);
	}

	sqlStringToLines(sql) {
		let output = [];
		let lines = sql.split("\n");
		let statement = '';
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			if (line == '') continue;
			if (line.substr(0, 2) == "--") continue;
			statement += line;
			if (line[line.length - 1] == ';') {
				output.push(statement);
				statement = '';
			}
		}
		return output;
	}

	logQuery(sql, params = null) {
		this.logger().debug(sql);
		if (params !== null && params.length) this.logger().debug(JSON.stringify(params));
	}

	static insertQuery(tableName, data) {
		if (!data || !Object.keys(data).length) throw new Error('Data is empty');

		let keySql= '';
		let valueSql = '';
		let params = [];
		for (let key in data) {
			if (!data.hasOwnProperty(key)) continue;
			if (key[key.length - 1] == '_') continue;
			if (keySql != '') keySql += ', ';
			if (valueSql != '') valueSql += ', ';
			keySql += '`' + key + '`';
			valueSql += '?';
			params.push(data[key]);
		}
		return {
			sql: 'INSERT INTO `' + tableName + '` (' + keySql + ') VALUES (' + valueSql + ')',
			params: params,
		};
	}

	static updateQuery(tableName, data, where) {
		if (!data || !Object.keys(data).length) throw new Error('Data is empty');

		let sql = '';
		let params = [];
		for (let key in data) {
			if (!data.hasOwnProperty(key)) continue;
			if (key[key.length - 1] == '_') continue;
			if (sql != '') sql += ', ';
			sql += '`' + key + '`=?';
			params.push(data[key]);
		}

		if (typeof where != 'string') {
			params.push(where.id);
			where = 'id=?';
		}

		return {
			sql: 'UPDATE `' + tableName + '` SET ' + sql + ' WHERE ' + where,
			params: params,
		};
	}
	
	wrapQueries(queries) {
		let output = [];
		for (let i = 0; i < queries.length; i++) {
			output.push(this.wrapQuery(queries[i]));
		}
		return output;
	}

	wrapQuery(sql, params = null) {
		if (!sql) throw new Error('Cannot wrap empty string: ' + sql);

		if (sql.constructor === Array) {
			let output = {};
			output.sql = sql[0];
			output.params = sql.length >= 2 ? sql[1] : null;
			return output;
		} else if (typeof sql === 'string') {
			return { sql: sql, params: params };
		} else {
			return sql; // Already wrapped
		}
	}

	refreshTableFields() {
		this.logger().info('Initializing tables...');
		let queries = [];
		queries.push(this.wrapQuery('DELETE FROM table_fields'));

		return this.selectAll('SELECT name FROM sqlite_master WHERE type="table"').then((tableRows) => {
			let chain = [];
			for (let i = 0; i < tableRows.length; i++) {
				let tableName = tableRows[i].name;
				if (tableName == 'android_metadata') continue;
				if (tableName == 'table_fields') continue;
				chain.push(() => {
					return this.selectAll('PRAGMA table_info("' + tableName + '")').then((pragmas) => {
						for (let i = 0; i < pragmas.length; i++) {
							let item = pragmas[i];
							// In SQLite, if the default value is a string it has double quotes around it, so remove them here
							let defaultValue = item.dflt_value;
							if (typeof defaultValue == 'string' && defaultValue.length >= 2 && defaultValue[0] == '"' && defaultValue[defaultValue.length - 1] == '"') {
								defaultValue = defaultValue.substr(1, defaultValue.length - 2);
							}
							let q = Database.insertQuery('table_fields', {
								table_name: tableName,
								field_name: item.name,
								field_type: Database.enumId('fieldType', item.type),
								field_default: defaultValue,
							});
							queries.push(q);
						}
					});
				});
			}

			return promiseChain(chain);
		}).then(() => {
			return this.transactionExecBatch(queries);
		});
	}

	async initialize() {
		this.logger().info('Checking for database schema update...');

		for (let initLoopCount = 1; initLoopCount <= 2; initLoopCount++) {
			try {
				let row = await this.selectOne('SELECT * FROM version LIMIT 1');
				this.logger().info('Current database version', row);

				// TODO: version update logic
				// TODO: only do this if db has been updated:
				// return this.refreshTableFields();
			} catch (error) {
				if (error && error.code != 0 && error.code != 'SQLITE_ERROR') throw this.sqliteErrorToJsError(error);
		
				// Assume that error was:
				// { message: 'no such table: version (code 1): , while compiling: SELECT * FROM version', code: 0 }
				// which means the database is empty and the tables need to be created.
				// If it's any other error there's nothing we can do anyway.

				this.logger().info('Database is new - creating the schema...');

				let queries = this.wrapQueries(this.sqlStringToLines(structureSql));
				queries.push(this.wrapQuery('INSERT INTO settings (`key`, `value`, `type`) VALUES ("clientId", "' + uuid.create() + '", "' + Database.enumId('settings', 'string') + '")'));

				try {
					await this.transactionExecBatch(queries);
					this.logger().info('Database schema created successfully');
					await this.refreshTableFields();
				} catch (error) {
					throw this.sqliteErrorToJsError(error);
				}

				// Now that the database has been created, go through the normal initialisation process
				continue;
			}

			this.tableFields_ = {};

			let rows = await this.selectAll('SELECT * FROM table_fields');

			for (let i = 0; i < rows.length; i++) {
				let row = rows[i];
				if (!this.tableFields_[row.table_name]) this.tableFields_[row.table_name] = [];
				this.tableFields_[row.table_name].push({
					name: row.field_name,
					type: row.field_type,
					default: Database.formatValue(row.field_type, row.field_default),
				});
			}

			break;
		}
	}

}

Database.TYPE_INT = 1;
Database.TYPE_TEXT = 2;
Database.TYPE_NUMERIC = 3;

export { Database };