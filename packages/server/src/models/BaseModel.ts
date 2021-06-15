import { WithDates, WithUuid, databaseSchema, DbConnection, ItemType, Uuid, User } from '../db';
import TransactionHandler from '../utils/TransactionHandler';
import uuidgen from '../utils/uuidgen';
import { ErrorUnprocessableEntity, ErrorBadRequest } from '../utils/errors';
import { Models } from './factory';
import * as EventEmitter from 'events';
import { Config } from '../utils/types';
import personalizedUserContentBaseUrl from '@joplin/lib/services/joplinServer/personalizedUserContentBaseUrl';

export interface SaveOptions {
	isNew?: boolean;
	skipValidation?: boolean;
	validationRules?: any;
	previousItem?: any;
}

export interface LoadOptions {
	fields?: string[];
}

export interface DeleteOptions {
	validationRules?: any;
	allowNoOp?: boolean;
	deletedItemUserIds?: Record<Uuid, Uuid[]>;
}

export interface ValidateOptions {
	isNew?: boolean;
	rules?: any;
}

export enum AclAction {
	Create = 1,
	Read = 2,
	Update = 3,
	Delete = 4,
	List = 5,
}

export default abstract class BaseModel<T> {

	private defaultFields_: string[] = [];
	private db_: DbConnection;
	private transactionHandler_: TransactionHandler;
	private modelFactory_: Function;
	private static eventEmitter_: EventEmitter = null;
	private config_: Config;

	public constructor(db: DbConnection, modelFactory: Function, config: Config) {
		this.db_ = db;
		this.modelFactory_ = modelFactory;
		this.config_ = config;

		this.transactionHandler_ = new TransactionHandler(db);
	}

	// When a model create an instance of another model, the active
	// connection is passed to it. That connection can be the regular db
	// connection, or the active transaction.
	protected models(db: DbConnection = null): Models {
		return this.modelFactory_(db || this.db, this.config_);
	}

	protected get baseUrl(): string {
		return this.config_.baseUrl;
	}

	protected get userContentBaseUrl(): string {
		return this.config_.userContentBaseUrl;
	}

	protected personalizedUserContentBaseUrl(userId: Uuid): string {
		return personalizedUserContentBaseUrl(userId, this.baseUrl, this.userContentBaseUrl);
	}

	protected get appName(): string {
		return this.config_.appName;
	}

	protected get db(): DbConnection {
		if (this.transactionHandler_.activeTransaction) return this.transactionHandler_.activeTransaction;
		return this.db_;
	}

	protected get defaultFields(): string[] {
		if (!this.defaultFields_.length) {
			this.defaultFields_ = Object.keys(databaseSchema[this.tableName]);
		}
		return this.defaultFields_.slice();
	}

	public static get eventEmitter(): EventEmitter {
		if (!this.eventEmitter_) {
			this.eventEmitter_ = new EventEmitter();
		}
		return this.eventEmitter_;
	}

	public async checkIfAllowed(_user: User, _action: AclAction, _resource: T = null): Promise<void> {
		throw new Error('Must be overriden');
	}

	protected selectFields(options: LoadOptions, defaultFields: string[] = null, mainTable: string = ''): string[] {
		let output: string[] = [];
		if (options && options.fields) {
			output = options.fields;
		} else if (defaultFields) {
			output = defaultFields;
		} else {
			output = this.defaultFields;
		}

		if (mainTable) {
			output = output.map(f => {
				if (f.includes(`${mainTable}.`)) return f;
				return `${mainTable}.${f}`;
			});
		}

		return output;
	}

	protected get tableName(): string {
		throw new Error('Not implemented');
	}

	protected get itemType(): ItemType {
		throw new Error('Not implemented');
	}

	protected hasUuid(): boolean {
		return true;
	}

	protected autoTimestampEnabled(): boolean {
		return true;
	}

	protected get hasParentId(): boolean {
		return false;
	}

	// When using withTransaction, make sure any database call uses an instance
	// of `this.db()` that was accessed within the `fn` callback, otherwise the
	// transaction will be stuck!
	//
	// This for example, would result in a stuck transaction:
	//
	// const query = this.db(this.tableName).where('id', '=', id);
	//
	// this.withTransaction(async () => {
	//     await query.delete();
	// });
	//
	// This is because withTransaction is going to swap the value of "this.db()"
	// for as long as the transaction is active. So if the query is started
	// outside the transaction, it will use the regular db connection and wait
	// for the newly created transaction to finish, which will never happen.
	//
	// This is a bit of a leaky abstraction, which ideally should be improved
	// but for now one just has to be aware of the caveat.
	//
	// The `name` argument is only for debugging, so that any stuck transaction
	// can be more easily identified.
	protected async withTransaction<T>(fn: Function, name: string = null): Promise<T> {
		const debugTransaction = false;

		const debugTimerId = debugTransaction ? setTimeout(() => {
			console.info('Transaction did not complete:', name, txIndex);
		}, 5000) : null;

		const txIndex = await this.transactionHandler_.start();

		if (debugTransaction) console.info('START', name, txIndex);

		let output: T = null;

		try {
			output = await fn();
		} catch (error) {
			await this.transactionHandler_.rollback(txIndex);

			if (debugTransaction) {
				console.info('ROLLBACK', name, txIndex);
				clearTimeout(debugTimerId);
			}

			throw error;
		}

		if (debugTransaction) {
			console.info('COMMIT', name, txIndex);
			clearTimeout(debugTimerId);
		}

		await this.transactionHandler_.commit(txIndex);
		return output;
	}

