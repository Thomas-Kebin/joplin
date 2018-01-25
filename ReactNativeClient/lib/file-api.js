const { isHidden } = require('lib/path-utils.js');
const { Logger } = require('lib/logger.js');
const { shim } = require('lib/shim');
const BaseItem = require('lib/models/BaseItem.js');
const JoplinError = require('lib/JoplinError');

class FileApi {

	constructor(baseDir, driver) {
		this.baseDir_ = baseDir;
		this.driver_ = driver;
		this.logger_ = new Logger();
		this.syncTargetId_ = null;
	}

	fsDriver() {
		return shim.fsDriver();
	}

	driver() {
		return this.driver_;
	}

	setSyncTargetId(v) {
		this.syncTargetId_ = v;
	}

	syncTargetId() {
		if (this.syncTargetId_ === null) throw new Error('syncTargetId has not been set!!');
		return this.syncTargetId_;
	}

	setLogger(l) {
		this.logger_ = l;
	}

	logger() {
		return this.logger_;
	}

	fullPath_(path) {
		let output = this.baseDir_;
		if (path != '') output += '/' + path;
		return output;
	}

	// DRIVER MUST RETURN PATHS RELATIVE TO `path`
	list(path = '', options = null) {
		if (!options) options = {};
		if (!('includeHidden' in options)) options.includeHidden = false;
		if (!('context' in options)) options.context = null;

		this.logger().debug('list ' + this.baseDir_);

		return this.driver_.list(this.baseDir_, options).then((result) => {
			if (!options.includeHidden) {
				let temp = [];
				for (let i = 0; i < result.items.length; i++) {
					if (!isHidden(result.items[i].path)) temp.push(result.items[i]);
				}
				result.items = temp;
			}
			return result;
		});
	}

	setTimestamp(path, timestampMs) {
		this.logger().debug('setTimestamp ' + this.fullPath_(path));
		return this.driver_.setTimestamp(this.fullPath_(path), timestampMs);
	}

	mkdir(path) {
		this.logger().debug('mkdir ' + this.fullPath_(path));
		return this.driver_.mkdir(this.fullPath_(path));
	}

	stat(path) {
		this.logger().debug('stat ' + this.fullPath_(path));
		return this.driver_.stat(this.fullPath_(path)).then((output) => {
			if (!output) return output;
			output.path = path;
			return output;
		});
	}

	get(path, options = null) {
		if (!options) options = {};
		if (!options.encoding) options.encoding = 'utf8';
		this.logger().debug('get ' + this.fullPath_(path));
		return this.driver_.get(this.fullPath_(path), options);
	}

	async put(path, content, options = null) {
		this.logger().debug('put ' + this.fullPath_(path), options);
		
		if (options && options.source === 'file') {
			if (!await this.fsDriver().exists(options.path)) throw new JoplinError('File not found: ' + options.path, 'fileNotFound');
		}

		return this.driver_.put(this.fullPath_(path), content, options);
	}

	delete(path) {
		this.logger().debug('delete ' + this.fullPath_(path));
		return this.driver_.delete(this.fullPath_(path));
	}

	move(oldPath, newPath) {
		this.logger().debug('move ' + this.fullPath_(oldPath) + ' => ' + this.fullPath_(newPath));
		return this.driver_.move(this.fullPath_(oldPath), this.fullPath_(newPath));
	}

	format() {
		return this.driver_.format();
	}

	delta(path, options = null) {
		this.logger().debug('delta ' + this.fullPath_(path));
		return this.driver_.delta(this.fullPath_(path), options);
	}

}

function basicDeltaContextFromOptions_(options) {
	let output = {
		timestamp: 0,
		filesAtTimestamp: [],
		statsCache: null,
	};

	if (!options || !options.context) return output;
	const d = new Date(options.context.timestamp);

	output.timestamp = isNaN(d.getTime()) ? 0 : options.context.timestamp;
	output.filesAtTimestamp = Array.isArray(options.context.filesAtTimestamp) ? options.context.filesAtTimestamp.slice() : [];
	output.statsCache = options.context && options.context.statsCache ? options.context.statsCache : null;

	return output;
}

// This is the basic delta algorithm, which can be used in case the cloud service does not have
// a built-in delta API. OneDrive and Dropbox have one for example, but Nextcloud and obviously
// the file system do not.
async function basicDelta(path, getDirStatFn, options) {
	const outputLimit = 1000;
	const itemIds = await options.allItemIdsHandler();
	if (!Array.isArray(itemIds)) throw new Error('Delta API not supported - local IDs must be provided');

	const context = basicDeltaContextFromOptions_(options);

	let newContext = {
		timestamp: context.timestamp,
		filesAtTimestamp: context.filesAtTimestamp.slice(),
		statsCache: context.statsCache,
	};

	// Stats are cached until all items have been processed (until hasMore is false)
	if (newContext.statsCache === null) {
		newContext.statsCache = await getDirStatFn(path);
		newContext.statsCache.sort(function(a, b) {
			return a.updated_time - b.updated_time;
		});
	}

	let output = [];

	// Find out which files have been changed since the last time. Note that we keep
	// both the timestamp of the most recent change, *and* the items that exactly match
	// this timestamp. This to handle cases where an item is modified while this delta
	// function is running. For example:
	// t0: Item 1 is changed
	// t0: Sync items - run delta function
	// t0: While delta() is running, modify Item 2
	// Since item 2 was modified within the same millisecond, it would be skipped in the
	// next sync if we relied exclusively on a timestamp.
	for (let i = 0; i < newContext.statsCache.length; i++) {
		const stat = newContext.statsCache[i];

		if (stat.isDir) continue;

		if (stat.updated_time < context.timestamp) continue;

		// Special case for items that exactly match the timestamp
		if (stat.updated_time === context.timestamp) {
			if (context.filesAtTimestamp.indexOf(stat.path) >= 0) continue;
		}

		if (stat.updated_time > newContext.timestamp) {
			newContext.timestamp = stat.updated_time;
			newContext.filesAtTimestamp = [];
		}

		newContext.filesAtTimestamp.push(stat.path);
		output.push(stat);

		if (output.length >= outputLimit) break;
	}

	// Find out which items have been deleted on the sync target by comparing the items
	// we have to the items on the target.
	let deletedItems = [];
	for (let i = 0; i < itemIds.length; i++) {
		if (output.length + deletedItems.length >= outputLimit) break;

		const itemId = itemIds[i];
		let found = false;
		for (let j = 0; j < newContext.statsCache.length; j++) {
			const item = newContext.statsCache[j];
			if (BaseItem.pathToId(item.path) == itemId) {
				found = true;
				break;
			}
		}

		if (!found) {
			deletedItems.push({
				path: BaseItem.systemPath(itemId),
				isDeleted: true,
			});
		}
	}

	output = output.concat(deletedItems);

	const hasMore = output.length >= outputLimit;
	if (!hasMore) newContext.statsCache = null;

	return {
		hasMore: hasMore,
		context: newContext,
		items: output,
	};
}

module.exports = { FileApi, basicDelta };