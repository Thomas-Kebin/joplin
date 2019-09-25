const moment = require('moment');
const { dirname, basename } = require('lib/path-utils.js');

class FileApiDriverOneDrive {
	constructor(api) {
		this.api_ = api;
		this.pathCache_ = {};
	}

	api() {
		return this.api_;
	}

	itemFilter_() {
		return {
			select: 'name,file,folder,fileSystemInfo,parentReference',
		};
	}

	makePath_(path) {
		return path;
	}

	makeItems_(odItems) {
		let output = [];
		for (let i = 0; i < odItems.length; i++) {
			output.push(this.makeItem_(odItems[i]));
		}
		return output;
	}

	makeItem_(odItem) {
		let output = {
			path: odItem.name,
			isDir: 'folder' in odItem,
		};

		if ('deleted' in odItem) {
			output.isDeleted = true;
		} else {
			// output.created_time = moment(odItem.fileSystemInfo.createdDateTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x');
			output.updated_time = moment(odItem.fileSystemInfo.lastModifiedDateTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x');
		}

		return output;
	}

	async statRaw_(path) {
		let item = null;
		try {
			item = await this.api_.execJson('GET', this.makePath_(path), this.itemFilter_());
		} catch (error) {
			if (error.code == 'itemNotFound') return null;
			throw error;
		}
		return item;
	}

	async stat(path) {
		let item = await this.statRaw_(path);
		if (!item) return null;
		return this.makeItem_(item);
	}

	async setTimestamp(path, timestamp) {
		let body = {
			fileSystemInfo: {
				lastModifiedDateTime:
					`${moment
						.unix(timestamp / 1000)
						.utc()
						.format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
			},
		};
		let item = await this.api_.execJson('PATCH', this.makePath_(path), null, body);
		return this.makeItem_(item);
	}

	async list(path, options = null) {
		let query = this.itemFilter_();
		let url = `${this.makePath_(path)}:/children`;

		if (options.context) {
			query = null;
			url = options.context;
		}

		let r = await this.api_.execJson('GET', url, query);

		return {
			hasMore: !!r['@odata.nextLink'],
			items: this.makeItems_(r.value),
			context: r['@odata.nextLink'],
		};
	}

	async get(path, options = null) {
		if (!options) options = {};

		try {
			if (options.target == 'file') {
				let response = await this.api_.exec('GET', `${this.makePath_(path)}:/content`, null, null, options);
				return response;
			} else {
				let content = await this.api_.execText('GET', `${this.makePath_(path)}:/content`);
				return content;
			}
		} catch (error) {
			if (error.code == 'itemNotFound') return null;
			throw error;
		}
	}

	async mkdir(path) {
		let item = await this.stat(path);
		if (item) return item;

		let parentPath = dirname(path);
		item = await this.api_.execJson('POST', `${this.makePath_(parentPath)}:/children`, this.itemFilter_(), {
			name: basename(path),
			folder: {},
		});

		return this.makeItem_(item);
	}

	async put(path, content, options = null) {
		if (!options) options = {};

		let response = null;

		try {
			if (options.source == 'file') {
				response = await this.api_.exec('PUT', `${this.makePath_(path)}:/content`, null, null, options);
			} else {
				options.headers = { 'Content-Type': 'text/plain' };
				response = await this.api_.exec('PUT', `${this.makePath_(path)}:/content`, null, content, options);
			}
		} catch (error) {
			if (error && error.code === 'BadRequest' && error.message === 'Maximum request length exceeded.') {
				error.code = 'rejectedByTarget';
				error.message = 'Resource exceeds OneDrive max file size (4MB)';
			}
			throw error;
		}

		return response;
	}

	delete(path) {
		return this.api_.exec('DELETE', this.makePath_(path));
	}

	async move() {
		// Cannot work in an atomic way because if newPath already exist, the OneDrive API throw an error
		// "An item with the same name already exists under the parent". Some posts suggest to use
		// @name.conflictBehavior [0]but that doesn't seem to work. So until Microsoft fixes this
		// it's not possible to do an atomic move.
		//
		// [0] https://stackoverflow.com/questions/29191091/onedrive-api-overwrite-on-move
		throw new Error('NOT WORKING');

		// let previousItem = await this.statRaw_(oldPath);

		// let newDir = dirname(newPath);
		// let newName = basename(newPath);

		// // We don't want the modification date to change when we move the file so retrieve it
		// // now set it in the PATCH operation.

		// let item = await this.api_.execJson('PATCH', this.makePath_(oldPath), this.itemFilter_(), {
		// 	name: newName,
		// 	parentReference: { path: newDir },
		// 	fileSystemInfo: {
		// 		lastModifiedDateTime: previousItem.fileSystemInfo.lastModifiedDateTime,
		// 	},
		// });

		// return this.makeItem_(item);
	}

	format() {
		throw new Error('Not implemented');
	}

	async pathDetails_(path) {
		if (this.pathCache_[path]) return this.pathCache_[path];
		let output = await this.api_.execJson('GET', path);
		this.pathCache_[path] = output;
		return this.pathCache_[path];
	}

	clearRoot() {
		throw new Error('Not implemented');
	}

	async delta(path, options = null) {
		let output = {
			hasMore: false,
			context: {},
			items: [],
		};

		const freshStartDelta = () => {
			const url = `${this.makePath_(path)}:/delta`;
			const query = this.itemFilter_();
			query.select += ',deleted';
			return { url: url, query: query };
		};

		const pathDetails = await this.pathDetails_(path);
		const pathId = pathDetails.id;

		let context = options ? options.context : null;
		let url = context ? context.nextLink : null;
		let query = null;

		if (!url) {
			const info = freshStartDelta();
			url = info.url;
			query = info.query;
		}

		let response = null;
		try {
			response = await this.api_.execJson('GET', url, query);
		} catch (error) {
			if (error.code === 'resyncRequired') {
				// Error: Resync required. Replace any local items with the server's version (including deletes) if you're sure that the service was up to date with your local changes when you last sync'd. Upload any local changes that the server doesn't know about.
				// Code: resyncRequired
				// Request: GET https://graph.microsoft.com/v1.0/drive/root:/Apps/JoplinDev:/delta?select=...

				// The delta token has expired or is invalid and so a full resync is required. This happens for example when all the items
				// on the OneDrive App folder are manually deleted. In this case, instead of sending the list of deleted items in the delta
				// call, OneDrive simply request the client to re-sync everything.

				// OneDrive provides a URL to resume syncing from but it does not appear to work so below we simply start over from
				// the beginning. The synchronizer will ensure that no duplicate are created and conflicts will be resolved.

				// More info there: https://stackoverflow.com/q/46941371/561309

				const info = freshStartDelta();
				url = info.url;
				query = info.query;
				response = await this.api_.execJson('GET', url, query);
			} else {
				throw error;
			}
		}

		let items = [];

		// The delta API might return things that happen in subdirectories of the root and we don't want to
		// deal with these since all the files we're interested in are at the root (The .resource dir
		// is special since it's managed directly by the clients and resources never change - only the
		// associated .md file at the root is synced). So in the loop below we check that the parent is
		// indeed the root, otherwise the item is skipped.
		// (Not sure but it's possible the delta API also returns events for files that are copied outside
		//  of the app directory and later deleted or modified. We also don't want to deal with
		//  these files during sync).

		for (let i = 0; i < response.value.length; i++) {
			const v = response.value[i];
			if (v.parentReference.id !== pathId) continue;
			items.push(this.makeItem_(v));
		}

		output.items = output.items.concat(items);

		let nextLink = null;

		if (response['@odata.nextLink']) {
			nextLink = response['@odata.nextLink'];
			output.hasMore = true;
		} else {
			if (!response['@odata.deltaLink']) throw new Error(`Delta link missing: ${JSON.stringify(response)}`);
			nextLink = response['@odata.deltaLink'];
		}

		output.context = { nextLink: nextLink };

		// https://dev.onedrive.com/items/view_delta.htm
		// The same item may appear more than once in a delta feed, for various reasons. You should use the last occurrence you see.
		// So remove any duplicate item from the array.
		let temp = [];
		let seenPaths = [];
		for (let i = output.items.length - 1; i >= 0; i--) {
			let item = output.items[i];
			if (seenPaths.indexOf(item.path) >= 0) continue;
			temp.splice(0, 0, item);
			seenPaths.push(item.path);
		}

		output.items = temp;

		return output;
	}
}

module.exports = { FileApiDriverOneDrive };
