import BaseModel, { SaveOptions, LoadOptions, DeleteOptions, ValidateOptions, AclAction } from './BaseModel';
import { ItemType, databaseSchema, Uuid, Item, ShareType, Share, ChangeType, User, UserItem } from '../services/database/types';
import { defaultPagination, paginateDbQuery, PaginatedResults, Pagination } from './utils/pagination';
import { isJoplinItemName, isJoplinResourceBlobPath, linkedResourceIds, serializeJoplinItem, unserializeJoplinItem } from '../utils/joplinUtils';
import { ModelType } from '@joplin/lib/BaseModel';
import { ApiError, ErrorForbidden, ErrorUnprocessableEntity } from '../utils/errors';
import { Knex } from 'knex';
import { ChangePreviousItem } from './ChangeModel';
import { unique } from '../utils/array';
import StorageDriverBase, { Context } from './items/storage/StorageDriverBase';
import { DbConnection, returningSupported } from '../db';
import { Config, StorageDriverConfig, StorageDriverMode } from '../utils/types';
import { NewModelFactoryHandler } from './factory';
import loadStorageDriver from './items/storage/loadStorageDriver';
import { msleep } from '../utils/time';
import Logger from '@joplin/lib/Logger';

const mimeUtils = require('@joplin/lib/mime-utils.js').mime;

// Converts "root:/myfile.txt:" to "myfile.txt"
const extractNameRegex = /^root:\/(.*):$/;

export interface ImportContentToStorageOptions {
	batchSize?: number;
	logger?: Logger;
}

export interface SaveFromRawContentItem {
	name: string;
	body: Buffer;
}

export interface SaveFromRawContentResultItem {
	item: Item;
	error: any;
}

export type SaveFromRawContentResult = Record<string, SaveFromRawContentResultItem>;

export interface PaginatedItems extends PaginatedResults {
	items: Item[];
}

export interface SharedRootInfo {
	item: Item;
	share: Share;
}

export interface ItemSaveOption extends SaveOptions {
	shareId?: Uuid;
}

export interface ItemLoadOptions extends LoadOptions {
	withContent?: boolean;
}

export default class ItemModel extends BaseModel<Item> {

	private updatingTotalSizes_: boolean = false;
	private storageDriverConfig_: StorageDriverConfig;
	private storageDriverConfigFallback_: StorageDriverConfig;

	private static storageDrivers_: Map<StorageDriverConfig, StorageDriverBase> = new Map();

	public constructor(db: DbConnection, modelFactory: NewModelFactoryHandler, config: Config) {
		super(db, modelFactory, config);

		this.storageDriverConfig_ = config.storageDriver;
		this.storageDriverConfigFallback_ = config.storageDriverFallback;
	}

	protected get tableName(): string {
		return 'items';
	}

	protected get itemType(): ItemType {
		return ItemType.Item;
	}

	protected get hasParentId(): boolean {
		return false;
	}

	protected get defaultFields(): string[] {
		return Object.keys(databaseSchema[this.tableName]).filter(f => f !== 'content');
	}

	private async loadStorageDriver(config: StorageDriverConfig): Promise<StorageDriverBase> {
		let driver = ItemModel.storageDrivers_.get(config);

		if (!driver) {
			driver = await loadStorageDriver(config, this.db);
			ItemModel.storageDrivers_.set(config, driver);
		}

		return driver;
	}

	public async storageDriver(): Promise<StorageDriverBase> {
		return this.loadStorageDriver(this.storageDriverConfig_);
	}

	public async storageDriverFallback(): Promise<StorageDriverBase> {
		if (!this.storageDriverConfigFallback_) return null;
		return this.loadStorageDriver(this.storageDriverConfigFallback_);
	}

