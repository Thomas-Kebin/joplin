const { isHidden } = require('lib/path-utils.js');
const { Logger } = require('lib/logger.js');
const { shim } = require('lib/shim');
const BaseItem = require('lib/models/BaseItem.js');
const JoplinError = require('lib/JoplinError');
const ArrayUtils = require('lib/ArrayUtils');
const { time } = require('lib/time-utils.js');
const { sprintf } = require('sprintf-js');
const Mutex = require('async-mutex').Mutex;

function requestCanBeRepeated(error) {
	const errorCode = typeof error === 'object' && error.code ? error.code : null;

	// The target is explicitely rejecting the item so repeating wouldn't make a difference.
	if (errorCode === 'rejectedByTarget') return false;

	// We don't repeat failSafe errors because it's an indication of an issue at the
	// server-level issue which usually cannot be fixed by repeating the request.
	// Also we print the previous requests and responses to the log in this case,
	// so not repeating means there will be less noise in the log.
	if (errorCode === 'failSafe') return false;

	return true;
}

async function tryAndRepeat(fn, count) {
	let retryCount = 0;

	// Don't use internal fetch retry mechanim since we
	// are already retrying here.
	const shimFetchMaxRetryPrevious = shim.fetchMaxRetrySet(0);
	const defer = () => {
		shim.fetchMaxRetrySet(shimFetchMaxRetryPrevious);
	};

	while (true) {
		try {
			const result = await fn();
			defer();
			return result;
		} catch (error) {
			if (retryCount >= count || !requestCanBeRepeated(error)) {
				defer();
				throw error;
			}
			retryCount++;
			await time.sleep(1 + retryCount * 3);
		}
	}
}

class FileApi {
	constructor(baseDir, driver) {
		this.baseDir_ = baseDir;
		this.driver_ = driver;
		this.logger_ = new Logger();
		this.syncTargetId_ = null;
		this.tempDirName_ = null;
		this.driver_.fileApi_ = this;
		this.requestRepeatCount_ = null; // For testing purpose only - normally this value should come from the driver
		this.remoteDateOffset_ = 0;
		this.remoteDateNextCheckTime_ = 0;
		this.remoteDateMutex_ = new Mutex();
	}


	async fetchRemoteDateOffset_() {
		const tempFile = `${this.tempDirName()}/timeCheck${Math.round(Math.random() * 1000000)}.txt`;
		const startTime = Date.now();
		await this.put(tempFile, 'timeCheck');

		// Normally it should be possible to read the file back immediately but
		// just in case, read it in a loop.
		const loopStartTime = Date.now();
		let stat = null;
		while (Date.now() - loopStartTime < 5000) {
			stat = await this.stat(tempFile);
			if (stat) break;
			await time.msleep(200);
		}

		if (!stat) throw new Error('Timed out trying to get sync target clock time');

		this.delete(tempFile); // No need to await for this call

		const endTime = Date.now();
		const expectedTime = Math.round((endTime + startTime) / 2);
		return stat.updated_time - expectedTime;
	}

	// Approximates the current time on the sync target. It caches the time offset to
	// improve performance.
	async remoteDate() {
		const shouldSyncTime = () => {
			return !this.remoteDateNextCheckTime_ || Date.now() > this.remoteDateNextCheckTime_;
		};

		if (shouldSyncTime()) {
			const release = await this.remoteDateMutex_.acquire();

			try {
				// Another call might have refreshed the time while we were waiting for the mutex,
				// so check again if we need to refresh.
				if (shouldSyncTime()) {
					this.remoteDateOffset_ = await this.fetchRemoteDateOffset_();
					// The sync target clock should rarely change but the device one might,
					// so we need to refresh relatively frequently.
					this.remoteDateNextCheckTime_ = Date.now() + 10 * 60 * 1000;
				}
			} catch (error) {
				this.logger().warn('Could not retrieve remote date - defaulting to device date:', error);
				this.remoteDateOffset_ = 0;
				this.remoteDateNextCheckTime_ = Date.now() + 60 * 1000;
			} finally {
				release();
			}
		}

		return new Date(Date.now() + this.remoteDateOffset_);
	}

	// Ideally all requests repeating should be done at the FileApi level to remove duplicate code in the drivers, but
	// historically some drivers (eg. OneDrive) are already handling request repeating, so this is optional, per driver,
	// and it defaults to no repeating.
	requestRepeatCount() {
		if (this.requestRepeatCount_ !== null) return this.requestRepeatCount_;
		if (this.driver_.requestRepeatCount) return this.driver_.requestRepeatCount();
		return 0;
	}

	lastRequests() {
		return this.driver_.lastRequests ? this.driver_.lastRequests() : [];
	}

	clearLastRequests() {
		if (this.driver_.clearLastRequests) this.driver_.clearLastRequests();
	}

