import fs from 'fs-extra';
import { JoplinDatabase } from 'lib/joplin-database.js';
import { DatabaseDriverNode } from 'lib/database-driver-node.js';
import { BaseModel } from 'lib/base-model.js';
import { Folder } from 'lib/models/folder.js';
import { Note } from 'lib/models/note.js';
import { Resource } from 'lib/models/resource.js';
import { Tag } from 'lib/models/tag.js';
import { NoteTag } from 'lib/models/note-tag.js';
import { Logger } from 'lib/logger.js';
import { Setting } from 'lib/models/setting.js';
import { BaseItem } from 'lib/models/base-item.js';
import { Synchronizer } from 'lib/synchronizer.js';
import { FileApi } from 'lib/file-api.js';
import { FileApiDriverMemory } from 'lib/file-api-driver-memory.js';
import { FileApiDriverLocal } from 'lib/file-api-driver-local.js';
import { FsDriverNode } from '../app/fs-driver-node.js';
import { time } from 'lib/time-utils.js';

let databases_ = [];
let synchronizers_ = [];
let fileApi_ = null;
let currentClient_ = 1;

const fsDriver = new FsDriverNode();
Logger.fsDriver_ = fsDriver;
Resource.fsDriver_ = fsDriver;

const logDir = __dirname + '/../tests/logs';
fs.mkdirpSync(logDir, 0o755);

const syncTargetId_ = Setting.SYNC_TARGET_MEMORY;
//const syncTargetId_ = Setting.SYNC_TARGET_FILESYSTEM;
//const syncTargetId_ = Setting.SYNC_TARGET_ONEDRIVE;
const syncDir = __dirname + '/../tests/sync';

const sleepTime = syncTargetId_ == Setting.SYNC_TARGET_FILESYSTEM ? 1001 : 400;

const logger = new Logger();
logger.addTarget('file', { path: logDir + '/log.txt' });
logger.setLevel(Logger.LEVEL_DEBUG);

BaseItem.loadClass('Note', Note);
BaseItem.loadClass('Folder', Folder);
BaseItem.loadClass('Resource', Resource);
BaseItem.loadClass('Tag', Tag);
BaseItem.loadClass('NoteTag', NoteTag);

Setting.setConstant('appId', 'net.cozic.joplin-cli');
Setting.setConstant('appType', 'cli');

function syncTargetId() {
	return syncTargetId_;
}

function sleep(n) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, Math.round(n * 1000));
	});
}

async function switchClient(id) {
	await time.msleep(sleepTime); // Always leave a little time so that updated_time properties don't overlap
	await Setting.saveAll();

	currentClient_ = id;
	BaseModel.db_ = databases_[id];
	Folder.db_ = databases_[id];
	Note.db_ = databases_[id];
	BaseItem.db_ = databases_[id];
	Setting.db_ = databases_[id];

	return Setting.load();
}

function clearDatabase(id = null) {
	if (id === null) id = currentClient_;

	let queries = [
		'DELETE FROM notes',
		'DELETE FROM folders',
		'DELETE FROM resources',
		'DELETE FROM tags',
		'DELETE FROM note_tags',
		
		'DELETE FROM deleted_items',
		'DELETE FROM sync_items',
	];

	return databases_[id].transactionExecBatch(queries);
}

function setupDatabase(id = null) {
	if (id === null) id = currentClient_;

	if (databases_[id]) {
		return clearDatabase(id).then(() => {
			return Setting.load();
		});
	}

	const filePath = __dirname + '/data/test-' + id + '.sqlite';
	return fs.unlink(filePath).catch(() => {
		// Don't care if the file doesn't exist
	}).then(() => {
		databases_[id] = new JoplinDatabase(new DatabaseDriverNode());
		// databases_[id].setLogger(logger);
		return databases_[id].open({ name: filePath }).then(() => {
			BaseModel.db_ = databases_[id];
			return setupDatabase(id);
		});
	});
}

async function setupDatabaseAndSynchronizer(id = null) {
	if (id === null) id = currentClient_;

	await setupDatabase(id);

	if (!synchronizers_[id]) {
		synchronizers_[id] = new Synchronizer(db(id), fileApi(), Setting.value('appType'));
		synchronizers_[id].setLogger(logger);
	}

	if (syncTargetId_ == Setting.SYNC_TARGET_FILESYSTEM) {
		fs.removeSync(syncDir)
		fs.mkdirpSync(syncDir, 0o755);
	} else {
		await fileApi().format();
	}
}

function db(id = null) {
	if (id === null) id = currentClient_;
	return databases_[id];
}

function synchronizer(id = null) {
	if (id === null) id = currentClient_;
	return synchronizers_[id];
}

function fileApi() {
	if (fileApi_) return fileApi_;

	if (syncTargetId_ == Setting.SYNC_TARGET_FILESYSTEM) {
		fs.removeSync(syncDir)
		fs.mkdirpSync(syncDir, 0o755);
		fileApi_ = new FileApi(syncDir, new FileApiDriverLocal());
	} else if (syncTargetId_ == Setting.SYNC_TARGET_MEMORY) {
		fileApi_ = new FileApi('/root', new FileApiDriverMemory());
		fileApi_.setLogger(logger);
	}
	// } else if (syncTargetId == Setting.SYNC_TARGET_ONEDRIVE) {
	// 	let auth = require('./onedrive-auth.json');
	// 	if (!auth) {
	// 		const oneDriveApiUtils = new OneDriveApiNodeUtils(oneDriveApi);
	// 		auth = await oneDriveApiUtils.oauthDance();
	// 		fs.writeFileSync('./onedrive-auth.json', JSON.stringify(auth));
	// 		process.exit(1);
	// 	} else {
	// 		auth = JSON.parse(auth);
	// 	}

	// 	// const oneDriveApiUtils = new OneDriveApiNodeUtils(reg.oneDriveApi());
	// 	// const auth = await oneDriveApiUtils.oauthDance(this);
	// 	// Setting.setValue('sync.3.auth', auth ? JSON.stringify(auth) : null);
	// 	// if (!auth) return;
	// }

	fileApi_.setLogger(logger);
	fileApi_.setSyncTargetId(syncTargetId_);
	return fileApi_;
}

export { setupDatabase, setupDatabaseAndSynchronizer, db, synchronizer, fileApi, sleep, clearDatabase, switchClient, syncTargetId };