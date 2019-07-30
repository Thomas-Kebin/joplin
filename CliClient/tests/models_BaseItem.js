/* eslint-disable no-unused-vars */

require('app-module-path').addPath(__dirname);

const { time } = require('lib/time-utils.js');
const { asyncTest, fileContentEqual, setupDatabase, setupDatabaseAndSynchronizer, db, synchronizer, fileApi, sleep, clearDatabase, switchClient, syncTargetId, objectsEqual, checkThrowAsync } = require('test-utils.js');
const Folder = require('lib/models/Folder.js');
const Note = require('lib/models/Note.js');
const BaseItem = require('lib/models/BaseItem.js');
const Resource = require('lib/models/Resource.js');
const BaseModel = require('lib/BaseModel.js');
const { shim } = require('lib/shim');

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

async function allItems() {
	let folders = await Folder.all();
	let notes = await Note.all();
	return folders.concat(notes);
}

describe('models_BaseItem', function() {

	beforeEach(async (done) => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
		done();
	});

	// it('should be able to exclude keys when syncing', asyncTest(async () => {
	// 	let folder1 = await Folder.save({ title: "folder1" });
	// 	let note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
	// 	await shim.attachFileToNote(note1, __dirname + '/../tests/support/photo.jpg');
	// 	let resource1 = (await Resource.all())[0];
	// 	console.info(await Resource.serializeForSync(resource1));
	// }));

	// This is to handle the case where a property is removed from a BaseItem table - in that case files in
	// the sync target will still have the old property but we don't need it locally.
	it('should ignore properties that are present in sync file but not in database when serialising', asyncTest(async () => {
		let folder = await Folder.save({ title: 'folder1' });

		let serialized = await Folder.serialize(folder);
		serialized += '\nignore_me: true';

		let unserialized = await Folder.unserialize(serialized);

		expect('ignore_me' in unserialized).toBe(false);
	}));

	it('should not modify title when unserializing', asyncTest(async () => {
		let folder1 = await Folder.save({ title: '' });
		let folder2 = await Folder.save({ title: 'folder1' });

		let serialized1 = await Folder.serialize(folder1);
		let unserialized1 = await Folder.unserialize(serialized1);

		expect(unserialized1.title).toBe(folder1.title);

		let serialized2 = await Folder.serialize(folder2);
		let unserialized2 = await Folder.unserialize(serialized2);

		expect(unserialized2.title).toBe(folder2.title);
	}));

});
