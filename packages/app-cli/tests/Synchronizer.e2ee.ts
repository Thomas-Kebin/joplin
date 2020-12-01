import time from '@joplin/lib/time';
import shim from '@joplin/lib/shim';
import Setting from '@joplin/lib/models/Setting';

const { synchronizerStart, allSyncTargetItemsEncrypted, kvStore, setupDatabaseAndSynchronizer, synchronizer, fileApi, switchClient, encryptionService, loadEncryptionMasterKey, decryptionWorker, checkThrowAsync } = require('./test-utils.js');
const Folder = require('@joplin/lib/models/Folder.js');
const Note = require('@joplin/lib/models/Note.js');
const Resource = require('@joplin/lib/models/Resource.js');
const ResourceFetcher = require('@joplin/lib/services/ResourceFetcher');
const MasterKey = require('@joplin/lib/models/MasterKey');
const BaseItem = require('@joplin/lib/models/BaseItem.js');

let insideBeforeEach = false;

describe('Synchronizer.e2ee', function() {

	beforeEach(async (done) => {
		insideBeforeEach = true;

		await setupDatabaseAndSynchronizer(1);
		await setupDatabaseAndSynchronizer(2);
		await switchClient(1);
		done();

		insideBeforeEach = false;
	});

	it('notes and folders should get encrypted when encryption is enabled', (async () => {
		Setting.setValue('encryption.enabled', true);
		const masterKey = await loadEncryptionMasterKey();
		const folder1 = await Folder.save({ title: 'folder1' });
		let note1 = await Note.save({ title: 'un', body: 'to be encrypted', parent_id: folder1.id });
		await synchronizerStart();
		// After synchronisation, remote items should be encrypted but local ones remain plain text
		note1 = await Note.load(note1.id);
		expect(note1.title).toBe('un');

		await switchClient(2);

		await synchronizerStart();
		let folder1_2 = await Folder.load(folder1.id);
		let note1_2 = await Note.load(note1.id);
		const masterKey_2 = await MasterKey.load(masterKey.id);
		// On this side however it should be received encrypted
		expect(!note1_2.title).toBe(true);
		expect(!folder1_2.title).toBe(true);
		expect(!!note1_2.encryption_cipher_text).toBe(true);
		expect(!!folder1_2.encryption_cipher_text).toBe(true);
		// Master key is already encrypted so it does not get re-encrypted during sync
		expect(masterKey_2.content).toBe(masterKey.content);
		expect(masterKey_2.checksum).toBe(masterKey.checksum);
		// Now load the master key we got from client 1 and try to decrypt
		await encryptionService().loadMasterKey_(masterKey_2, '123456', true);
		// Get the decrypted items back
		await Folder.decrypt(folder1_2);
		await Note.decrypt(note1_2);
		folder1_2 = await Folder.load(folder1.id);
		note1_2 = await Note.load(note1.id);
		// Check that properties match the original items. Also check
		// the encryption did not affect the updated_time timestamp.
		expect(note1_2.title).toBe(note1.title);
		expect(note1_2.body).toBe(note1.body);
		expect(note1_2.updated_time).toBe(note1.updated_time);
		expect(!note1_2.encryption_cipher_text).toBe(true);
		expect(folder1_2.title).toBe(folder1.title);
		expect(folder1_2.updated_time).toBe(folder1.updated_time);
		expect(!folder1_2.encryption_cipher_text).toBe(true);
	}));

	it('should enable encryption automatically when downloading new master key (and none was previously available)',(async () => {
		// Enable encryption on client 1 and sync an item
		Setting.setValue('encryption.enabled', true);
		await loadEncryptionMasterKey();
		let folder1 = await Folder.save({ title: 'folder1' });
		await synchronizerStart();

		await switchClient(2);

		// Synchronising should enable encryption since we're going to get a master key
		expect(Setting.value('encryption.enabled')).toBe(false);
		await synchronizerStart();
		expect(Setting.value('encryption.enabled')).toBe(true);

		// Check that we got the master key from client 1
		const masterKey = (await MasterKey.all())[0];
		expect(!!masterKey).toBe(true);

		// Since client 2 hasn't supplied a password yet, no master key is currently loaded
		expect(encryptionService().loadedMasterKeyIds().length).toBe(0);

		// If we sync now, nothing should be sent to target since we don't have a password.
		// Technically it's incorrect to set the property of an encrypted variable but it allows confirming
		// that encryption doesn't work if user hasn't supplied a password.
		await BaseItem.forceSync(folder1.id);
		await synchronizerStart();

		await switchClient(1);

		await synchronizerStart();
		folder1 = await Folder.load(folder1.id);
		expect(folder1.title).toBe('folder1'); // Still at old value

		await switchClient(2);

		// Now client 2 set the master key password
		Setting.setObjectValue('encryption.passwordCache', masterKey.id, '123456');
		await encryptionService().loadMasterKeysFromSettings();

		// Now that master key should be loaded
		expect(encryptionService().loadedMasterKeyIds()[0]).toBe(masterKey.id);

		// Decrypt all the data. Now change the title and sync again - this time the changes should be transmitted
		await decryptionWorker().start();
		await Folder.save({ id: folder1.id, title: 'change test' });

		// If we sync now, this time client 1 should get the changes we did earlier
		await synchronizerStart();

		await switchClient(1);

		await synchronizerStart();
		// Decrypt the data we just got
		await decryptionWorker().start();
		folder1 = await Folder.load(folder1.id);
		expect(folder1.title).toBe('change test'); // Got title from client 2
	}));

	it('should encrypt existing notes too when enabling E2EE', (async () => {
		// First create a folder, without encryption enabled, and sync it
		await Folder.save({ title: 'folder1' });
		await synchronizerStart();
		let files = await fileApi().list('', { includeDirs: false, syncItemsOnly: true });
		let content = await fileApi().get(files.items[0].path);
		expect(content.indexOf('folder1') >= 0).toBe(true);

		// Then enable encryption and sync again
		let masterKey = await encryptionService().generateMasterKey('123456');
		masterKey = await MasterKey.save(masterKey);
		await encryptionService().enableEncryption(masterKey, '123456');
		await encryptionService().loadMasterKeysFromSettings();
		await synchronizerStart();

		// Even though the folder has not been changed it should have been synced again so that
		// an encrypted version of it replaces the decrypted version.
		files = await fileApi().list('', { includeDirs: false, syncItemsOnly: true });
		expect(files.items.length).toBe(2);
		// By checking that the folder title is not present, we can confirm that the item has indeed been encrypted
		// One of the two items is the master key
		content = await fileApi().get(files.items[0].path);
		expect(content.indexOf('folder1') < 0).toBe(true);
		content = await fileApi().get(files.items[1].path);
		expect(content.indexOf('folder1') < 0).toBe(true);
	}));

	it('should upload decrypted items to sync target after encryption disabled', (async () => {
		Setting.setValue('encryption.enabled', true);
		await loadEncryptionMasterKey();

		await Folder.save({ title: 'folder1' });
		await synchronizerStart();

		let allEncrypted = await allSyncTargetItemsEncrypted();
		expect(allEncrypted).toBe(true);

		await encryptionService().disableEncryption();

		await synchronizerStart();
		allEncrypted = await allSyncTargetItemsEncrypted();
		expect(allEncrypted).toBe(false);
	}));

	it('should not upload any item if encryption was enabled, and items have not been decrypted, and then encryption disabled', (async () => {
		// For some reason I can't explain, this test is sometimes executed before beforeEach is finished
		// which means it's going to fail in unexpected way. So the loop below wait for beforeEach to be done.
		while (insideBeforeEach) await time.msleep(100);

		Setting.setValue('encryption.enabled', true);
		const masterKey = await loadEncryptionMasterKey();

		await Folder.save({ title: 'folder1' });
		await synchronizerStart();

		await switchClient(2);

		await synchronizerStart();
		expect(Setting.value('encryption.enabled')).toBe(true);

		// If we try to disable encryption now, it should throw an error because some items are
		// currently encrypted. They must be decrypted first so that they can be sent as
		// plain text to the sync target.
		// let hasThrown = await checkThrowAsync(async () => await encryptionService().disableEncryption());
		// expect(hasThrown).toBe(true);

		// Now supply the password, and decrypt the items
		Setting.setObjectValue('encryption.passwordCache', masterKey.id, '123456');
		await encryptionService().loadMasterKeysFromSettings();
		await decryptionWorker().start();

		// Try to disable encryption again
		const hasThrown = await checkThrowAsync(async () => await encryptionService().disableEncryption());
		expect(hasThrown).toBe(false);

		// If we sync now the target should receive the decrypted items
		await synchronizerStart();
		const allEncrypted = await allSyncTargetItemsEncrypted();
		expect(allEncrypted).toBe(false);
	}));

	it('should set the resource file size after decryption', (async () => {
		Setting.setValue('encryption.enabled', true);
		const masterKey = await loadEncryptionMasterKey();

		const folder1 = await Folder.save({ title: 'folder1' });
		const note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		await shim.attachFileToNote(note1, `${__dirname}/../tests/support/photo.jpg`);
		const resource1 = (await Resource.all())[0];
		await Resource.setFileSizeOnly(resource1.id, -1);
		Resource.fullPath(resource1);
		await synchronizerStart();

		await switchClient(2);

		await synchronizerStart();
		Setting.setObjectValue('encryption.passwordCache', masterKey.id, '123456');
		await encryptionService().loadMasterKeysFromSettings();

		const fetcher = new ResourceFetcher(() => { return synchronizer().api(); });
		fetcher.queueDownload_(resource1.id);
		await fetcher.waitForAllFinished();
		await decryptionWorker().start();

		const resource1_2 = await Resource.load(resource1.id);
		expect(resource1_2.size).toBe(2720);
	}));

	it('should encrypt remote resources after encryption has been enabled', (async () => {
		while (insideBeforeEach) await time.msleep(100);

		const folder1 = await Folder.save({ title: 'folder1' });
		const note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		await shim.attachFileToNote(note1, `${__dirname}/../tests/support/photo.jpg`);
		await synchronizerStart();

		expect(await allSyncTargetItemsEncrypted()).toBe(false);

		const masterKey = await loadEncryptionMasterKey();
		await encryptionService().enableEncryption(masterKey, '123456');
		await encryptionService().loadMasterKeysFromSettings();

		await synchronizerStart();

		expect(await allSyncTargetItemsEncrypted()).toBe(true);
	}));

	it('should upload encrypted resource, but it should not mark the blob as encrypted locally', (async () => {
		while (insideBeforeEach) await time.msleep(100);

		const folder1 = await Folder.save({ title: 'folder1' });
		const note1 = await Note.save({ title: 'ma note', parent_id: folder1.id });
		await shim.attachFileToNote(note1, `${__dirname}/../tests/support/photo.jpg`);
		const masterKey = await loadEncryptionMasterKey();
		await encryptionService().enableEncryption(masterKey, '123456');
		await encryptionService().loadMasterKeysFromSettings();
		await synchronizerStart();

		const resource1 = (await Resource.all())[0];
		expect(resource1.encryption_blob_encrypted).toBe(0);
	}));

	it('should decrypt the resource metadata, but not try to decrypt the file, if it is not present', (async () => {
		const note1 = await Note.save({ title: 'note' });
		await shim.attachFileToNote(note1, `${__dirname}/../tests/support/photo.jpg`);
		const masterKey = await loadEncryptionMasterKey();
		await encryptionService().enableEncryption(masterKey, '123456');
		await encryptionService().loadMasterKeysFromSettings();
		await synchronizerStart();
		expect(await allSyncTargetItemsEncrypted()).toBe(true);

		await switchClient(2);

		await synchronizerStart();
		Setting.setObjectValue('encryption.passwordCache', masterKey.id, '123456');
		await encryptionService().loadMasterKeysFromSettings();
		await decryptionWorker().start();

		let resource = (await Resource.all())[0];

		expect(!!resource.encryption_applied).toBe(false);
		expect(!!resource.encryption_blob_encrypted).toBe(true);

		const resourceFetcher = new ResourceFetcher(() => { return synchronizer().api(); });
		await resourceFetcher.start();
		await resourceFetcher.waitForAllFinished();

		const ls = await Resource.localState(resource);
		expect(ls.fetch_status).toBe(Resource.FETCH_STATUS_DONE);

		await decryptionWorker().start();
		resource = (await Resource.all())[0];

		expect(!!resource.encryption_blob_encrypted).toBe(false);
	}));

	it('should stop trying to decrypt item after a few attempts', (async () => {
		let hasThrown;

		const note = await Note.save({ title: 'ma note' });
		const masterKey = await loadEncryptionMasterKey();
		await encryptionService().enableEncryption(masterKey, '123456');
		await encryptionService().loadMasterKeysFromSettings();
		await synchronizerStart();

		await switchClient(2);

		await synchronizerStart();

		// First, simulate a broken note and check that the decryption worker
		// gives up decrypting after a number of tries. This is mainly relevant
		// for data that crashes the mobile application - we don't want to keep
		// decrypting these.

		const encryptedNote = await Note.load(note.id);
		const goodCipherText = encryptedNote.encryption_cipher_text;
		await Note.save({ id: note.id, encryption_cipher_text: 'doesntlookright' });

		Setting.setObjectValue('encryption.passwordCache', masterKey.id, '123456');
		await encryptionService().loadMasterKeysFromSettings();

		hasThrown = await checkThrowAsync(async () => await decryptionWorker().start({ errorHandler: 'throw' }));
		expect(hasThrown).toBe(true);

		hasThrown = await checkThrowAsync(async () => await decryptionWorker().start({ errorHandler: 'throw' }));
		expect(hasThrown).toBe(true);

		// Third time, an error is logged and no error is thrown
		hasThrown = await checkThrowAsync(async () => await decryptionWorker().start({ errorHandler: 'throw' }));
		expect(hasThrown).toBe(false);

		const disabledItems = await decryptionWorker().decryptionDisabledItems();
		expect(disabledItems.length).toBe(1);
		expect(disabledItems[0].id).toBe(note.id);

		expect((await kvStore().all()).length).toBe(1);
		await kvStore().clear();

		// Now check that if it fails once but succeed the second time, the note
		// is correctly decrypted and the counters are cleared.

		hasThrown = await checkThrowAsync(async () => await decryptionWorker().start({ errorHandler: 'throw' }));
		expect(hasThrown).toBe(true);

		await Note.save({ id: note.id, encryption_cipher_text: goodCipherText });

		hasThrown = await checkThrowAsync(async () => await decryptionWorker().start({ errorHandler: 'throw' }));
		expect(hasThrown).toBe(false);

		const decryptedNote = await Note.load(note.id);
		expect(decryptedNote.title).toBe('ma note');

		expect((await kvStore().all()).length).toBe(0);
		expect((await decryptionWorker().decryptionDisabledItems()).length).toBe(0);
	}));

	it('should not encrypt notes that are shared', (async () => {
		Setting.setValue('encryption.enabled', true);
		await loadEncryptionMasterKey();

		const folder1 = await Folder.save({ title: 'folder1' });
		const note1 = await Note.save({ title: 'un', parent_id: folder1.id });
		let note2 = await Note.save({ title: 'deux', parent_id: folder1.id });
		await synchronizerStart();

		await switchClient(2);

		await synchronizerStart();

		await switchClient(1);

		const origNote2 = Object.assign({}, note2);
		await BaseItem.updateShareStatus(note2, true);
		note2 = await Note.load(note2.id);

		// Sharing a note should not modify the timestamps
		expect(note2.user_updated_time).toBe(origNote2.user_updated_time);
		expect(note2.user_created_time).toBe(origNote2.user_created_time);

		await synchronizerStart();

		await switchClient(2);

		await synchronizerStart();

		// The shared note should be decrypted
		const note2_2 = await Note.load(note2.id);
		expect(note2_2.title).toBe('deux');
		expect(note2_2.is_shared).toBe(1);

		// The non-shared note should be encrypted
		const note1_2 = await Note.load(note1.id);
		expect(note1_2.title).toBe('');
	}));

});