	public async checkIfAllowed(user: User, action: AclAction, resource: Item = null): Promise<void> {
		if (action === AclAction.Create) {
			if (!(await this.models().shareUser().isShareParticipant(resource.jop_share_id, user.id))) throw new ErrorForbidden('user has no access to this share');
		}

		// if (action === AclAction.Delete) {
		// 	const share = await this.models().share().byItemId(resource.id);
		// 	if (share && share.type === ShareType.JoplinRootFolder) {
		// 		if (user.id !== share.owner_id) throw new ErrorForbidden('only the owner of the shared notebook can delete it');
		// 	}
		// }
	}

	public fromApiInput(item: Item): Item {
		const output: Item = {};

		if ('id' in item) item.id = output.id;
		if ('name' in item) item.name = output.name;
		if ('mime_type' in item) item.mime_type = output.mime_type;

		return output;
	}

	protected objectToApiOutput(object: Item): Item {
		const output: Item = {};
		const propNames = ['id', 'name', 'updated_time', 'created_time'];
		for (const k of Object.keys(object)) {
			if (propNames.includes(k)) (output as any)[k] = (object as any)[k];
		}
		return output;
	}

	public async userHasItem(userId: Uuid, itemId: Uuid): Promise<boolean> {
		const r = await this
			.db('user_items')
			.select('user_items.id')
			.where('user_items.user_id', '=', userId)
			.where('user_items.item_id', '=', itemId)
			.first();
		return !!r;
	}

	// Remove first and last colon from a path element
	public pathToName(path: string): string {
		if (path === 'root') return '';
		return path.replace(extractNameRegex, '$1');
	}

	public byShareIdQuery(shareId: Uuid, options: ItemLoadOptions = {}): Knex.QueryBuilder {
		return this
			.db('items')
			.select(this.selectFields(options, null, 'items'))
			.where('jop_share_id', '=', shareId);
	}

	public async byShareId(shareId: Uuid, options: ItemLoadOptions = {}): Promise<Item[]> {
		const query = this.byShareIdQuery(shareId, options);
		return await query;
	}

	private async storageDriverWrite(itemId: Uuid, content: Buffer, context: Context) {
		const storageDriver = await this.storageDriver();
		const storageDriverFallback = await this.storageDriverFallback();

		await storageDriver.write(itemId, content, context);

		if (storageDriverFallback) {
			if (storageDriverFallback.mode === StorageDriverMode.ReadWrite) {
				await storageDriverFallback.write(itemId, content, context);
			} else if (storageDriverFallback.mode === StorageDriverMode.ReadOnly) {
				await storageDriverFallback.write(itemId, Buffer.from(''), context);
			} else {
				throw new Error(`Unsupported fallback mode: ${storageDriverFallback.mode}`);
			}
		}
	}

	private async storageDriverRead(itemId: Uuid, context: Context) {
		const storageDriver = await this.storageDriver();
		const storageDriverFallback = await this.storageDriverFallback();

		if (await storageDriver.exists(itemId, context)) {
			return storageDriver.read(itemId, context);
		} else {
			if (!storageDriverFallback) throw new Error(`Content does not exist but fallback content driver is not defined: ${itemId}`);
			return storageDriverFallback.read(itemId, context);
		}
	}

	public async loadByJopIds(userId: Uuid | Uuid[], jopIds: string[], options: ItemLoadOptions = {}): Promise<Item[]> {
		if (!jopIds.length) return [];

		const userIds = Array.isArray(userId) ? userId : [userId];
		if (!userIds.length) return [];

		const rows: Item[] = await this
			.db('user_items')
			.leftJoin('items', 'items.id', 'user_items.item_id')
			.distinct(this.selectFields(options, null, 'items'))
			.whereIn('user_items.user_id', userIds)
			.whereIn('jop_id', jopIds);

		if (options.withContent) {
			for (const row of rows) {
				row.content = await this.storageDriverRead(row.id, { models: this.models() });
			}
		}

		return rows;
	}

	public async loadByJopId(userId: Uuid, jopId: string, options: ItemLoadOptions = {}): Promise<Item> {
		const items = await this.loadByJopIds(userId, [jopId], options);
		return items.length ? items[0] : null;
	}

