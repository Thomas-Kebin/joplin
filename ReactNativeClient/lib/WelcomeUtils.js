const welcomeAssets = require('./welcomeAssets');
const Note = require('lib/models/Note');
const Setting = require('lib/models/Setting');
const Folder = require('lib/models/Folder');
const Tag = require('lib/models/Tag');
const Resource = require('lib/models/Resource');
const { shim } = require('lib/shim');
const { uuid } = require('lib/uuid');
const { fileExtension, basename} = require('lib/path-utils');
const { pregQuote } = require('lib/string-utils');

class WelcomeUtils {

	static async createWelcomeItems() {
		const overwriteExisting = Setting.value('env') === 'dev';

		const output = {
			defaultFolderId: null,
		};

		const noteAssets = welcomeAssets.notes;
		const folderAssets = welcomeAssets.folders;
		const tempDir = Setting.value('resourceDir');

		for (let i = 0; i < folderAssets.length; i++) {
			const folderAsset = folderAssets[i];
			const folderId = folderAsset.id;

			if (!output.defaultFolderId) output.defaultFolderId = folderId;

			let existingFolder = await Folder.load(folderId);

			if (existingFolder && overwriteExisting) {
				await Folder.delete(existingFolder.id);
				existingFolder = null;
			}

			if (existingFolder) continue;

			await Folder.save({
				id: folderId,
				title: folderAsset.title,
			}, { isNew: true });
		}

		for (let i =  noteAssets.length - 1; i >= 0; i--) {
			const noteAsset = noteAssets[i];

			const noteId = noteAsset.id;

			let existingNote = await Note.load(noteId);

			if (existingNote && overwriteExisting) {
				await Note.delete(existingNote.id);
				existingNote = null;
			}

			if (existingNote) continue;

			let noteBody = noteAsset.body;

			for (let resourceUrl in noteAsset.resources) {
				if (!noteAsset.resources.hasOwnProperty(resourceUrl)) continue;
				const resourceAsset = noteAsset.resources[resourceUrl];
				const resourceId = resourceAsset.id;

				let existingResource = await Resource.load(resourceId);

				if (existingResource && overwriteExisting) {
					await Resource.delete(resourceId);
					existingResource = null;
				}

				if (!existingResource) {
					const ext = fileExtension(resourceUrl);
					const tempFilePath = tempDir + '/' + uuid.create() + '.tmp.' + ext;
					await shim.fsDriver().writeFile(tempFilePath, resourceAsset.body, 'base64');
					await shim.createResourceFromPath(tempFilePath, {
						id: resourceId,
						title: basename(resourceUrl),
					});
					await shim.fsDriver().remove(tempFilePath);
				}

				const regex = new RegExp(pregQuote('(' + resourceUrl + ')'), 'g');
				noteBody = noteBody.replace(regex, '(:/' + resourceId + ')');				
			}

			await Note.save({
				id: noteId,
				parent_id: noteAsset.parent_id,
				title: noteAsset.title,
				body: noteBody,
			}, { isNew: true });

			if (noteAsset.tags) await Tag.setNoteTagsByTitles(noteId, noteAsset.tags);
		}

		return output;
	}

	static async install(dispatch) {
		if (!Setting.value('welcome.wasBuilt')) {
			const result = await WelcomeUtils.createWelcomeItems();
			Setting.setValue('welcome.wasBuilt', true);

			dispatch({
				type: 'FOLDER_SELECT',
				id: result.defaultFolderId,
			});

			Setting.setValue('activeFolderId', result.defaultFolderId);
		}
	}

}

module.exports = WelcomeUtils;