/* eslint-disable no-unused-vars */
const { setupDatabaseAndSynchronizer, switchClient, asyncTest, createNTestFolders, createNTestNotes, createNTestTags, TestApp } = require('./test-utils.js');
const Setting = require('@joplinapp/lib/models/Setting').default;
const Folder = require('@joplinapp/lib/models/Folder.js');
const Note = require('@joplinapp/lib/models/Note.js');
const Tag = require('@joplinapp/lib/models/Tag.js');
const time = require('@joplinapp/lib/time').default;

let testApp = null;

describe('integration_TagList', function() {

	beforeEach(async (done) => {
		testApp = new TestApp();
		await testApp.start(['--no-welcome']);
		done();
	});

	afterEach(async (done) => {
		if (testApp !== null) await testApp.destroy();
		testApp = null;
		done();
	});

	// the tag list should be cleared if the next note has no tags
	it('should clear tag list when a note is deleted', asyncTest(async () => {
		// setup and select the note
		const folders = await createNTestFolders(1);
		const notes = await createNTestNotes(5, folders[0]);
		const tags = await createNTestTags(3);
		await testApp.wait();

		await Tag.addNote(tags[2].id, notes[2].id);
		await testApp.wait();

		testApp.dispatch({ type: 'FOLDER_SELECT', id: folders[0].id });
		await testApp.wait();

		testApp.dispatch({ type: 'NOTE_SELECT',	id: notes[2].id });
		await testApp.wait();

		// check the tag list is correct
		let state = testApp.store().getState();
		expect(state.selectedNoteTags.length).toEqual(1);
		expect(state.selectedNoteTags[0].id).toEqual(tags[2].id);

		// delete the note
		testApp.dispatch({ type: 'NOTE_DELETE',	id: notes[2].id });
		await testApp.wait();

		// check the tag list is updated
		state = testApp.store().getState();
		expect(state.selectedNoteTags.length).toEqual(0);
	}));

	// the tag list should be updated if the next note has tags
	it('should update tag list when a note is deleted', asyncTest(async () => {
		// set up and select the note
		const folders = await createNTestFolders(1);
		const notes = await createNTestNotes(5, folders[0]);
		const tags = await createNTestTags(3);
		await testApp.wait();

		await Tag.addNote(tags[1].id, notes[1].id);
		await Tag.addNote(tags[0].id, notes[0].id);
		await Tag.addNote(tags[2].id, notes[0].id);
		await testApp.wait();

		testApp.dispatch({ type: 'FOLDER_SELECT', id: folders[0].id });
		await testApp.wait();

		testApp.dispatch({ type: 'NOTE_SELECT', id: notes[1].id	});
		await testApp.wait();

		// check the tag list is correct
		let state = testApp.store().getState();
		expect(state.selectedNoteTags.length).toEqual(1);
		expect(state.selectedNoteTags[0].id).toEqual(tags[1].id);

		// delete the note
		testApp.dispatch({ type: 'NOTE_DELETE',	id: notes[1].id });
		await testApp.wait();

		// check the tag list is updated
		state = testApp.store().getState();
		const tagIds = state.selectedNoteTags.map(n => n.id).sort();
		const expectedTagIds = [tags[0].id, tags[2].id].sort();
		expect(state.selectedNoteTags.length).toEqual(2);
		expect(tagIds).toEqual(expectedTagIds);
	}));
});