	public async loadByNames(userId: Uuid | Uuid[], names: string[], options: ItemLoadOptions = {}): Promise<Item[]> {
		if (!names.length) return [];

		const userIds = Array.isArray(userId) ? userId : [userId];

		const rows: Item[] = await this
			.db('user_items')
			.leftJoin('items', 'items.id', 'user_items.item_id')
			.distinct(this.selectFields(options, null, 'items'))
			.whereIn('user_items.user_id', userIds)
			.whereIn('name', names);

		if (options.withContent) {
			for (const row of rows) {
				row.content = await this.storageDriverRead(row.id, { models: this.models() });
			}
		}

		return rows;
	}

	public async loadByName(userId: Uuid, name: string, options: ItemLoadOptions = {}): Promise<Item> {
		const items = await this.loadByNames(userId, [name], options);
		return items.length ? items[0] : null;
	}

	public async loadWithContent(id: Uuid, options: ItemLoadOptions = {}): Promise<Item> {
		const content = await this.storageDriverRead(id, { models: this.models() });

		return {
			...await this
				.db('user_items')
				.leftJoin('items', 'items.id', 'user_items.item_id')
				.select(this.selectFields(options, ['*'], 'items'))
				.where('items.id', '=', id)
				.first(),
			content,
		};
	}

	public async loadAsSerializedJoplinItem(id: Uuid): Promise<string> {
		return serializeJoplinItem(await this.loadAsJoplinItem(id));
	}

	public async serializedContent(item: Item | Uuid): Promise<Buffer> {
		item = typeof item === 'string' ? await this.loadWithContent(item) : item;

		if (item.jop_type > 0) {
			return Buffer.from(await serializeJoplinItem(this.itemToJoplinItem(item)));
		} else {
			return item.content;
		}
	}

	private async atomicMoveContent(item: Item, toDriver: StorageDriverBase, drivers: Record<number, StorageDriverBase>) {
		for (let i = 0; i < 10; i++) {
			let fromDriver: StorageDriverBase = drivers[item.content_storage_id];

			if (!fromDriver) {
				fromDriver = await loadStorageDriver(item.content_storage_id, this.db);
				drivers[item.content_storage_id] = fromDriver;
			}

			const content = await fromDriver.read(item.id, { models: this.models() });
			await toDriver.write(item.id, content, { models: this.models() });

			const updatedRows = await this
				.db(this.tableName)
				.where('id', '=', item.id)
				.where('updated_time', '=', item.updated_time) // Check that the row hasn't changed while we were transferring the content
				.update({ content_storage_id: toDriver.storageId }, returningSupported(this.db) ? ['id'] : undefined);

			if (!returningSupported(this.db) || updatedRows.length) return;

			await msleep(1000 + 1000 * i);
		}

		throw new Error(`Could not atomically update content for item: ${JSON.stringify(item)}`);
	}

	// Loop throught the items in the database and import their content to the
	// target storage. Only items not already in that storage will be processed.
	public async importContentToStorage(toStorageConfig: StorageDriverConfig, options: ImportContentToStorageOptions = null) {
		options = {
			batchSize: 1000,
			logger: new Logger(),
			...options,
		};

		const toStorageDriver = await this.loadStorageDriver(toStorageConfig);
		const fromDrivers: Record<number, StorageDriverBase> = {};

		const itemCount = (await this.db(this.tableName)
			.count('id', { as: 'total' })
			.where('content_storage_id', '!=', toStorageDriver.storageId)
			.first())['total'];

		let totalDone = 0;

		while (true) {
			const items: Item[] = await this
				.db(this.tableName)
				.select(['id', 'content_storage_id', 'updated_time'])
				.where('content_storage_id', '!=', toStorageDriver.storageId)
				.limit(options.batchSize);

			options.logger.info(`Processing items ${totalDone} / ${itemCount}`);

			if (!items.length) {
				options.logger.info(`All items have been processed. Total: ${totalDone}`);
				return;
			}

			for (const item of items) {
				await this.atomicMoveContent(item, toStorageDriver, fromDrivers);
			}

			totalDone += items.length;
		}
	}

