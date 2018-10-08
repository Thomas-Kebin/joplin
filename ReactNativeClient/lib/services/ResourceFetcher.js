const Resource = require('lib/models/Resource');
const BaseService = require('lib/services/BaseService');
const BaseSyncTarget = require('lib/BaseSyncTarget');
const { Logger } = require('lib/logger.js');
const EventEmitter = require('events');

class ResourceFetcher extends BaseService {

	constructor(fileApi = null) {
		super();
		
		this.setFileApi(fileApi);
		this.logger_ = new Logger();
		this.queue_ = [];
		this.fetchingItems_ = {};
		this.resourceDirName_ = BaseSyncTarget.resourceDirName();
		this.maxDownloads_ = 3;
		this.addingResources_ = false;
		this.eventEmitter_ = new EventEmitter();
	}

	static instance() {
		if (this.instance_) return this.instance_;
		this.instance_ = new ResourceFetcher();
		return this.instance_;
	}

	on(eventName, callback) {
		return this.eventEmitter_.on(eventName, callback);
	}

	off(eventName, callback) {
		return this.eventEmitter_.removeListener(eventName, callback);
	}

	setLogger(logger) {
		this.logger_ = logger;
	}

	logger() {
		return this.logger_;
	}

	setFileApi(v) {
		if (v !== null && typeof v !== 'function') throw new Error('fileApi must be a function that returns the API. Type is ' + (typeof v));
		this.fileApi_ = v;
	}

	async fileApi() {
		return this.fileApi_();
	}

	queuedItemIndex_(resourceId) {
		for (let i = 0; i < this.fetchingItems_.length; i++) {
			const item = this.fetchingItems_[i];
			if (item.id === resourceId) return i;
		}
		return -1;
	}

	queueDownload(resourceId, priority = null) {
		if (priority === null) priority = 'normal';

		const index = this.queuedItemIndex_(resourceId);
		if (index >= 0) return false;

		const item = { id: resourceId };

		if (priority === 'high') {
			this.queue_.splice(0, 0, item);
		} else {
			this.queue_.push(item);
		}

		this.scheduleQueueProcess();
		return true;
	}

	async startDownload_(resourceId) {
		if (this.fetchingItems_[resourceId]) return;
		this.fetchingItems_[resourceId] = true;

		const resource = await Resource.load(resourceId);

		this.fetchingItems_[resourceId] = resource;

		const localResourceContentPath = Resource.fullPath(resource);
		const remoteResourceContentPath = this.resourceDirName_ + "/" + resource.id;

		await Resource.saveFetchStatus(resource.id, Resource.FETCH_STATUS_STARTED);

		const fileApi = await this.fileApi();

		this.logger().debug('ResourceFetcher: Downloading resource: ' + resource.id);

		const completeDownload = () => {
			delete this.fetchingItems_[resource.id];
			this.scheduleQueueProcess();
			this.eventEmitter_.emit('downloadComplete', { id: resource.id });
		}

		fileApi.get(remoteResourceContentPath, { path: localResourceContentPath, target: "file" }).then(async () => {
			await Resource.saveFetchStatus(resource.id, Resource.FETCH_STATUS_DONE);
			this.logger().debug('ResourceFetcher: Resource downloaded: ' + resource.id);
			completeDownload();
		}).catch(async (error) => {
			this.logger().error('ResourceFetcher: Could not download resource: ' + resource.id, error);
			await Resource.saveFetchStatus(resource.id, Resource.FETCH_STATUS_ERROR, error.message);
			completeDownload();
		});
	}

	processQueue_() {
		while (Object.getOwnPropertyNames(this.fetchingItems_).length < this.maxDownloads_) {
			if (!this.queue_.length) break;
			const item = this.queue_.splice(0, 1)[0];
			this.startDownload_(item.id);
		}

		if (!this.queue_.length) {
			this.autoAddResources(10);
		}
	}

	async waitForAllFinished() {
		return new Promise((resolve, reject) => {
			const iid = setInterval(() => {
				if (!this.queue_.length && !Object.getOwnPropertyNames(this.fetchingItems_).length) {
					clearInterval(iid);
					resolve();
				}
			}, 100);
		});
	}

	async autoAddResources(limit) {
		if (this.addingResources_) return;
		this.addingResources_ = true;

		let count = 0;
		const resources = await Resource.needToBeFetched(limit);
		for (let i = 0; i < resources.length; i++) {
			const added = this.queueDownload(resources[i].id);
			if (added) count++;
		}

		this.logger().info('ResourceFetcher: Auto-added resources: ' + count);
		this.addingResources_ = false;
	}

	async start() {
		await Resource.resetStartedFetchStatus();
		this.autoAddResources(10);
	}

	scheduleQueueProcess() {
		if (this.scheduleQueueProcessIID_) {
			clearTimeout(this.scheduleQueueProcessIID_);
			this.scheduleQueueProcessIID_ = null;
		}

		this.scheduleQueueProcessIID_ = setTimeout(() => {
			this.processQueue_();
			this.scheduleQueueProcessIID_ = null;
		}, 100);
	}

	async fetchAll() {
		await Resource.resetStartedFetchStatus();
		this.autoAddResources(null);
	}

}

module.exports = ResourceFetcher;