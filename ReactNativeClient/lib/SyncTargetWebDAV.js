const BaseSyncTarget = require('lib/BaseSyncTarget.js');
const { _ } = require('lib/locale.js');
const Setting = require('lib/models/Setting.js');
const { FileApi } = require('lib/file-api.js');
const { Synchronizer } = require('lib/synchronizer.js');
const WebDavApi = require('lib/WebDavApi');
const { FileApiDriverWebDav } = require('lib/file-api-driver-webdav');

class SyncTargetWebDAV extends BaseSyncTarget {

	static id() {
		return 6;
	}

	static supportsConfigCheck() {
		return true;
	}

	static targetName() {
		return 'webdav';
	}

	static label() {
		return _('WebDAV (Beta)');
	}

	isAuthenticated() {
		return true;
	}

	static async initFileApi_(options) {
		const apiOptions = {
			baseUrl: () => options.path,
			username: () => options.username,
			password: () => options.password,
		};

		const api = new WebDavApi(apiOptions);
		const driver = new FileApiDriverWebDav(api);
		const fileApi = new FileApi('', driver);
		fileApi.setSyncTargetId(this.id());
		return fileApi;
	}

	static async checkConfig(options) {
		const fileApi = await SyncTargetWebDAV.initFileApi_(options);
		
		const output = {
			ok: false,
			errorMessage: '',
		};
		
		try {
			const result = await fileApi.stat('');
			if (!result) throw new Error('Could not access WebDAV directory');
			output.ok = true;
		} catch (error) {
			output.errorMessage = error.message;
			if (error.code) output.errorMessage += ' (Code ' + error.code + ')';
		}

		return output;
	}

	async initFileApi() {
		const fileApi = await SyncTargetWebDAV.initFileApi_({
			path: Setting.value('sync.6.path'),
			username: Setting.value('sync.6.username'),
			password: Setting.value('sync.6.password'),
		});

		fileApi.setLogger(this.logger());

		return fileApi;
	}

	async initSynchronizer() {
		return new Synchronizer(this.db(), await this.fileApi(), Setting.value('appType'));
	}

}

module.exports = SyncTargetWebDAV;