	public async sharedFolderChildrenItems(shareUserIds: Uuid[], folderId: string, includeResources: boolean = true): Promise<Item[]> {
		if (!shareUserIds.length) throw new Error('User IDs must be specified');

		let output: Item[] = [];

		const folderAndNotes: Item[] = await this
			.db('user_items')
			.leftJoin('items', 'items.id', 'user_items.item_id')
			.distinct('items.id', 'items.jop_id', 'items.jop_type')
			.where('items.jop_parent_id', '=', folderId)
			.whereIn('user_items.user_id', shareUserIds)
			.whereIn('jop_type', [ModelType.Folder, ModelType.Note]);

		for (const item of folderAndNotes) {
			output.push(item);

			if (item.jop_type === ModelType.Folder) {
				const children = await this.sharedFolderChildrenItems(shareUserIds, item.jop_id, false);
				output = output.concat(children);
			}
		}

		if (includeResources) {
			const noteItemIds = output.filter(i => i.jop_type === ModelType.Note).map(i => i.id);

			const itemResourceIds = await this.models().itemResource().byItemIds(noteItemIds);

			for (const itemId in itemResourceIds) {
				// TODO: should be resources with that path, that belong to any of the share users
				const resourceItems = await this.models().item().loadByJopIds(shareUserIds, itemResourceIds[itemId]);

				for (const resourceItem of resourceItems) {
					output.push({
						id: resourceItem.id,
						jop_id: resourceItem.jop_id,
						jop_type: ModelType.Resource,
					});
				}
			}

			let allResourceIds: string[] = [];
			for (const itemId in itemResourceIds) {
				allResourceIds = allResourceIds.concat(itemResourceIds[itemId]);
			}
			// TODO: should be resources with that path, that belong to any of the share users
			const blobItems = await this.models().itemResource().blobItemsByResourceIds(shareUserIds, allResourceIds);
			for (const blobItem of blobItems) {
				output.push({
					id: blobItem.id,
					name: blobItem.name,
				});
			}
		}

		return output;
	}

	public itemToJoplinItem(itemRow: Item): any {
		if (itemRow.jop_type <= 0) throw new Error(`Not a Joplin item: ${itemRow.id}`);
		if (!itemRow.content) throw new Error('Item content is missing');
		const item = JSON.parse(itemRow.content.toString());

		item.id = itemRow.jop_id;
		item.parent_id = itemRow.jop_parent_id;
		item.share_id = itemRow.jop_share_id;
		item.type_ = itemRow.jop_type;
		item.encryption_applied = itemRow.jop_encryption_applied;
		item.updated_time = itemRow.jop_updated_time;

		return item;
	}

	public async loadAsJoplinItem(id: Uuid): Promise<any> {
		const raw = await this.loadWithContent(id);
		return this.itemToJoplinItem(raw);
	}