	baseDir() {
		return this.baseDir_;
	}

	tempDirName() {
		if (this.tempDirName_ === null) throw Error('Temp dir not set!');
		return this.tempDirName_;
	}

	setTempDirName(v) {
		this.tempDirName_ = v;
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
		if (!l) l = new Logger();
		this.logger_ = l;
	}

	logger() {
		return this.logger_;
	}

	fullPath_(path) {
		const output = [];
		if (this.baseDir()) output.push(this.baseDir());
		if (path) output.push(path);
		return output.join('/');
	}

	// DRIVER MUST RETURN PATHS RELATIVE TO `path`
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	async list(path = '', options = null) {
		if (!options) options = {};
		if (!('includeHidden' in options)) options.includeHidden = false;
		if (!('context' in options)) options.context = null;
		if (!('includeDirs' in options)) options.includeDirs = true;
		if (!('syncItemsOnly' in options)) options.syncItemsOnly = false;

		this.logger().debug(`list ${this.baseDir()}`);

		const result = await tryAndRepeat(() => this.driver_.list(this.fullPath_(path), options), this.requestRepeatCount());

		if (!options.includeHidden) {
			const temp = [];
			for (let i = 0; i < result.items.length; i++) {
				if (!isHidden(result.items[i].path)) temp.push(result.items[i]);
			}
			result.items = temp;
		}

		if (!options.includeDirs) {
			result.items = result.items.filter(f => !f.isDir);
		}

		if (options.syncItemsOnly) {
			result.items = result.items.filter(f => !f.isDir && BaseItem.isSystemPath(f.path));
		}

		return result;
	}

	// Deprectated
	setTimestamp(path, timestampMs) {
		this.logger().debug(`setTimestamp ${this.fullPath_(path)}`);
		return tryAndRepeat(() => this.driver_.setTimestamp(this.fullPath_(path), timestampMs), this.requestRepeatCount());
		// return this.driver_.setTimestamp(this.fullPath_(path), timestampMs);
	}

	mkdir(path) {
		this.logger().debug(`mkdir ${this.fullPath_(path)}`);
		return tryAndRepeat(() => this.driver_.mkdir(this.fullPath_(path)), this.requestRepeatCount());
	}

	async stat(path) {
		this.logger().debug(`stat ${this.fullPath_(path)}`);

		const output = await tryAndRepeat(() => this.driver_.stat(this.fullPath_(path)), this.requestRepeatCount());

		if (!output) return output;
		output.path = path;
		return output;

		// return this.driver_.stat(this.fullPath_(path)).then((output) => {
		// 	if (!output) return output;
		// 	output.path = path;
		// 	return output;
		// });
	}

	// Returns UTF-8 encoded string by default, or a Response if `options.target = 'file'`
	get(path, options = null) {
		if (!options) options = {};
		if (!options.encoding) options.encoding = 'utf8';
		this.logger().debug(`get ${this.fullPath_(path)}`);
		return tryAndRepeat(() => this.driver_.get(this.fullPath_(path), options), this.requestRepeatCount());
	}

	async put(path, content, options = null) {
		this.logger().debug(`put ${this.fullPath_(path)}`, options);

		if (options && options.source === 'file') {
			if (!(await this.fsDriver().exists(options.path))) throw new JoplinError(`File not found: ${options.path}`, 'fileNotFound');
		}

		return tryAndRepeat(() => this.driver_.put(this.fullPath_(path), content, options), this.requestRepeatCount());
	}

	delete(path) {
		this.logger().debug(`delete ${this.fullPath_(path)}`);
		return tryAndRepeat(() => this.driver_.delete(this.fullPath_(path)), this.requestRepeatCount());
	}

	// Deprectated
	move(oldPath, newPath) {
		this.logger().debug(`move ${this.fullPath_(oldPath)} => ${this.fullPath_(newPath)}`);
		return tryAndRepeat(() => this.driver_.move(this.fullPath_(oldPath), this.fullPath_(newPath)), this.requestRepeatCount());
	}

	// Deprectated
	format() {
		return tryAndRepeat(() => this.driver_.format(), this.requestRepeatCount());
	}

	clearRoot() {
		return tryAndRepeat(() => this.driver_.clearRoot(this.baseDir()), this.requestRepeatCount());
	}

	delta(path, options = null) {
		this.logger().debug(`delta ${this.fullPath_(path)}`);
		return tryAndRepeat(() => this.driver_.delta(this.fullPath_(path), options), this.requestRepeatCount());
	}
}

