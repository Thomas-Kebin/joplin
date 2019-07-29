const InteropService_Importer_Base = require('lib/services/InteropService_Importer_Base');
const BaseItem = require('lib/models/BaseItem.js');
const BaseModel = require('lib/BaseModel.js');
const Resource = require('lib/models/Resource.js');
const Folder = require('lib/models/Folder.js');
const NoteTag = require('lib/models/NoteTag.js');
const Note = require('lib/models/Note.js');
const Tag = require('lib/models/Tag.js');
const { basename, filename, rtrimSlashes } = require('lib/path-utils.js');
const fs = require('fs-extra');
const md5 = require('md5');
const { shim } = require('lib/shim');
const { _ } = require('lib/locale');
const { fileExtension } = require('lib/path-utils');

class InteropService_Importer_Md extends InteropService_Importer_Base {
	async exec(result) {
		let parentFolderId = null;

		const sourcePath = rtrimSlashes(this.sourcePath_);

		const filePaths = [];
		if (await shim.fsDriver().isDirectory(sourcePath)) {
			if (!this.options_.destinationFolder) {
				const folderTitle = await Folder.findUniqueItemTitle(basename(sourcePath));
				const folder = await Folder.save({ title: folderTitle });
				parentFolderId = folder.id;
			} else {
				parentFolderId = this.options_.destinationFolder.id;
			}

			this.importDirectory(sourcePath, parentFolderId);
		} else {
			if (!this.options_.destinationFolder) throw new Error(_('Please specify the notebook where the notes should be imported to.'));
			parentFolderId = this.options_.destinationFolder.id;
			filePaths.push(sourcePath);
		}

		for (let i = 0; i < filePaths.length; i++) {
			await this.importFile(filePaths[i], parentFolderId);
		}

		return result;
	}

	async importDirectory(dirPath, parentFolderId) {
		console.info('Import: ' + dirPath);

		const supportedFileExtension = this.metadata().fileExtensions;
		const stats = await shim.fsDriver().readDirStats(dirPath);
		for (let i = 0; i < stats.length; i++) {
			const stat = stats[i];

			if (stat.isDirectory()) {
				const folderTitle = await Folder.findUniqueItemTitle(basename(stat.path));
				const folder = await Folder.save({ title: folderTitle, parent_id: parentFolderId });
				this.importDirectory(dirPath + '/' + basename(stat.path), folder.id);
			} else if (supportedFileExtension.indexOf(fileExtension(stat.path).toLowerCase()) >= 0) {
				this.importFile(dirPath + '/' + stat.path, parentFolderId);
			}
		}
	}

	async importFile(filePath, parentFolderId) {
		const stat = await shim.fsDriver().stat(filePath);
		if (!stat) throw new Error('Cannot read ' + filePath);
		const title = filename(filePath);
		const body = await shim.fsDriver().readFile(filePath);
		const note = {
			parent_id: parentFolderId,
			title: title,
			body: body,
			updated_time: stat.mtime.getTime(),
			created_time: stat.birthtime.getTime(),
			user_updated_time: stat.mtime.getTime(),
			user_created_time: stat.birthtime.getTime(),
		};
		await Note.save(note, { autoTimestamp: false });
	}
}

module.exports = InteropService_Importer_Md;