	public async saveFromRawContent(user: User, rawContentItems: SaveFromRawContentItem[] | SaveFromRawContentItem, options: ItemSaveOption = null): Promise<SaveFromRawContentResult> {
		options = options || {};

		if (!Array.isArray(rawContentItems)) rawContentItems = [rawContentItems];

		// In this function, first we process the input items, which may be
		// serialized Joplin items or actual buffers (for resources) and convert
		// them to database items. Once it's done those db items are saved in
		// batch at the end.

		interface ItemToProcess {
			item: Item;
			error: Error;
			resourceIds?: string[];
			isNote?: boolean;
			joplinItem?: any;
		}

		const existingItems = await this.loadByNames(user.id, rawContentItems.map(i => i.name));
		const itemsToProcess: Record<string, ItemToProcess> = {};

		for (const rawItem of rawContentItems) {
			try {
				const isJoplinItem = isJoplinItemName(rawItem.name);
				let isNote = false;

				const item: Item = {
					name: rawItem.name,
				};

				let joplinItem: any = null;

				let resourceIds: string[] = [];

				if (isJoplinItem) {
					joplinItem = await unserializeJoplinItem(rawItem.body.toString());
					isNote = joplinItem.type_ === ModelType.Note;
					resourceIds = isNote ? linkedResourceIds(joplinItem.body) : [];

					item.jop_id = joplinItem.id;
					item.jop_parent_id = joplinItem.parent_id || '';
					item.jop_type = joplinItem.type_;
					item.jop_encryption_applied = joplinItem.encryption_applied || 0;
					item.jop_share_id = joplinItem.share_id || '';
					item.jop_updated_time = joplinItem.updated_time;

					const joplinItemToSave = { ...joplinItem };

					delete joplinItemToSave.id;
					delete joplinItemToSave.parent_id;
					delete joplinItemToSave.share_id;
					delete joplinItemToSave.type_;
					delete joplinItemToSave.encryption_applied;
					delete joplinItemToSave.updated_time;

					item.content = Buffer.from(JSON.stringify(joplinItemToSave));
				} else {
					item.content = rawItem.body;
				}

				const existingItem = existingItems.find(i => i.name === rawItem.name);
				if (existingItem) item.id = existingItem.id;

				if (options.shareId) item.jop_share_id = options.shareId;

				await this.models().user().checkMaxItemSizeLimit(user, rawItem.body, item, joplinItem);

				itemsToProcess[rawItem.name] = {
					item: item,
					error: null,
					resourceIds,
					isNote,
					joplinItem,
				};
			} catch (error) {
				itemsToProcess[rawItem.name] = {
					item: null,
					error: error,
				};
			}
		}

		const output: SaveFromRawContentResult = {};

		await this.withTransaction(async () => {
			for (const name of Object.keys(itemsToProcess)) {
				const o = itemsToProcess[name];

				if (o.error) {
					output[name] = {
						item: null,
						error: o.error,
					};
					continue;
				}

				const itemToSave = { ...o.item };

				try {
					const content = itemToSave.content;
					delete itemToSave.content;

					itemToSave.content_storage_id = (await this.storageDriver()).storageId;

					itemToSave.content_size = content ? content.byteLength : 0;

					// Here we save the item row and content, and we want to
					// make sure that either both are saved or none of them.
					// This is done by setting up a save point before saving the
					// row, and rollbacking if the content cannot be saved.
					//
					// Normally, since we are in a transaction, throwing an
					// error should work, but since we catch all errors within
					// this block it doesn't work.

					// TODO: When an item is uploaded multiple times
					// simultaneously there could be a race condition, where the
					// content would not match the db row (for example, the
					// content_size would differ).
					//
					// Possible solutions:
					//
					// - Row-level lock on items.id, and release once the
					//   content is saved.
					// - Or external lock - eg. Redis.

					const savePoint = await this.setSavePoint();
					const savedItem = await this.saveForUser(user.id, itemToSave);

					try {
						await this.storageDriverWrite(savedItem.id, content, { models: this.models() });
						await this.releaseSavePoint(savePoint);
					} catch (error) {
						await this.rollbackSavePoint(savePoint);
						throw error;
					}

					if (o.isNote) {
						await this.models().itemResource().deleteByItemId(savedItem.id);
						await this.models().itemResource().addResourceIds(savedItem.id, o.resourceIds);
					}

					output[name] = {
						item: savedItem,
						error: null,
					};
				} catch (error) {
					output[name] = {
						item: null,
						error: error,
					};
				}
			}
		}, 'ItemModel::saveFromRawContent');

		return output;
	}

	protected async validate(item: Item, options: ValidateOptions = {}): Promise<Item> {
		if (options.isNew) {
			if (!item.name) throw new ErrorUnprocessableEntity('name cannot be empty');
		} else {
			if ('name' in item && !item.name) throw new ErrorUnprocessableEntity('name cannot be empty');
		}

		if (item.jop_share_id) {
			if (!(await this.models().share().exists(item.jop_share_id))) throw new ErrorUnprocessableEntity(`share not found: ${item.jop_share_id}`);
		}

		return super.validate(item, options);
	}


