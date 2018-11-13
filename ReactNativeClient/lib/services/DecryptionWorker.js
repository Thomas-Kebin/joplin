const BaseItem = require('lib/models/BaseItem');
const Resource = require('lib/models/Resource');
const { Logger } = require('lib/logger.js');

class DecryptionWorker {

	constructor() {
		this.state_ = 'idle';
		this.logger_ = new Logger();

		this.dispatch = (action) => {
			//console.warn('DecryptionWorker.dispatch is not defined');
		};

		this.scheduleId_ = null;
	}

	setLogger(l) {
		this.logger_ = l;
	}

	logger() {
		return this.logger_;
	}

	static instance() {
		if (this.instance_) return this.instance_;
		this.instance_ = new DecryptionWorker();
		return this.instance_;
	}

	setEncryptionService(v) {
		this.encryptionService_ = v;
	}

	encryptionService() {
		if (!this.encryptionService_) throw new Error('DecryptionWorker.encryptionService_ is not set!!');
		return this.encryptionService_;
	}

	async scheduleStart() {
		if (this.scheduleId_) return;

		this.scheduleId_ = setTimeout(() => {
			this.scheduleId_ = null;
			this.start({
				masterKeyNotLoadedHandler: 'dispatch',
			});
		}, 1000);
	}

	dispatchReport(report) {
		const action = Object.assign({}, report);
		action.type = 'DECRYPTION_WORKER_SET';
		this.dispatch(action);
	}

	async start(options = null) {
		if (options === null) options = {};
		if (!('masterKeyNotLoadedHandler' in options)) options.masterKeyNotLoadedHandler = 'throw';

		if (this.state_ !== 'idle') {
			this.logger().info('DecryptionWorker: cannot start because state is "' + this.state_ + '"');
			return;
		}

		this.logger().info('DecryptionWorker: starting decryption...');

		this.state_ = 'started';

		let excludedIds = [];

		this.dispatchReport({ state: 'started' });

		try {
			const notLoadedMasterKeyDisptaches = [];

			while (true) {
				const result = await BaseItem.itemsThatNeedDecryption(excludedIds);
				const items = result.items;

				for (let i = 0; i < items.length; i++) {
					const item = items[i];

					const ItemClass = BaseItem.itemClass(item);

					if (item.type_ === Resource.modelType()) {
						const ls = await Resource.localState(item);
						if (ls.fetch_status !== Resource.FETCH_STATUS_DONE) {
							excludedIds.push(item.id);
							continue;
						}
					}

					this.dispatchReport({
						itemIndex: i,
						itemCount: items.length,
					});
					
					// Don't log in production as it results in many messages when importing many items
					// this.logger().info('DecryptionWorker: decrypting: ' + item.id + ' (' + ItemClass.tableName() + ')');
					try {
						await ItemClass.decrypt(item);
					} catch (error) {
						excludedIds.push(item.id);
						
						if (error.code === 'masterKeyNotLoaded' && options.masterKeyNotLoadedHandler === 'dispatch') {
							if (notLoadedMasterKeyDisptaches.indexOf(error.masterKeyId) < 0) {
								this.dispatch({
									type: 'MASTERKEY_ADD_NOT_LOADED',
									id: error.masterKeyId,
								});
								notLoadedMasterKeyDisptaches.push(error.masterKeyId);
							}
							continue;
						}

						if (error.code === 'masterKeyNotLoaded' && options.masterKeyNotLoadedHandler === 'throw') {
							throw error;
						}

						this.logger().warn('DecryptionWorker: error for: ' + item.id + ' (' + ItemClass.tableName() + ')', error, item);
					}
				}

				if (!result.hasMore) break;
			}
		} catch (error) {
			this.logger().error('DecryptionWorker:', error);
			this.state_ = 'idle';
			this.dispatchReport({ state: 'idle' });
			throw error;
		}

		this.logger().info('DecryptionWorker: completed decryption.');

		this.dispatchReport({ state: 'idle' });

		this.state_ = 'idle';
	}

}

module.exports = DecryptionWorker;