function basicDeltaContextFromOptions_(options) {
	const output = {
		timestamp: 0,
		filesAtTimestamp: [],
		statsCache: null,
		statIdsCache: null,
		deletedItemsProcessed: false,
	};

	if (!options || !options.context) return output;

	const d = new Date(options.context.timestamp);

	output.timestamp = isNaN(d.getTime()) ? 0 : options.context.timestamp;
	output.filesAtTimestamp = Array.isArray(options.context.filesAtTimestamp) ? options.context.filesAtTimestamp.slice() : [];
	output.statsCache = options.context && options.context.statsCache ? options.context.statsCache : null;
	output.statIdsCache = options.context && options.context.statIdsCache ? options.context.statIdsCache : null;
	output.deletedItemsProcessed = options.context && 'deletedItemsProcessed' in options.context ? options.context.deletedItemsProcessed : false;

	return output;
}

// This is the basic delta algorithm, which can be used in case the cloud service does not have
// a built-in delta API. OneDrive and Dropbox have one for example, but Nextcloud and obviously
// the file system do not.
async function basicDelta(path, getDirStatFn, options) {
	const outputLimit = 50;
	const itemIds = await options.allItemIdsHandler();
	if (!Array.isArray(itemIds)) throw new Error('Delta API not supported - local IDs must be provided');

	const logger = options && options.logger ? options.logger : new Logger();

	const context = basicDeltaContextFromOptions_(options);

	if (context.timestamp > Date.now()) {
		logger.warn(`BasicDelta: Context timestamp is greater than current time: ${context.timestamp}`);
		logger.warn('BasicDelta: Sync will continue but it is likely that nothing will be synced');
	}

	const newContext = {
		timestamp: context.timestamp,
		filesAtTimestamp: context.filesAtTimestamp.slice(),
		statsCache: context.statsCache,
		statIdsCache: context.statIdsCache,
		deletedItemsProcessed: context.deletedItemsProcessed,
	};

	// Stats are cached until all items have been processed (until hasMore is false)
	if (newContext.statsCache === null) {
		newContext.statsCache = await getDirStatFn(path);
		newContext.statsCache.sort(function(a, b) {
			return a.updated_time - b.updated_time;
		});
		newContext.statIdsCache = newContext.statsCache.filter(item => BaseItem.isSystemPath(item.path)).map(item => BaseItem.pathToId(item.path));
		newContext.statIdsCache.sort(); // Items must be sorted to use binary search below
	}

	let output = [];

	const updateReport = {
		timestamp: context.timestamp,
		older: 0,
		newer: 0,
		equal: 0,
	};

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

		if (stat.updated_time < context.timestamp) {
			updateReport.older++;
			continue;
		}

		// Special case for items that exactly match the timestamp
		if (stat.updated_time === context.timestamp) {
			if (context.filesAtTimestamp.indexOf(stat.path) >= 0) {
				updateReport.equal++;
				continue;
			}
		}

		if (stat.updated_time > newContext.timestamp) {
			newContext.timestamp = stat.updated_time;
			newContext.filesAtTimestamp = [];
			updateReport.newer++;
		}

		newContext.filesAtTimestamp.push(stat.path);
		output.push(stat);

		if (output.length >= outputLimit) break;
	}

	logger.info(`BasicDelta: Report: ${JSON.stringify(updateReport)}`);

	if (!newContext.deletedItemsProcessed) {
		// Find out which items have been deleted on the sync target by comparing the items
		// we have to the items on the target.
		// Note that when deleted items are processed it might result in the output having
		// more items than outputLimit. This is acceptable since delete operations are cheap.
		const deletedItems = [];
		for (let i = 0; i < itemIds.length; i++) {
			const itemId = itemIds[i];

			if (ArrayUtils.binarySearch(newContext.statIdsCache, itemId) < 0) {
				deletedItems.push({
					path: BaseItem.systemPath(itemId),
					isDeleted: true,
				});
			}
		}

		const percentDeleted = itemIds.length ? deletedItems.length / itemIds.length : 0;

		// If more than 90% of the notes are going to be deleted, it's most likely a
		// configuration error or bug. For example, if the user moves their Nextcloud
		// directory, or if a network drive gets disconnected and returns an empty dir
		// instead of an error. In that case, we don't wipe out the user data, unless
		// they have switched off the fail-safe.
		if (options.wipeOutFailSafe && percentDeleted >= 0.90) throw new JoplinError(sprintf('Fail-safe: Sync was interrupted because %d%% of the data (%d items) is about to be deleted. To override this behaviour disable the fail-safe in the sync settings.', Math.round(percentDeleted * 100), deletedItems.length), 'failSafe');

		output = output.concat(deletedItems);
	}

	newContext.deletedItemsProcessed = true;

	const hasMore = output.length >= outputLimit;

	if (!hasMore) {
		// Clear temporary info from context. It's especially important to remove deletedItemsProcessed
		// so that they are processed again on the next sync.
		newContext.statsCache = null;
		newContext.statIdsCache = null;
		delete newContext.deletedItemsProcessed;
	}

	return {
		hasMore: hasMore,
		context: newContext,
		items: output,
	};
}

module.exports = { FileApi, basicDelta };
