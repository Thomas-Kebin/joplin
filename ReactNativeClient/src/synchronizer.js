import { Log } from 'src/log.js';
import { Setting } from 'src/models/setting.js';
import { Change } from 'src/models/change.js';
import { Folder } from 'src/models/folder.js';
import { Note } from 'src/models/note.js';
import { BaseModel } from 'src/base-model.js';
import { promiseChain } from 'src/promise-chain.js';
import moment from 'moment';

const fs = require('fs');
const path = require('path');

class Synchronizer {

	constructor(db, api) {
		this.state_ = 'idle';
		this.db_ = db;
		this.api_ = api;
	}

	state() {
		return this.state_;
	}

	db() {
		return this.db_;
	}

	api() {
		return this.api_;
	}

	loadParentAndItem(change) {
		if (change.item_type == BaseModel.ITEM_TYPE_NOTE) {
			return Note.load(change.item_id).then((note) => {
				if (!note) return { parent:null, item: null };

				return Folder.load(note.parent_id).then((folder) => {
					return Promise.resolve({ parent: folder, item: note });
				});
			});
		} else {
			return Folder.load(change.item_id).then((folder) => {
				return Promise.resolve({ parent: null, item: folder });
			});
		}
	}

	remoteFileByName(remoteFiles, name) {
		for (let i = 0; i < remoteFiles.length; i++) {
			if (remoteFiles[i].name == name) return remoteFiles[i];
		}
		return null;
	}

	conflictDir(remoteFiles) {
		let d = this.remoteFileByName('Conflicts');
		if (!d) {
			return this.api().mkdir('Conflicts').then(() => {
				return 'Conflicts';
			});
		} else {
			return Promise.resolve('Conflicts');
		}
	}

	moveConflict(item) {
		// No need to handle folder conflicts
		if (item.isDir) return Promise.resolve();

		return this.conflictDir().then((conflictDirPath) => {
			let p = path.basename(item.name).split('.');
			let pos = item.isDir ? p.length - 1 : p.length - 2;
			p.splice(pos, 0, moment().format('YYYYMMDDThhmmss'));
			let newName = p.join('.');
			return this.api().move(item.name, conflictDirPath + '/' + newName);
		});
	}

	processState_uploadChanges() {
		let remoteFiles = [];
		let processedChangeIds = [];
		return this.api().list('', true).then((items) => {
			remoteFiles = items;
			return Change.all();
		}).then((changes) => {
			let mergedChanges = Change.mergeChanges(changes);
			let chain = [];
			for (let i = 0; i < mergedChanges.length; i++) {
				let c = mergedChanges[i];
				chain.push(() => {
					let p = null;

					let ItemClass = null;					
					if (c.item_type == BaseModel.ITEM_TYPE_FOLDER) {
						ItemClass = Folder;
					} else if (c.item_type == BaseModel.ITEM_TYPE_NOTE) {
						ItemClass = Note;
					}

					if (c.type == Change.TYPE_NOOP) {
						p = Promise.resolve();
					} else if (c.type == Change.TYPE_CREATE) {
						p = this.loadParentAndItem(c).then((result) => {
							if (!result.item) return; // Change refers to an object that doesn't exist (has probably been deleted directly in the database)

							let path = ItemClass.systemPath(result.parent, result.item);

							let remoteFile = this.remoteFileByName(remoteFiles, path);
							let p = null;
							if (remoteFile) {
								p = this.moveConflict(remoteFile);
							} else {
								p = Promise.resolve();
							}

							return p.then(() => {
								if (c.item_type == BaseModel.ITEM_TYPE_FOLDER) {
									return this.api().mkdir(path);
								} else {
									return this.api().put(path, Note.toFriendlyString(result.item));
								}
							});
						});
					}

					// TODO: handle UPDATE
					// TODO: handle DELETE

					return p.then(() => {
						processedChangeIds = processedChangeIds.concat(c.ids);
					}).catch((error) => {
						Log.warn('Failed applying changes', c.ids, error);
						// This is fine - trying to apply changes to an object that has been deleted
						// if (error.type == 'NotFoundException') {
						// 	processedChangeIds = processedChangeIds.concat(c.ids);
						// } else {
						// 	throw error;
						// }
					});
				});
			}

			return promiseChain(chain);
		}).catch((error) => {
			Log.warn('Synchronization was interrupted due to an error:', error);
		}).then(() => {
			Log.info('IDs to delete: ', processedChangeIds);
			// Change.deleteMultiple(processedChangeIds);
		}).then(() => {
			this.processState('downloadChanges');
		});


		// }).then(() => {
		// 	return Change.all();
		// }).then((changes) => {
		// 	let mergedChanges = Change.mergeChanges(changes);
		// 	let chain = [];
		// 	let processedChangeIds = [];
		// 	for (let i = 0; i < mergedChanges.length; i++) {
		// 		let c = mergedChanges[i];
		// 		chain.push(() => {
		// 			let p = null;

		// 			let ItemClass = null;					
		// 			let path = null;
		// 			if (c.item_type == BaseModel.ITEM_TYPE_FOLDER) {
		// 				ItemClass = Folder;
		// 				path = 'folders';
		// 			} else if (c.item_type == BaseModel.ITEM_TYPE_NOTE) {
		// 				ItemClass = Note;
		// 				path = 'notes';
		// 			}

		// 			if (c.type == Change.TYPE_NOOP) {
		// 				p = Promise.resolve();
		// 			} else if (c.type == Change.TYPE_CREATE) {
		// 				p = this.loadParentAndItem(c).then((result) => {
		// 					// let options = {
		// 					// 	contents: Note.toFriendlyString(result.item),
		// 					// 	path: Note.systemPath(result.parent, result.item),
		// 					// 	mode: 'overwrite',
		// 					// 	// client_modified: 
		// 					// };						

		// 					// return this.api().filesUpload(options).then((result) => {
		// 					// 	console.info('DROPBOX', result);
		// 					// });
		// 				});
		// 				// p = ItemClass.load(c.item_id).then((item) => {

		// 				// 	console.info(item);
		// 				// 	let options = {
		// 				// 		contents: Note.toFriendlyString(item),
		// 				// 		path: Note.systemPath(item),
		// 				// 		mode: 'overwrite',
		// 				// 		// client_modified: 
		// 				// 	};

		// 				// 	// console.info(options);

		// 				// 	//let content = Note.toFriendlyString(item);
		// 				// 	//console.info(content);

		// 				// 	//console.info('SYNC', item);
		// 				// 	//return this.api().put(path + '/' + item.id, null, item);
		// 				// });
		// 			} else if (c.type == Change.TYPE_UPDATE) {
		// 				p = ItemClass.load(c.item_id).then((item) => {
		// 					//return this.api().patch(path + '/' + item.id, null, item);
		// 				});
		// 			} else if (c.type == Change.TYPE_DELETE) {
		// 				p = this.api().delete(path + '/' + c.item_id);
		// 			}

		// 			return p.then(() => {
		// 				processedChangeIds = processedChangeIds.concat(c.ids);
		// 			}).catch((error) => {
		// 				// Log.warn('Failed applying changes', c.ids, error.message, error.type);
		// 				// This is fine - trying to apply changes to an object that has been deleted
		// 				if (error.type == 'NotFoundException') {
		// 					processedChangeIds = processedChangeIds.concat(c.ids);
		// 				} else {
		// 					throw error;
		// 				}
		// 			});
		// 		});
		// 	}

		// 	return promiseChain(chain).catch((error) => {
		// 		Log.warn('Synchronization was interrupted due to an error:', error);
		// 	}).then(() => {
		// 		// Log.info('IDs to delete: ', processedChangeIds);
		// 		// Change.deleteMultiple(processedChangeIds);
		// 	}).then(() => {
		// 		this.processState('downloadChanges');
		// 	});
		// });
	}

