require('app-module-path').addPath(__dirname);

const { time } = require('lib/time-utils.js');
const { asyncTest, fileContentEqual, setupDatabase, setupDatabaseAndSynchronizer, db, synchronizer, fileApi, sleep, clearDatabase, switchClient, syncTargetId, objectsEqual, checkThrowAsync } = require('test-utils.js');
const Folder = require('lib/models/Folder.js');
const Note = require('lib/models/Note.js');
const BaseModel = require('lib/BaseModel.js');
const { shim } = require('lib/shim');

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

describe('models_Note', function() {

	beforeEach(async (done) => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
		done();
	});

	it('should find resource and note IDs', asyncTest(async () => {
		let folder1 = await Folder.save({ title: "folder1" });
		let note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		let note2 = await Note.save({ title: 'ma deuxième note', body: 'Lien vers première note : ' + Note.markdownTag(note1), parent_id: folder1.id });

		let items = await Note.linkedItems(note2.body);
		expect(items.length).toBe(1);
		expect(items[0].id).toBe(note1.id);

		await shim.attachFileToNote(note2, __dirname + '/../tests/support/photo.jpg');
		note2 = await Note.load(note2.id);
		items = await Note.linkedItems(note2.body);
		expect(items.length).toBe(2);
		expect(items[0].type_).toBe(BaseModel.TYPE_NOTE);
		expect(items[1].type_).toBe(BaseModel.TYPE_RESOURCE);
	}));

});