	private childrenQuery(userId: Uuid, pathQuery: string = '', count: boolean = false, options: ItemLoadOptions = {}): Knex.QueryBuilder {
		const query = this
			.db('user_items')
			.innerJoin('items', 'user_items.item_id', 'items.id')
			.where('user_items.user_id', '=', userId);

		if (count) {
			void query.countDistinct('items.id', { as: 'total' });
		} else {
			void query.select(this.selectFields(options, ['id', 'name', 'updated_time'], 'items'));
		}

		if (pathQuery) {
			// We support /* as a prefix only. Anywhere else would have
			// performance issue or requires a revert index.
			const sqlLike = pathQuery.replace(/\/\*$/g, '/%');
			void query.where('name', 'like', sqlLike);
		}

		return query;
	}

	public itemUrl(): string {
		return `${this.baseUrl}/items`;
	}

	public itemContentUrl(itemId: Uuid): string {
		return `${this.baseUrl}/items/${itemId}/content`;
	}

	public async children(userId: Uuid, pathQuery: string = '', pagination: Pagination = null, options: ItemLoadOptions = {}): Promise<PaginatedItems> {
		pagination = pagination || defaultPagination();
		const query = this.childrenQuery(userId, pathQuery, false, options);
		return paginateDbQuery(query, pagination, 'items');
	}

	public async childrenCount(userId: Uuid, pathQuery: string = ''): Promise<number> {
		const query = this.childrenQuery(userId, pathQuery, true);
		const r = await query.first();
		return r ? r.total : 0;
	}

	private async joplinItemPath(jopId: string): Promise<Item[]> {
		// Use Recursive Common Table Expression to find path to given item
		// https://www.sqlite.org/lang_with.html#recursivecte

		// with recursive paths(id, jop_id, jop_parent_id) as (
		//     select id, jop_id, jop_parent_id from items where jop_id = '000000000000000000000000000000F1'
		//     union
		//     select items.id, items.jop_id, items.jop_parent_id
		//     from items join paths where items.jop_id = paths.jop_parent_id
		// )
		// select id, jop_id, jop_parent_id from paths;

		return this.db.withRecursive('paths', (qb: Knex.QueryBuilder) => {
			void qb.select('id', 'jop_id', 'jop_parent_id')
				.from('items')
				.where('jop_id', '=', jopId)
				.whereIn('jop_type', [ModelType.Note, ModelType.Folder])

				.union((qb: Knex.QueryBuilder) => {
					void qb
						.select('items.id', 'items.jop_id', 'items.jop_parent_id')
						.from('items')
						.join('paths', 'items.jop_id', 'paths.jop_parent_id')
						.whereIn('jop_type', [ModelType.Note, ModelType.Folder]);
				});
		}).select('id', 'jop_id', 'jop_parent_id').from('paths');
	}

	// If the note or folder is within a shared folder, this function returns
	// that shared folder. It returns null otherwise.
	public async joplinItemSharedRootInfo(jopId: string): Promise<SharedRootInfo | null> {
		const path = await this.joplinItemPath(jopId);
		if (!path.length) throw new ApiError(`Cannot retrieve path for item: ${jopId}`, null, 'noPathForItem');
		const rootFolderItem = path[path.length - 1];
		const share = await this.models().share().itemShare(ShareType.Folder, rootFolderItem.id);
		if (!share) return null;

		return {
			item: await this.load(rootFolderItem.id),
			share,
		};
	}

	public async allForDebug(): Promise<any[]> {
		const items = await this.all({ fields: ['*'] });
		return items.map(i => {
			if (!i.content) return i;
			i.content = i.content.toString() as any;
			return i;
		});
	}

