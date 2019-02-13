require('app-module-path').addPath(__dirname);

const { time } = require('lib/time-utils.js');
const { asyncTest, fileContentEqual, setupDatabase, setupDatabaseAndSynchronizer, db, synchronizer, fileApi, sleep, clearDatabase, switchClient, syncTargetId, objectsEqual, checkThrowAsync } = require('test-utils.js');
const Folder = require('lib/models/Folder.js');
const Note = require('lib/models/Note.js');
const NoteTag = require('lib/models/NoteTag.js');
const Tag = require('lib/models/Tag.js');
const BaseModel = require('lib/BaseModel.js');
const { shim } = require('lib/shim');

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

describe('models_Tag', function() {

	beforeEach(async (done) => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
		done();
	});

	it('should add tags by title', asyncTest(async () => {
		let folder1 = await Folder.save({ title: "folder1" });
		let note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });

		await Tag.setNoteTagsByTitles(note1.id, ['un', 'deux']);

		const noteTags = await Tag.tagsByNoteId(note1.id);
		expect(noteTags.length).toBe(2);
	}));

	it('should not allow renaming tag to existing tag names', asyncTest(async () => {
		let folder1 = await Folder.save({ title: "folder1" });
		let note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });

		await Tag.setNoteTagsByTitles(note1.id, ['un', 'deux']);

		const tagUn = await Tag.loadByTitle('un');
		const hasThrown = await checkThrowAsync(async () => await Tag.save({ id: tagUn.id, title: 'deux' }, { userSideValidation: true }));

		expect(hasThrown).toBe(true);
	}));

	it('should not return tags without notes', asyncTest(async () => {
		let folder1 = await Folder.save({ title: "folder1" });
		let note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		await Tag.setNoteTagsByTitles(note1.id, ['un']);

		let tags = await Tag.allWithNotes();
		expect(tags.length).toBe(1);

		await Note.delete(note1.id);

		tags = await Tag.allWithNotes();
		expect(tags.length).toBe(0);
	}));

});