	processState_downloadChanges() {
		let maxRevId = null;
		let hasMore = false;
		this.api().get('synchronizer', { rev_id: Setting.value('sync.lastRevId') }).then((syncOperations) => {
			hasMore = syncOperations.has_more;
			let chain = [];
			for (let i = 0; i < syncOperations.items.length; i++) {
				let syncOp = syncOperations.items[i];
				if (syncOp.id > maxRevId) maxRevId = syncOp.id;

				let ItemClass = null;					
				if (syncOp.item_type == 'folder') {
					ItemClass = Folder;
				} else if (syncOp.item_type == 'note') {
					ItemClass = Note;
				}

				if (syncOp.type == 'create') {
					chain.push(() => {
						let item = ItemClass.fromApiResult(syncOp.item);
						// TODO: automatically handle NULL fields by checking type and default value of field
						if ('parent_id' in item && !item.parent_id) item.parent_id = '';
						return ItemClass.save(item, { isNew: true, trackChanges: false });
					});
				}

				if (syncOp.type == 'update') {
					chain.push(() => {
						return ItemClass.load(syncOp.item_id).then((item) => {
							if (!item) return;
							item = ItemClass.applyPatch(item, syncOp.item);
							return ItemClass.save(item, { trackChanges: false });
						});
					});
				}

				if (syncOp.type == 'delete') {
					chain.push(() => {
						return ItemClass.delete(syncOp.item_id, { trackChanges: false });
					});
				}
			}
			return promiseChain(chain);
		}).then(() => {
			Log.info('All items synced. has_more = ', hasMore);
			if (maxRevId) {
				Setting.setValue('sync.lastRevId', maxRevId);
				return Setting.saveAll();
			}
		}).then(() => {
			if (hasMore) {
				this.processState('downloadChanges');
			} else {
				this.processState('idle');
			}
		}).catch((error) => {
			Log.warn('Sync error', error);
		});
	}

	processState(state) {
		Log.info('Sync: processing: ' + state);
		this.state_ = state;

		if (state == 'uploadChanges') {
			return this.processState_uploadChanges();
		} else if (state == 'downloadChanges') {
			return this.processState('idle');
			//this.processState_downloadChanges();
		} else if (state == 'idle') {
			// Nothing
		} else {
			throw new Error('Invalid state: ' . state);
		}
	}

	start() {
		Log.info('Sync: start');

		if (this.state() != 'idle') {
			Log.info("Sync: cannot start synchronizer because synchronization already in progress. State: " + this.state());
			return;
		}

		// if (!this.api().session()) {
		// 	Log.info("Sync: cannot start synchronizer because user is not logged in.");
		// 	return;
		// }

		return this.processState('uploadChanges');
	}

}

export { Synchronizer };