	public shouldRecordChange(itemName: string): boolean {
		if (isJoplinItemName(itemName)) return true;
		if (isJoplinResourceBlobPath(itemName)) return true;
		return false;
	}

	public isRootSharedFolder(item: Item): boolean {
		return item.jop_type === ModelType.Folder && item.jop_parent_id === '' && !!item.jop_share_id;
	}

	// Returns the item IDs that are owned only by the given user. In other
	// words, the items that are not shared with anyone else. Such items
	// can be safely deleted when the user is deleted.
	public async exclusivelyOwnedItemIds(userId: Uuid): Promise<Uuid[]> {
		const query = this
			.db('items')
			.select(this.db.raw('items.id, count(user_items.item_id) as user_item_count'))
			.leftJoin('user_items', 'user_items.item_id', 'items.id')
			.whereIn('items.id', this.db('user_items').select('user_items.item_id').where('user_id', '=', userId))
			.groupBy('items.id');

		const rows: any[] = await query;
		return rows.filter(r => r.user_item_count === 1).map(r => r.id);
	}

	public async deleteExclusivelyOwnedItems(userId: Uuid) {
		const itemIds = await this.exclusivelyOwnedItemIds(userId);
		await this.delete(itemIds);
	}

	public async deleteAll(userId: Uuid): Promise<void> {
		while (true) {
			const page = await this.children(userId, '', { ...defaultPagination(), limit: 1000 });
			await this.delete(page.items.map(c => c.id));
			if (!page.has_more) break;
		}
	}

	public async delete(id: string | string[], options: DeleteOptions = {}): Promise<void> {
		const ids = typeof id === 'string' ? [id] : id;
		if (!ids.length) return;

		const storageDriver = await this.storageDriver();
		const storageDriverFallback = await this.storageDriverFallback();

		const shares = await this.models().share().byItemIds(ids);

		await this.withTransaction(async () => {
			await this.models().share().delete(shares.map(s => s.id));
			await this.models().userItem().deleteByItemIds(ids);
			await this.models().itemResource().deleteByItemIds(ids);
			await storageDriver.delete(ids, { models: this.models() });
			if (storageDriverFallback) await storageDriverFallback.delete(ids, { models: this.models() });

			await super.delete(ids, options);
		}, 'ItemModel::delete');
	}

	public async deleteForUser(userId: Uuid, item: Item): Promise<void> {
		if (this.isRootSharedFolder(item)) {
			const share = await this.models().share().byItemId(item.id);
			if (!share) throw new Error(`Cannot find share associated with item ${item.id}`);
			const userShare = await this.models().shareUser().byShareAndUserId(share.id, userId);
			if (!userShare) return;
			await this.models().shareUser().delete(userShare.id);
		} else {
			await this.delete(item.id);
		}
	}

	public async makeTestItem(userId: Uuid, num: number) {
		return this.saveForUser(userId, {
			name: `${num.toString().padStart(32, '0')}.md`,
			content: Buffer.from(''),
		});
	}

	public async makeTestItems(userId: Uuid, count: number) {
		await this.withTransaction(async () => {
			for (let i = 1; i <= count; i++) {
				await this.saveForUser(userId, {
					name: `${i.toString().padStart(32, '0')}.md`,
					content: Buffer.from(''),
				});
			}
		}, 'ItemModel::makeTestItems');
	}

