import { knex, Knex } from 'knex';
import { DatabaseConfig } from './utils/types';
import * as pathUtils from 'path';
import time from '@joplin/lib/time';
import Logger from '@joplin/lib/Logger';
import { databaseSchema } from './services/database/types';

// Make sure bigInteger values are numbers and not strings
//
// https://github.com/brianc/node-pg-types
//
// In our case, all bigInteger are timestamps, which JavaScript can handle
// fine as numbers.
require('pg').types.setTypeParser(20, function(val: any) {
	return parseInt(val, 10);
});

const logger = Logger.create('db');

// To prevent error "SQLITE_ERROR: too many SQL variables", SQL statements with
// "IN" clauses shouldn't contain more than the number of variables below.s
// https://www.sqlite.org/limits.html#max_variable_number
export const SqliteMaxVariableNum = 999;

const migrationDir = `${__dirname}/migrations`;
export const sqliteDefaultDir = pathUtils.dirname(__dirname);

export const defaultAdminEmail = 'admin@localhost';
export const defaultAdminPassword = 'admin';

export type DbConnection = Knex;

export interface DbConfigConnection {
	host?: string;
	port?: number;
	user?: string;
	database?: string;
	filename?: string;
	password?: string;
}

export interface KnexDatabaseConfig {
	client: string;
	connection: DbConfigConnection;
	useNullAsDefault?: boolean;
	asyncStackTraces?: boolean;
}

export interface ConnectionCheckResult {
	isCreated: boolean;
	error: any;
	latestMigration: any;
	connection: DbConnection;
}

export interface Migration {
	name: string;
	done: boolean;
}

export function makeKnexConfig(dbConfig: DatabaseConfig): KnexDatabaseConfig {
	const connection: DbConfigConnection = {};

	if (dbConfig.client === 'sqlite3') {
		connection.filename = dbConfig.name;
	} else {
		connection.database = dbConfig.name;
		connection.host = dbConfig.host;
		connection.port = dbConfig.port;
		connection.user = dbConfig.user;
		connection.password = dbConfig.password;
	}

	return {
		client: dbConfig.client,
		useNullAsDefault: dbConfig.client === 'sqlite3',
		asyncStackTraces: dbConfig.asyncStackTraces,
		connection,
	};
}

export async function waitForConnection(dbConfig: DatabaseConfig): Promise<ConnectionCheckResult> {
	const timeout = 30000;
	const startTime = Date.now();
	let lastError = { message: '' };

	while (true) {
		try {
			const connection = await connectDb(dbConfig);
			const check = await connectionCheck(connection);
			if (check.error) throw check.error;
			return check;
		} catch (error) {
			logger.info('Could not connect. Will try again.', error.message);
			lastError = error;
		}

		if (Date.now() - startTime > timeout) {
			logger.error('Timeout trying to connect to database:', lastError);
			throw new Error(`Timeout trying to connect to database. Last error was: ${lastError.message}`);
		}

		await time.msleep(1000);
	}
}

function makeSlowQueryHandler(duration: number, connection: any, sql: string, bindings: any[]) {
	return setTimeout(() => {
		try {
			logger.warn(`Slow query (${duration}ms+):`, connection.raw(sql, bindings).toString());
		} catch (error) {
			logger.error('Could not log slow query', { sql, bindings }, error);
		}
	}, duration);
}

export function setupSlowQueryLog(connection: DbConnection, slowQueryLogMinDuration: number) {
	interface QueryInfo {
		timeoutId: any;
		startTime: number;
	}

	const queryInfos: Record<any, QueryInfo> = {};

	connection.on('query', (data) => {
		const timeoutId = makeSlowQueryHandler(slowQueryLogMinDuration, connection, data.sql, data.bindings);

		queryInfos[data.__knexQueryUid] = {
			timeoutId,
			startTime: Date.now(),
		};
	});

	connection.on('query-response', (_response, data) => {
		const q = queryInfos[data.__knexQueryUid];
		if (q) {
			clearTimeout(q.timeoutId);
			delete queryInfos[data.__knexQueryUid];
		}
	});

	connection.on('query-error', (_response, data) => {
		const q = queryInfos[data.__knexQueryUid];
		if (q) {
			clearTimeout(q.timeoutId);
			delete queryInfos[data.__knexQueryUid];
		}
	});
}

