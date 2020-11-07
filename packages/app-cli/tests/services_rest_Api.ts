import { PaginationOrderDir } from '@joplin/lib/models/utils/types';
import Api, { RequestMethod } from '@joplin/lib/services/rest/Api';
import shim from '@joplin/lib/shim';

const { asyncTest, setupDatabaseAndSynchronizer, switchClient, checkThrowAsync } = require('./test-utils.js');
const Folder = require('@joplin/lib/models/Folder');
const Resource = require('@joplin/lib/models/Resource');
const Note = require('@joplin/lib/models/Note');
const Tag = require('@joplin/lib/models/Tag');
const NoteTag = require('@joplin/lib/models/NoteTag');

async function msleep(ms:number) {
	return new Promise((resolve) => {
		shim.setTimeout(() => {
			resolve();
		}, ms);
	});
}

const createFolderForPagination = async (num:number, time:number) => {
	await Folder.save({
		title: `folder${num}`,
		updated_time: time,
		created_time: time,
	}, { autoTimestamp: false });
};

let api:Api = null;

describe('services_rest_Api', function() {

	beforeEach(async (done) => {
		api = new Api();
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
		done();
	});

	it('should ping', asyncTest(async () => {
		const response = await api.route(RequestMethod.GET, 'ping');
		expect(response).toBe('JoplinClipperServer');
	}));

	it('should handle Not Found errors', asyncTest(async () => {
		const hasThrown = await checkThrowAsync(async () => await api.route(RequestMethod.GET, 'pong'));
		expect(hasThrown).toBe(true);
	}));

	it('should get folders', asyncTest(async () => {
		await Folder.save({ title: 'mon carnet' });
		const response = await api.route(RequestMethod.GET, 'folders');
		expect(response.items.length).toBe(1);
	}));

	it('should update folders', asyncTest(async () => {
		const f1 = await Folder.save({ title: 'mon carnet' });
		await api.route(RequestMethod.PUT, `folders/${f1.id}`, null, JSON.stringify({
			title: 'modifié',
		}));

		const f1b = await Folder.load(f1.id);
		expect(f1b.title).toBe('modifié');
	}));

	it('should delete folders', asyncTest(async () => {
		const f1 = await Folder.save({ title: 'mon carnet' });
		await api.route(RequestMethod.DELETE, `folders/${f1.id}`);

		const f1b = await Folder.load(f1.id);
		expect(!f1b).toBe(true);
	}));

	it('should create folders', asyncTest(async () => {
		const response = await api.route(RequestMethod.POST, 'folders', null, JSON.stringify({
			title: 'from api',
		}));

		expect(!!response.id).toBe(true);

		const f = await Folder.all();
		expect(f.length).toBe(1);
		expect(f[0].title).toBe('from api');
	}));

	it('should get one folder', asyncTest(async () => {
		const f1 = await Folder.save({ title: 'mon carnet' });
		const response = await api.route(RequestMethod.GET, `folders/${f1.id}`);
		expect(response.id).toBe(f1.id);

		const hasThrown = await checkThrowAsync(async () => await api.route(RequestMethod.GET, 'folders/doesntexist'));
		expect(hasThrown).toBe(true);
	}));

	it('should get the folder notes', asyncTest(async () => {
		const f1 = await Folder.save({ title: 'mon carnet' });
		const response2 = await api.route(RequestMethod.GET, `folders/${f1.id}/notes`);
		expect(response2.items.length).toBe(0);

		await Note.save({ title: 'un', parent_id: f1.id });
		await Note.save({ title: 'deux', parent_id: f1.id });
		const response = await api.route(RequestMethod.GET, `folders/${f1.id}/notes`);
		expect(response.items.length).toBe(2);
	}));

	it('should fail on invalid paths', asyncTest(async () => {
		const hasThrown = await checkThrowAsync(async () => await api.route(RequestMethod.GET, 'schtroumpf'));
		expect(hasThrown).toBe(true);
	}));

	it('should get notes', asyncTest(async () => {
		let response = null;
		const f1 = await Folder.save({ title: 'mon carnet' });
		const f2 = await Folder.save({ title: 'mon deuxième carnet' });
		const n1 = await Note.save({ title: 'un', parent_id: f1.id });
		await Note.save({ title: 'deux', parent_id: f1.id });
		const n3 = await Note.save({ title: 'trois', parent_id: f2.id });

		response = await api.route(RequestMethod.GET, 'notes');
		expect(response.items.length).toBe(3);

		response = await api.route(RequestMethod.GET, `notes/${n1.id}`);
		expect(response.id).toBe(n1.id);

		response = await api.route(RequestMethod.GET, `notes/${n3.id}`, { fields: 'id,title' });
		expect(Object.getOwnPropertyNames(response).length).toBe(3);
		expect(response.id).toBe(n3.id);
		expect(response.title).toBe('trois');
	}));

	it('should create notes', asyncTest(async () => {
		let response = null;
		const f = await Folder.save({ title: 'mon carnet' });

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing',
			parent_id: f.id,
		}));
		expect(response.title).toBe('testing');
		expect(!!response.id).toBe(true);

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing',
			parent_id: f.id,
		}));
		expect(response.title).toBe('testing');
		expect(!!response.id).toBe(true);
	}));

	it('should allow setting note properties', asyncTest(async () => {
		let response:any = null;
		const f = await Folder.save({ title: 'mon carnet' });

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing',
			parent_id: f.id,
			latitude: '48.732071',
			longitude: '-3.458700',
			altitude: '21',
		}));

		const noteId = response.id;

		{
			const note = await Note.load(noteId);
			expect(note.latitude).toBe('48.73207100');
			expect(note.longitude).toBe('-3.45870000');
			expect(note.altitude).toBe('21.0000');
		}

		await api.route(RequestMethod.PUT, `notes/${noteId}`, null, JSON.stringify({
			latitude: '49',
			longitude: '-3',
			altitude: '22',
		}));

		{
			const note = await Note.load(noteId);
			expect(note.latitude).toBe('49.00000000');
			expect(note.longitude).toBe('-3.00000000');
			expect(note.altitude).toBe('22.0000');
		}
	}));

	it('should preserve user timestamps when creating notes', asyncTest(async () => {
		let response = null;
		const f = await Folder.save({ title: 'mon carnet' });

		const updatedTime = Date.now() - 1000;
		const createdTime = Date.now() - 10000;

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			parent_id: f.id,
			user_updated_time: updatedTime,
			user_created_time: createdTime,
		}));

		expect(response.user_updated_time).toBe(updatedTime);
		expect(response.user_created_time).toBe(createdTime);

		const timeBefore = Date.now();

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			parent_id: f.id,
		}));

		const newNote = await Note.load(response.id);
		expect(newNote.user_updated_time).toBeGreaterThanOrEqual(timeBefore);
		expect(newNote.user_created_time).toBeGreaterThanOrEqual(timeBefore);
	}));

	it('should preserve user timestamps when updating notes', asyncTest(async () => {
		const folder = await Folder.save({ title: 'mon carnet' });

		const updatedTime = Date.now() - 1000;
		const createdTime = Date.now() - 10000;

		const response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			parent_id: folder.id,
		}));

		const noteId = response.id;

		{
			// Check that if user timestamps are supplied, they are preserved by the API

			await api.route(RequestMethod.PUT, `notes/${noteId}`, null, JSON.stringify({
				user_updated_time: updatedTime,
				user_created_time: createdTime,
				title: 'mod',
			}));

			const modNote = await Note.load(noteId);
			expect(modNote.title).toBe('mod');
			expect(modNote.user_updated_time).toBe(updatedTime);
			expect(modNote.user_created_time).toBe(createdTime);
		}

		{
			// Check if no user timestamps are supplied they are automatically updated.

			const beforeTime = Date.now();

			await api.route(RequestMethod.PUT, `notes/${noteId}`, null, JSON.stringify({
				title: 'mod2',
			}));

			const modNote = await Note.load(noteId);
			expect(modNote.title).toBe('mod2');
			expect(modNote.user_updated_time).toBeGreaterThanOrEqual(beforeTime);
			expect(modNote.user_created_time).toBeGreaterThanOrEqual(createdTime);
		}
	}));

	it('should create notes with supplied ID', asyncTest(async () => {
		let response = null;
		const f = await Folder.save({ title: 'mon carnet' });

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			id: '12345678123456781234567812345678',
			title: 'testing',
			parent_id: f.id,
		}));
		expect(response.id).toBe('12345678123456781234567812345678');
	}));

	it('should create todos', asyncTest(async () => {
		let response = null;
		const f = await Folder.save({ title: 'stuff to do' });

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing',
			parent_id: f.id,
			is_todo: 1,
		}));
		expect(response.is_todo).toBe(1);

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing 2',
			parent_id: f.id,
			is_todo: 0,
		}));
		expect(response.is_todo).toBe(0);

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing 3',
			parent_id: f.id,
		}));
		expect(response.is_todo).toBeUndefined();

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing 4',
			parent_id: f.id,
			is_todo: '1',
		}));
	}));

	it('should create folders with supplied ID', asyncTest(async () => {
		const response = await api.route(RequestMethod.POST, 'folders', null, JSON.stringify({
			id: '12345678123456781234567812345678',
			title: 'from api',
		}));

		expect(response.id).toBe('12345678123456781234567812345678');
	}));

	it('should create notes with images', asyncTest(async () => {
		let response = null;
		const f = await Folder.save({ title: 'mon carnet' });

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing image',
			parent_id: f.id,
			image_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAANZJREFUeNoAyAA3/wFwtO3K6gUB/vz2+Prw9fj/+/r+/wBZKAAExOgF4/MC9ff+MRH6Ui4E+/0Bqc/zutj6AgT+/Pz7+vv7++nu82c4DlMqCvLs8goA/gL8/fz09fb59vXa6vzZ6vjT5fbn6voD/fwC8vX4UiT9Zi//APHyAP8ACgUBAPv5APz7BPj2+DIaC2o3E+3o6ywaC5fT6gD6/QD9/QEVf9kD+/dcLQgJA/7v8vqfwOf18wA1IAIEVycAyt//v9XvAPv7APz8LhoIAPz9Ri4OAgwARgx4W/6fVeEAAAAASUVORK5CYII=',
		}));

		const resources = await Resource.all();
		expect(resources.length).toBe(1);

		const resource = resources[0];
		expect(response.body.indexOf(resource.id) >= 0).toBe(true);
	}));

	it('should delete resources', asyncTest(async () => {
		const f = await Folder.save({ title: 'mon carnet' });

		await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing image',
			parent_id: f.id,
			image_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAANZJREFUeNoAyAA3/wFwtO3K6gUB/vz2+Prw9fj/+/r+/wBZKAAExOgF4/MC9ff+MRH6Ui4E+/0Bqc/zutj6AgT+/Pz7+vv7++nu82c4DlMqCvLs8goA/gL8/fz09fb59vXa6vzZ6vjT5fbn6voD/fwC8vX4UiT9Zi//APHyAP8ACgUBAPv5APz7BPj2+DIaC2o3E+3o6ywaC5fT6gD6/QD9/QEVf9kD+/dcLQgJA/7v8vqfwOf18wA1IAIEVycAyt//v9XvAPv7APz8LhoIAPz9Ri4OAgwARgx4W/6fVeEAAAAASUVORK5CYII=',
		}));

		const resource = (await Resource.all())[0];

		const filePath = Resource.fullPath(resource);
		expect(await shim.fsDriver().exists(filePath)).toBe(true);

		await api.route(RequestMethod.DELETE, `resources/${resource.id}`);
		expect(await shim.fsDriver().exists(filePath)).toBe(false);
		expect(!(await Resource.load(resource.id))).toBe(true);
	}));

	it('should create notes from HTML', asyncTest(async () => {
		let response = null;
		const f = await Folder.save({ title: 'mon carnet' });

		response = await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({
			title: 'testing HTML',
			parent_id: f.id,
			body_html: '<b>Bold text</b>',
		}));

		expect(response.body).toBe('**Bold text**');
	}));

	// it('should filter fields', asyncTest(async () => {
	// 	let f = api.fields_({ query: { fields: 'one,two' } } as any, []);
	// 	expect(f.length).toBe(2);
	// 	expect(f[0]).toBe('one');
	// 	expect(f[1]).toBe('two');

	// 	f = api.fields_({ query: { fields: 'one  ,, two  ' } } as any, []);
	// 	expect(f.length).toBe(2);
	// 	expect(f[0]).toBe('one');
	// 	expect(f[1]).toBe('two');

	// 	f = api.fields_({ query: { fields: '  ' } } as any, ['def']);
	// 	expect(f.length).toBe(1);
	// 	expect(f[0]).toBe('def');
	// }));

	it('should handle tokens', asyncTest(async () => {
		api = new Api('mytoken');

		let hasThrown = await checkThrowAsync(async () => await api.route(RequestMethod.GET, 'notes'));
		expect(hasThrown).toBe(true);

		const response = await api.route(RequestMethod.GET, 'notes', { token: 'mytoken' });
		expect(response.items.length).toBe(0);

		hasThrown = await checkThrowAsync(async () => await api.route(RequestMethod.POST, 'notes', null, JSON.stringify({ title: 'testing' })));
		expect(hasThrown).toBe(true);
	}));

	it('should add tags to notes', asyncTest(async () => {
		const tag = await Tag.save({ title: 'mon étiquette' });
		const note = await Note.save({ title: 'ma note' });

		await api.route(RequestMethod.POST, `tags/${tag.id}/notes`, null, JSON.stringify({
			id: note.id,
		}));

		const noteIds = await Tag.noteIds(tag.id);
		expect(noteIds[0]).toBe(note.id);
	}));

	it('should remove tags from notes', asyncTest(async () => {
		const tag = await Tag.save({ title: 'mon étiquette' });
		const note = await Note.save({ title: 'ma note' });
		await Tag.addNote(tag.id, note.id);

		await api.route(RequestMethod.DELETE, `tags/${tag.id}/notes/${note.id}`);

		const noteIds = await Tag.noteIds(tag.id);
		expect(noteIds.length).toBe(0);
	}));

	it('should list all tag notes', asyncTest(async () => {
		const tag = await Tag.save({ title: 'mon étiquette' });
		const tag2 = await Tag.save({ title: 'mon étiquette 2' });
		const note1 = await Note.save({ title: 'ma note un' });
		const note2 = await Note.save({ title: 'ma note deux' });
		await Tag.addNote(tag.id, note1.id);
		await Tag.addNote(tag.id, note2.id);

		const response = await api.route(RequestMethod.GET, `tags/${tag.id}/notes`);
		expect(response.items.length).toBe(2);
		expect('id' in response.items[0]).toBe(true);
		expect('title' in response.items[0]).toBe(true);

		const response2 = await api.route(RequestMethod.GET, `notes/${note1.id}/tags`);
		expect(response2.items.length).toBe(1);
		await Tag.addNote(tag2.id, note1.id);
		const response3 = await api.route(RequestMethod.GET, `notes/${note1.id}/tags`);
		expect(response3.items.length).toBe(2);
	}));

	it('should update tags when updating notes', asyncTest(async () => {
		const tag1 = await Tag.save({ title: 'mon étiquette 1' });
		const tag2 = await Tag.save({ title: 'mon étiquette 2' });
		const tag3 = await Tag.save({ title: 'mon étiquette 3' });

		const note = await Note.save({
			title: 'ma note un',
		});
		Tag.addNote(tag1.id, note.id);
		Tag.addNote(tag2.id, note.id);

		const response = await api.route(RequestMethod.PUT, `notes/${note.id}`, null, JSON.stringify({
			tags: `${tag1.title},${tag3.title}`,
		}));
		const tagIds = await NoteTag.tagIdsByNoteId(note.id);
		expect(response.tags === `${tag1.title},${tag3.title}`).toBe(true);
		expect(tagIds.length === 2).toBe(true);
		expect(tagIds.includes(tag1.id)).toBe(true);
		expect(tagIds.includes(tag3.id)).toBe(true);
	}));

	it('should create and update tags when updating notes', asyncTest(async () => {
		const tag1 = await Tag.save({ title: 'mon étiquette 1' });
		const tag2 = await Tag.save({ title: 'mon étiquette 2' });
		const newTagTitle = 'mon étiquette 3';

		const note = await Note.save({
			title: 'ma note un',
		});
		Tag.addNote(tag1.id, note.id);
		Tag.addNote(tag2.id, note.id);

		const response = await api.route(RequestMethod.PUT, `notes/${note.id}`, null, JSON.stringify({
			tags: `${tag1.title},${newTagTitle}`,
		}));
		const newTag = await Tag.loadByTitle(newTagTitle);
		const tagIds = await NoteTag.tagIdsByNoteId(note.id);
		expect(response.tags === `${tag1.title},${newTag.title}`).toBe(true);
		expect(tagIds.length === 2).toBe(true);
		expect(tagIds.includes(tag1.id)).toBe(true);
		expect(tagIds.includes(newTag.id)).toBe(true);
	}));

	it('should not update tags if tags is not mentioned when updating', asyncTest(async () => {
		const tag1 = await Tag.save({ title: 'mon étiquette 1' });
		const tag2 = await Tag.save({ title: 'mon étiquette 2' });

		const note = await Note.save({
			title: 'ma note un',
		});
		Tag.addNote(tag1.id, note.id);
		Tag.addNote(tag2.id, note.id);

		const response = await api.route(RequestMethod.PUT, `notes/${note.id}`, null, JSON.stringify({
			title: 'Some other title',
		}));
		const tagIds = await NoteTag.tagIdsByNoteId(note.id);
		expect(response.tags === undefined).toBe(true);
		expect(tagIds.length === 2).toBe(true);
		expect(tagIds.includes(tag1.id)).toBe(true);
		expect(tagIds.includes(tag2.id)).toBe(true);
	}));

	it('should remove tags from note if tags is set to empty string when updating', asyncTest(async () => {
		const tag1 = await Tag.save({ title: 'mon étiquette 1' });
		const tag2 = await Tag.save({ title: 'mon étiquette 2' });

		const note = await Note.save({
			title: 'ma note un',
		});
		Tag.addNote(tag1.id, note.id);
		Tag.addNote(tag2.id, note.id);

		const response = await api.route(RequestMethod.PUT, `notes/${note.id}`, null, JSON.stringify({
			tags: '',
		}));
		const tagIds = await NoteTag.tagIdsByNoteId(note.id);
		expect(response.tags === '').toBe(true);
		expect(tagIds.length === 0).toBe(true);
	}));

	it('should paginate results', asyncTest(async () => {
		await createFolderForPagination(1, 1001);
		await createFolderForPagination(2, 1002);
		await createFolderForPagination(3, 1003);
		await createFolderForPagination(4, 1004);

		{
			const r1 = await api.route(RequestMethod.GET, 'folders', {
				fields: ['id', 'title', 'updated_time'],
				limit: 2,
				order_dir: PaginationOrderDir.ASC,
				order_by: 'updated_time',
			});

			expect(r1.items.length).toBe(2);
			expect(r1.items[0].title).toBe('folder1');
			expect(r1.items[1].title).toBe('folder2');

			const r2 = await api.route(RequestMethod.GET, 'folders', {
				cursor: r1.cursor,
			});

			expect(r2.items.length).toBe(2);
			expect(r2.items[0].title).toBe('folder3');
			expect(r2.items[1].title).toBe('folder4');

			const r3 = await api.route(RequestMethod.GET, 'folders', {
				cursor: r2.cursor,
			});

			expect(r3.items.length).toBe(0);
			expect(r3.cursor).toBe(undefined);
		}

		{
			const r1 = await api.route(RequestMethod.GET, 'folders', {
				fields: ['id', 'title', 'updated_time'],
				limit: 3,
				order_dir: PaginationOrderDir.ASC,
				order_by: 'updated_time',
			});

			expect(r1.items.length).toBe(3);
			expect(r1.items[0].title).toBe('folder1');
			expect(r1.items[1].title).toBe('folder2');
			expect(r1.items[2].title).toBe('folder3');

			const r2 = await api.route(RequestMethod.GET, 'folders', {
				cursor: r1.cursor,
			});

			expect(r2.items.length).toBe(1);
			expect(r2.items[0].title).toBe('folder4');
			expect(r2.cursor).toBe(undefined);
		}
	}));

	it('should paginate results and handle duplicate cursor field value', asyncTest(async () => {
		await createFolderForPagination(1, 1001);
		await createFolderForPagination(2, 1002);
		await createFolderForPagination(3, 1002);
		await createFolderForPagination(4, 1003);

		const r1 = await api.route(RequestMethod.GET, 'folders', {
			fields: ['id', 'title', 'updated_time'],
			limit: 2,
			order_dir: PaginationOrderDir.ASC,
			order_by: 'updated_time',
		});

		expect(r1.items.length).toBe(2);
		expect(r1.items[0].title).toBe('folder1');
		expect(['folder2', 'folder3'].includes(r1.items[1].title)).toBe(true);

		const r2 = await api.route(RequestMethod.GET, 'folders', {
			cursor: r1.cursor,
		});

		expect(r2.items.length).toBe(2);
		expect(r2.items[0].title).toBe(r1.items[1].title === 'folder2' ? 'folder3' : 'folder2');
		expect(r2.items[1].title).toBe('folder4');
	}));

	it('should paginate folder notes', asyncTest(async () => {
		const folder = await Folder.save({});
		const note1 = await Note.save({ parent_id: folder.id });
		await msleep(1);
		const note2 = await Note.save({ parent_id: folder.id });
		await msleep(1);
		const note3 = await Note.save({ parent_id: folder.id });

		const r1 = await api.route(RequestMethod.GET, `folders/${folder.id}/notes`, {
			limit: 2,
		});

		expect(r1.items.length).toBe(2);
		expect(r1.items[0].id).toBe(note1.id);
		expect(r1.items[1].id).toBe(note2.id);

		const r2 = await api.route(RequestMethod.GET, `folders/${folder.id}/notes`, {
			cursor: r1.cursor,
		});

		expect(r2.items.length).toBe(1);
		expect(r2.items[0].id).toBe(note3.id);
	}));

	it('should return default fields', asyncTest(async () => {
		const folder = await Folder.save({ title: 'folder' });
		const note1 = await Note.save({ title: 'note1', parent_id: folder.id });
		await Note.save({ title: 'note2', parent_id: folder.id });

		const tag = await Tag.save({ title: 'tag' });
		await Tag.addNote(tag.id, note1.id);

		{
			const r = await api.route(RequestMethod.GET, `folders/${folder.id}`);
			expect('id' in r).toBe(true);
			expect('title' in r).toBe(true);
			expect('parent_id' in r).toBe(true);
		}

		{
			const r = await api.route(RequestMethod.GET, `folders/${folder.id}/notes`);
			expect('id' in r.items[0]).toBe(true);
			expect('title' in r.items[0]).toBe(true);
			expect('parent_id' in r.items[0]).toBe(true);
		}

		{
			const r = await api.route(RequestMethod.GET, 'notes');
			expect('id' in r.items[0]).toBe(true);
			expect('title' in r.items[0]).toBe(true);
			expect('parent_id' in r.items[0]).toBe(true);
		}

		{
			const r = await api.route(RequestMethod.GET, `notes/${note1.id}/tags`);
			expect('id' in r.items[0]).toBe(true);
			expect('title' in r.items[0]).toBe(true);
		}

		{
			const r = await api.route(RequestMethod.GET, `tags/${tag.id}`);
			expect('id' in r).toBe(true);
			expect('title' in r).toBe(true);
		}
	}));
});