	// This method should be private because items should only be saved using
	// saveFromRawContent, which is going to deal with the content driver. But
	// since it's used in various test units, it's kept public for now.
	public async saveForUser(userId: Uuid, item: Item, options: SaveOptions = {}): Promise<Item> {
		if (!userId) throw new Error('userId is required');

		item = { ... item };
		const isNew = await this.isNew(item, options);

		let previousItem: ChangePreviousItem = null;

		if (item.content && !item.content_storage_id) {
			item.content_storage_id = (await this.storageDriver()).storageId;
		}

		if (isNew) {
			if (!item.mime_type) item.mime_type = mimeUtils.fromFilename(item.name) || '';
			if (!item.owner_id) item.owner_id = userId;
		} else {
			const beforeSaveItem = (await this.load(item.id, { fields: ['name', 'jop_type', 'jop_parent_id', 'jop_share_id'] }));
			const resourceIds = beforeSaveItem.jop_type === ModelType.Note ? await this.models().itemResource().byItemId(item.id) : [];

			previousItem = {
				jop_parent_id: beforeSaveItem.jop_parent_id,
				name: beforeSaveItem.name,
				jop_resource_ids: resourceIds,
				jop_share_id: beforeSaveItem.jop_share_id,
			};
		}

		return this.withTransaction(async () => {
			item = await super.save(item, options);

			if (isNew) await this.models().userItem().add(userId, item.id);

			// We only record updates. This because Create and Update events are
			// per user, whenever a user_item is created or deleted.
			const changeItemName = item.name || previousItem.name;

			if (!isNew && this.shouldRecordChange(changeItemName)) {
				await this.models().change().save({
					item_type: this.itemType,
					item_id: item.id,
					item_name: changeItemName,
					type: isNew ? ChangeType.Create : ChangeType.Update,
					previous_item: previousItem ? this.models().change().serializePreviousItem(previousItem) : '',
					user_id: userId,
				});
			}

			return item;
		}, 'ItemModel::saveForUser');
	}

	public async updateTotalSizes(): Promise<void> {
		interface TotalSizeRow {
			userId: Uuid;
			totalSize: number;
		}

		// Total sizes are updated once an hour, so unless there's something
		// very wrong this error shouldn't happen.
		if (this.updatingTotalSizes_) throw new Error('Already updating total sizes');

		this.updatingTotalSizes_ = true;

		const doneUserIds: Record<Uuid, boolean> = {};

		try {
			while (true) {
				const latestProcessedChange = await this.models().keyValue().value<string>('ItemModel::updateTotalSizes::latestProcessedChange');

				const paginatedChanges = await this.models().change().allFromId(latestProcessedChange || '');
				const changes = paginatedChanges.items;

				if (!changes.length) {
					// `allFromId()` may return empty pages when all items have
					// been deleted. In that case, we only save the cursor and
					// continue.
					await this.models().keyValue().setValue('ItemModel::updateTotalSizes::latestProcessedChange', paginatedChanges.cursor);
				} else {
					const itemIds: Uuid[] = unique(changes.map(c => c.item_id));
					const userItems: UserItem[] = await this.db('user_items').select('user_id').whereIn('item_id', itemIds);
					const userIds: Uuid[] = unique(
						userItems
							.map(u => u.user_id)
							.concat(changes.map(c => c.user_id))
					);

					const totalSizes: TotalSizeRow[] = [];
					for (const userId of userIds) {
						if (doneUserIds[userId]) continue;

						totalSizes.push({
							userId,
							totalSize: await this.calculateUserTotalSize(userId),
						});

						doneUserIds[userId] = true;
					}

					await this.withTransaction(async () => {
						for (const row of totalSizes) {
							await this.models().user().save({
								id: row.userId,
								total_item_size: row.totalSize,
							});
						}

						await this.models().keyValue().setValue('ItemModel::updateTotalSizes::latestProcessedChange', paginatedChanges.cursor);
					}, 'ItemModel::updateTotalSizes');
				}

				if (!paginatedChanges.has_more) break;
			}
		} finally {
			this.updatingTotalSizes_ = false;
		}
	}

	public async calculateUserTotalSize(userId: Uuid): Promise<number> {
		const result = await this.db('items')
			.sum('items.content_size', { as: 'total' })
			.leftJoin('user_items', 'items.id', 'user_items.item_id')
			.where('user_items.user_id', userId)
			.first();

		return result && result.total ? result.total : 0;
	}

	public async save(_item: Item, _options: SaveOptions = {}): Promise<Item> {
		throw new Error('Use saveForUser()');
		// return this.saveForUser('', item, options);
	}

}