export async function connectDb(dbConfig: DatabaseConfig): Promise<DbConnection> {
	const connection = knex(makeKnexConfig(dbConfig));

	if (dbConfig.slowQueryLogEnabled) {
		setupSlowQueryLog(connection, dbConfig.slowQueryLogMinDuration);
	}

	return connection;
}

export async function disconnectDb(db: DbConnection) {
	await db.destroy();
}

export async function migrateLatest(db: DbConnection) {
	await db.migrate.latest({
		directory: migrationDir,
	});
}

export async function migrateUp(db: DbConnection) {
	await db.migrate.up({
		directory: migrationDir,
	});
}

export async function migrateDown(db: DbConnection) {
	await db.migrate.down({
		directory: migrationDir,
	});
}

export async function migrateList(db: DbConnection, asString: boolean = true) {
	const migrations: any = await db.migrate.list({
		directory: migrationDir,
	});

	// The migration array has a rather inconsistent format:
	//
	// [
	//   // Done migrations
	//   [
	//     '20210809222118_email_key_fix.js',
	//     '20210814123815_testing.js',
	//     '20210814123816_testing.js'
	//   ],
	//   // Not done migrations
	//   [
	//     {
	//       file: '20210814123817_testing.js',
	//       directory: '/path/to/packages/server/dist/migrations'
	//     }
	//   ]
	// ]

	const formatName = (migrationInfo: any) => {
		const name = migrationInfo.file ? migrationInfo.file : migrationInfo;

		const s = name.split('.');
		s.pop();
		return s.join('.');
	};

	const output: Migration[] = [];

	for (const s of migrations[0]) {
		output.push({
			name: formatName(s),
			done: true,
		});
	}

	for (const s of migrations[1]) {
		output.push({
			name: formatName(s),
			done: false,
		});
	}

	output.sort((a, b) => {
		return a.name < b.name ? -1 : +1;
	});

	if (!asString) return output;

	return output.map(l => `${l.done ? '✓' : '✗'} ${l.name}`).join('\n');
}

export async function nextMigration(db: DbConnection): Promise<string> {
	const list = await migrateList(db, false) as Migration[];

	let nextMigration: Migration = null;

	while (list.length) {
		const migration = list.pop();
		if (migration.done) return nextMigration ? nextMigration.name : '';
		nextMigration = migration;
	}

	return '';
}

function allTableNames(): string[] {
	const tableNames = Object.keys(databaseSchema);
	tableNames.push('knex_migrations');
	tableNames.push('knex_migrations_lock');
	return tableNames;
}

export async function dropTables(db: DbConnection): Promise<void> {
	for (const tableName of allTableNames()) {
		try {
			await db.schema.dropTable(tableName);
		} catch (error) {
			if (isNoSuchTableError(error)) continue;
			throw error;
		}
	}
}

export async function truncateTables(db: DbConnection): Promise<void> {
	for (const tableName of allTableNames()) {
		try {
			await db(tableName).truncate();
		} catch (error) {
			if (isNoSuchTableError(error)) continue;
			throw error;
		}
	}
}

function isNoSuchTableError(error: any): boolean {
	if (error) {
		// Postgres error: 42P01: undefined_table
		if (error.code === '42P01') return true;

		// Sqlite3 error
		if (error.message && error.message.includes('SQLITE_ERROR: no such table:')) return true;
	}

	return false;
}

export function isUniqueConstraintError(error: any): boolean {
	if (error) {
		// Postgres error: 23505: unique_violation
		if (error.code === '23505') return true;

		// Sqlite3 error
		if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint')) return true;
	}

	return false;
}

export async function latestMigration(db: DbConnection): Promise<any> {
	try {
		const result = await db('knex_migrations').select('name').orderBy('id', 'asc').first();
		return result;
	} catch (error) {
		// If the database has never been initialized, we return null, so
		// for this we need to check the error code, which will be
		// different depending on the DBMS.

		if (isNoSuchTableError(error)) return null;

		throw error;
	}
}

export async function connectionCheck(db: DbConnection): Promise<ConnectionCheckResult> {
	try {
		const result = await latestMigration(db);
		return {
			latestMigration: result,
			isCreated: !!result,
			error: null,
			connection: db,
		};
	} catch (error) {
		return {
			latestMigration: null,
			isCreated: false,
			error: error,
			connection: null,
		};
	}
}