	public async all(options: LoadOptions = {}): Promise<T[]> {
		const rows: any[] = await this.db(this.tableName).select(this.selectFields(options));
		return rows as T[];
	}

	public fromApiInput(object: T): T {
		const blackList = ['updated_time', 'created_time', 'owner_id'];
		const whiteList = Object.keys(databaseSchema[this.tableName]);
		const output: any = { ...object };

		for (const f in object) {
			if (blackList.includes(f)) delete output[f];
			if (!whiteList.includes(f)) delete output[f];
		}

		return output;
	}

	protected objectToApiOutput(object: T): T {
		return { ...object };
	}

	public toApiOutput(object: T | T[]): T | T[] {
		if (Array.isArray(object)) {
			return object.map(f => this.objectToApiOutput(f));
		} else {
			return this.objectToApiOutput(object);
		}
	}

	protected async validate(object: T, options: ValidateOptions = {}): Promise<T> {
		if (!options.isNew && !(object as WithUuid).id) throw new ErrorUnprocessableEntity('id is missing');
		return object;
	}

	protected async isNew(object: T, options: SaveOptions): Promise<boolean> {
		if (options.isNew === false) return false;
		if (options.isNew === true) return true;
		if ('id' in object && !(object as WithUuid).id) throw new Error('ID cannot be undefined or null');
		return !(object as WithUuid).id;
	}

	public async save(object: T, options: SaveOptions = {}): Promise<T> {
		if (!object) throw new Error('Object cannot be empty');

		const toSave = Object.assign({}, object);

		const isNew = await this.isNew(object, options);

		if (this.hasUuid() && isNew && !(toSave as WithUuid).id) {
			(toSave as WithUuid).id = uuidgen();
		}

		if (this.autoTimestampEnabled()) {
			const timestamp = Date.now();
			if (isNew) {
				(toSave as WithDates).created_time = timestamp;
			}
			(toSave as WithDates).updated_time = timestamp;
		}

		if (options.skipValidation !== true) object = await this.validate(object, { isNew: isNew, rules: options.validationRules ? options.validationRules : {} });

		await this.withTransaction(async () => {
			if (isNew) {
				await this.db(this.tableName).insert(toSave);
			} else {
				const objectId: string = (toSave as WithUuid).id;
				if (!objectId) throw new Error('Missing "id" property');
				delete (toSave as WithUuid).id;
				const updatedCount: number = await this.db(this.tableName).update(toSave).where({ id: objectId });
				(toSave as WithUuid).id = objectId;

				// Sanity check:
				if (updatedCount !== 1) throw new ErrorBadRequest(`one row should have been updated, but ${updatedCount} row(s) were updated`);
			}
		}, 'BaseModel::save');

		return toSave;
	}

	public async loadByIds(ids: string[], options: LoadOptions = {}): Promise<T[]> {
		if (!ids.length) return [];
		return this.db(this.tableName).select(options.fields || this.defaultFields).whereIn('id', ids);
	}

	public async exists(id: string): Promise<boolean> {
		const o = await this.load(id, { fields: ['id'] });
		return !!o;
	}

	public async load(id: string, options: LoadOptions = {}): Promise<T> {
		if (!id) throw new Error('id cannot be empty');

		return this.db(this.tableName).select(options.fields || this.defaultFields).where({ id: id }).first();
	}

	public async delete(id: string | string[] | number | number[], options: DeleteOptions = {}): Promise<void> {
		if (!id) throw new Error('id cannot be empty');

		const ids = (typeof id === 'string' || typeof id === 'number') ? [id] : id;

		if (!ids.length) throw new Error('no id provided');

		await this.withTransaction(async () => {
			const query = this.db(this.tableName).where({ id: ids[0] });
			for (let i = 1; i < ids.length; i++) {
				await query.orWhere({ id: ids[i] });
			}

			const deletedCount = await query.del();
			if (!options.allowNoOp && deletedCount !== ids.length) throw new Error(`${ids.length} row(s) should have been deleted but ${deletedCount} row(s) were deleted`);
		}, 'BaseModel::delete');
	}

}
