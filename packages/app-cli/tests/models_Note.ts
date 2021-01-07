import Setting from '@joplin/lib/models/Setting';
import BaseModel from '@joplin/lib/BaseModel';
import shim from '@joplin/lib/shim';
import markdownUtils from '@joplin/lib/markdownUtils';
const { sortedIds, createNTestNotes, setupDatabaseAndSynchronizer, switchClient, checkThrowAsync } = require('./test-utils.js');
const Folder = require('@joplin/lib/models/Folder.js');
const Note = require('@joplin/lib/models/Note.js');
const ArrayUtils = require('@joplin/lib/ArrayUtils.js');

async function allItems() {
	const folders = await Folder.all();
	const notes = await Note.all();
	return folders.concat(notes);
}

describe('models_Note', function() {
	beforeEach(async (done) => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
		done();
	});

	it('should find resource and note IDs', (async () => {
		const folder1 = await Folder.save({ title: 'folder1' });
		const note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		let note2 = await Note.save({ title: 'ma deuxième note', body: `Lien vers première note : ${Note.markdownTag(note1)}`, parent_id: folder1.id });

		let items = await Note.linkedItems(note2.body);
		expect(items.length).toBe(1);
		expect(items[0].id).toBe(note1.id);

		await shim.attachFileToNote(note2, `${__dirname}/../tests/support/photo.jpg`);
		note2 = await Note.load(note2.id);
		items = await Note.linkedItems(note2.body);
		expect(items.length).toBe(2);
		expect(items[0].type_).toBe(BaseModel.TYPE_NOTE);
		expect(items[1].type_).toBe(BaseModel.TYPE_RESOURCE);

		const resource2 = await shim.createResourceFromPath(`${__dirname}/../tests/support/photo.jpg`);
		const resource3 = await shim.createResourceFromPath(`${__dirname}/../tests/support/photo.jpg`);
		note2.body += `<img alt="bla" src=":/${resource2.id}"/>`;
		note2.body += `<img src=':/${resource3.id}' />`;
		items = await Note.linkedItems(note2.body);
		expect(items.length).toBe(4);
	}));

	it('should find linked items', (async () => {
		const testCases = [
			['[](:/06894e83b8f84d3d8cbe0f1587f9e226)', ['06894e83b8f84d3d8cbe0f1587f9e226']],
			['[](:/06894e83b8f84d3d8cbe0f1587f9e226) [](:/06894e83b8f84d3d8cbe0f1587f9e226)', ['06894e83b8f84d3d8cbe0f1587f9e226']],
			['[](:/06894e83b8f84d3d8cbe0f1587f9e226) [](:/06894e83b8f84d3d8cbe0f1587f9e227)', ['06894e83b8f84d3d8cbe0f1587f9e226', '06894e83b8f84d3d8cbe0f1587f9e227']],
			['[](:/06894e83b8f84d3d8cbe0f1587f9e226 "some title")', ['06894e83b8f84d3d8cbe0f1587f9e226']],
		];

		for (let i = 0; i < testCases.length; i++) {
			const t = testCases[i];

			const input = t[0];
			const expected = t[1];
			const actual = Note.linkedItemIds(input);
			const contentEquals = ArrayUtils.contentEquals(actual, expected);

			// console.info(contentEquals, input, expected, actual);

			expect(contentEquals).toBe(true);
		}
	}));

	it('should change the type of notes', (async () => {
		const folder1 = await Folder.save({ title: 'folder1' });
		let note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		note1 = await Note.load(note1.id);

		let changedNote = Note.changeNoteType(note1, 'todo');
		expect(changedNote === note1).toBe(false);
		expect(!!changedNote.is_todo).toBe(true);
		await Note.save(changedNote);

		note1 = await Note.load(note1.id);
		changedNote = Note.changeNoteType(note1, 'todo');
		expect(changedNote === note1).toBe(true);
		expect(!!changedNote.is_todo).toBe(true);

		note1 = await Note.load(note1.id);
		changedNote = Note.changeNoteType(note1, 'note');
		expect(changedNote === note1).toBe(false);
		expect(!!changedNote.is_todo).toBe(false);
	}));

	it('should serialize and unserialize without modifying data', (async () => {
		const folder1 = await Folder.save({ title: 'folder1' });
		const testCases = [
			[{ title: '', body: 'Body and no title\nSecond line\nThird Line', parent_id: folder1.id },
				'', 'Body and no title\nSecond line\nThird Line'],
			[{ title: 'Note title', body: 'Body and title', parent_id: folder1.id },
				'Note title', 'Body and title'],
			[{ title: 'Title and no body', body: '', parent_id: folder1.id },
				'Title and no body', ''],
		];

		for (let i = 0; i < testCases.length; i++) {
			const t = testCases[i];

			const input: any = t[0];

			const note1 = await Note.save(input);
			const serialized = await Note.serialize(note1);
			const unserialized = await Note.unserialize(serialized);

			expect(unserialized.title).toBe(input.title);
			expect(unserialized.body).toBe(input.body);
		}
	}));

	it('should reset fields for a duplicate', (async () => {
		const folder1 = await Folder.save({ title: 'folder1' });
		const note1 = await Note.save({ title: 'note', parent_id: folder1.id });

		const duplicatedNote = await Note.duplicate(note1.id);

		expect(duplicatedNote !== note1).toBe(true);
		expect(duplicatedNote.created_time !== note1.created_time).toBe(true);
		expect(duplicatedNote.updated_time !== note1.updated_time).toBe(true);
		expect(duplicatedNote.user_created_time !== note1.user_created_time).toBe(true);
		expect(duplicatedNote.user_updated_time !== note1.user_updated_time).toBe(true);
	}));

	it('should delete a set of notes', (async () => {
		const folder1 = await Folder.save({ title: 'folder1' });
		const noOfNotes = 20;
		await createNTestNotes(noOfNotes, folder1);

		const noteIds = await Folder.noteIds(folder1.id);
		await Note.batchDelete(noteIds);

		const all = await allItems();
		expect(all.length).toBe(1);
		expect(all[0].id).toBe(folder1.id);
	}));

	it('should delete only the selected notes', (async () => {
		const f1 = await Folder.save({ title: 'folder1' });
		const f2 = await Folder.save({ title: 'folder2', parent_id: f1.id });

		const noOfNotes = 20;
		await createNTestNotes(noOfNotes, f1, null, 'note1');
		await createNTestNotes(noOfNotes, f2, null, 'note1');

		const allBeforeDelete = await allItems();

		const notesInFolder1IDs = await Folder.noteIds(f1.id);
		const notesInFolder2IDs = await Folder.noteIds(f2.id);

		const notesToRemoveFromFolder1 = notesInFolder1IDs.slice(0, 6);
		const notesToRemoveFromFolder2 = notesInFolder2IDs.slice(11, 14);

		await Note.batchDelete(notesToRemoveFromFolder1);
		await Note.batchDelete(notesToRemoveFromFolder2);

		const allAfterDelete = await allItems();

		const expectedLength = allBeforeDelete.length - notesToRemoveFromFolder1.length - notesToRemoveFromFolder2.length;
		expect(allAfterDelete.length).toBe(expectedLength);

		// Common elements between the to-be-deleted notes and the notes and folders remaining after the delete
		const intersection = [...notesToRemoveFromFolder1, ...notesToRemoveFromFolder2].filter(x => allAfterDelete.includes(x));
		// Should be empty
		expect(intersection.length).toBe(0);
	}));

	it('should delete nothing', (async () => {
		const f1 = await Folder.save({ title: 'folder1' });
		const f2 = await Folder.save({ title: 'folder2', parent_id: f1.id });
		const f3 = await Folder.save({ title: 'folder3', parent_id: f2.id });
		const f4 = await Folder.save({ title: 'folder4', parent_id: f1.id });

		const noOfNotes = 20;
		await createNTestNotes(noOfNotes, f1, null, 'note1');
		await createNTestNotes(noOfNotes, f2, null, 'note2');
		await createNTestNotes(noOfNotes, f3, null, 'note3');
		await createNTestNotes(noOfNotes, f4, null, 'note4');

		const beforeDelete = await allItems();
		await Note.batchDelete([]);
		const afterDelete = await allItems();

		expect(sortedIds(afterDelete)).toEqual(sortedIds(beforeDelete));
	}));

	it('should not move to conflict folder', (async () => {
		const folder1 = await Folder.save({ title: 'Folder' });
		const folder2 = await Folder.save({ title: Folder.conflictFolderTitle(), id: Folder.conflictFolderId() });
		const note1 = await Note.save({ title: 'note', parent_id: folder1.id });

		const hasThrown = await checkThrowAsync(async () => await Folder.moveToFolder(note1.id, folder2.id));
		expect(hasThrown).toBe(true);

		const note = await Note.load(note1.id);
		expect(note.parent_id).toEqual(folder1.id);
	}));

	it('should not copy to conflict folder', (async () => {
		const folder1 = await Folder.save({ title: 'Folder' });
		const folder2 = await Folder.save({ title: Folder.conflictFolderTitle(), id: Folder.conflictFolderId() });
		const note1 = await Note.save({ title: 'note', parent_id: folder1.id });

		const hasThrown = await checkThrowAsync(async () => await Folder.copyToFolder(note1.id, folder2.id));
		expect(hasThrown).toBe(true);
	}));

	it('should convert resource paths from internal to external paths', (async () => {
		const resourceDirName = Setting.value('resourceDirName');
		const resourceDir = Setting.value('resourceDir');
		const r1 = await shim.createResourceFromPath(`${__dirname}/../tests/support/photo.jpg`);
		const r2 = await shim.createResourceFromPath(`${__dirname}/../tests/support/photo.jpg`);
		const r3 = await shim.createResourceFromPath(`${__dirname}/../tests/support/welcome.pdf`);
		const note1 = await Note.save({ title: 'note1' });
		const t1 = r1.updated_time;
		const t2 = r2.updated_time;

		const resourceDirE = markdownUtils.escapeLinkUrl(resourceDir);

		const testCases = [
			[
				false,
				'',
				'',
			],
			[
				true,
				'',
				'',
			],
			[
				false,
				`![](:/${r1.id})`,
				`![](${resourceDirName}/${r1.id}.jpg)`,
			],
			[
				false,
				`![](:/${r1.id}) ![](:/${r1.id}) ![](:/${r2.id})`,
				`![](${resourceDirName}/${r1.id}.jpg) ![](${resourceDirName}/${r1.id}.jpg) ![](${resourceDirName}/${r2.id}.jpg)`,
			],
			[
				true,
				`![](:/${r1.id})`,
				`![](file://${resourceDirE}/${r1.id}.jpg?t=${t1})`,
			],
			[
				true,
				`![](:/${r1.id}) ![](:/${r1.id}) ![](:/${r2.id})`,
				`![](file://${resourceDirE}/${r1.id}.jpg?t=${t1}) ![](file://${resourceDirE}/${r1.id}.jpg?t=${t1}) ![](file://${resourceDirE}/${r2.id}.jpg?t=${t2})`,
			],
			[
				true,
				`![](:/${r3.id})`,
				`![](file://${resourceDirE}/${r3.id}.pdf)`,
			],
		];

		for (const testCase of testCases) {
			const [useAbsolutePaths, input, expected] = testCase;
			const internalToExternal = await Note.replaceResourceInternalToExternalLinks(input, { useAbsolutePaths });
			expect(internalToExternal).toBe(expected);

			const externalToInternal = await Note.replaceResourceExternalToInternalLinks(internalToExternal, { useAbsolutePaths });
			expect(externalToInternal).toBe(input);
		}

		const result = await Note.replaceResourceExternalToInternalLinks(`[](joplin://${note1.id})`);
		expect(result).toBe(`[](:/${note1.id})`);
	}));

	it('should perform natural sorting', (async () => {
		const folder1 = await Folder.save({});

		const sortedNotes = await Note.previews(folder1.id, {
			fields: ['id', 'title'],
			order: [{ by: 'title', dir: 'ASC' }],
		});
		expect(sortedNotes.length).toBe(0);

		const note0 = await Note.save({ title: 'A3', parent_id: folder1.id, is_todo: false });
		const note1 = await Note.save({ title: 'A20', parent_id: folder1.id, is_todo: false });
		const note2 = await Note.save({ title: 'A100', parent_id: folder1.id, is_todo: false });
		const note3 = await Note.save({ title: 'égalité', parent_id: folder1.id, is_todo: false });
		const note4 = await Note.save({ title: 'z', parent_id: folder1.id, is_todo: false });

		const sortedNotes2 = await Note.previews(folder1.id, {
			fields: ['id', 'title'],
			order: [{ by: 'title', dir: 'ASC' }],
		});
		expect(sortedNotes2.length).toBe(5);
		expect(sortedNotes2[0].id).toBe(note0.id);
		expect(sortedNotes2[1].id).toBe(note1.id);
		expect(sortedNotes2[2].id).toBe(note2.id);
		expect(sortedNotes2[3].id).toBe(note3.id);
		expect(sortedNotes2[4].id).toBe(note4.id);

		const todo3 = Note.changeNoteType(note3, 'todo');
		const todo4 = Note.changeNoteType(note4, 'todo');
		await Note.save(todo3);
		await Note.save(todo4);

		const sortedNotes3 = await Note.previews(folder1.id, {
			fields: ['id', 'title'],
			order: [{ by: 'title', dir: 'ASC' }],
			uncompletedTodosOnTop: true,
		});
		expect(sortedNotes3.length).toBe(5);
		expect(sortedNotes3[0].id).toBe(note3.id);
		expect(sortedNotes3[1].id).toBe(note4.id);
		expect(sortedNotes3[2].id).toBe(note0.id);
		expect(sortedNotes3[3].id).toBe(note1.id);
		expect(sortedNotes3[4].id).toBe(note2.id);
	}));

});
