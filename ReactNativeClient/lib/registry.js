import { Logger } from 'lib/logger.js';
import { Setting } from 'lib/models/setting.js';
import { OneDriveApi } from 'lib/onedrive-api.js';
import { FileApi } from 'lib/file-api.js';
import { Synchronizer } from 'lib/synchronizer.js';
import { FileApiDriverOneDrive } from 'lib/file-api-driver-onedrive.js';

const reg = {};

reg.logger = () => {
	if (reg.logger_) return reg.logger_;
	reg.logger_ = new Logger();
	reg.logger_.addTarget('console');
	reg.logger_.setLevel(Logger.LEVEL_DEBUG);
	return reg.logger_;
}

reg.oneDriveApi = () => {
	if (reg.oneDriveApi_) return reg.oneDriveApi_;

	const CLIENT_ID = 'e09fc0de-c958-424f-83a2-e56a721d331b';
	const CLIENT_SECRET = 'JA3cwsqSGHFtjMwd5XoF5L5';
	const isPublic = Setting.value('appType') != 'cli';

	reg.oneDriveApi_ = new OneDriveApi(CLIENT_ID, CLIENT_SECRET, isPublic);

	reg.oneDriveApi_.on('authRefreshed', (a) => {
		reg.logger().info('Saving updated OneDrive auth.');
		Setting.setValue('sync.onedrive.auth', a ? JSON.stringify(a) : null);
	});

	let auth = Setting.value('sync.onedrive.auth');
	if (auth) {
		try {
			auth = JSON.parse(auth);
		} catch (error) {
			reg.logger().warn('Could not parse OneDrive auth token');
			reg.logger().warn(error);
			auth = null;
		}

		reg.oneDriveApi_.setAuth(auth);
	}
	
	return reg.oneDriveApi_;
}

reg.fileApi = async () => {
	if (reg.fileApi_) return reg.fileApi_;

	let driver = new FileApiDriverOneDrive(reg.oneDriveApi());
	let appDir = await reg.oneDriveApi().appDirectory();

	reg.fileApi_ = new FileApi(appDir, driver);
	reg.fileApi_.setLogger(reg.logger());

	return reg.fileApi_;
}

reg.synchronizer = async () => {
	if (reg.synchronizer_) return reg.synchronizer_;

	if (!reg.db()) throw new Error('Cannot initialize synchronizer: db not initialized');

	let fileApi = await reg.fileApi();
	reg.synchronizer_ = new Synchronizer(reg.db(), fileApi, Setting.value('appType'));
	reg.synchronizer_.setLogger(reg.logger());
	return reg.synchronizer_;
}

reg.setDb = (v) => {
	reg.db_ = v;
}

reg.db = () => {
	return reg.db_;
}

export { reg }