// This is the basic initialization for the Electron MAIN process

// Make it possible to require("/lib/...") without specifying full path
require('app-module-path').addPath(__dirname);

const electronApp = require('electron').app;
const { ElectronAppWrapper } = require('./ElectronAppWrapper');
const { initBridge } = require('./bridge');
const { Logger } = require('lib/logger.js');
const { FsDriverNode } = require('lib/fs-driver-node.js');

process.on('unhandledRejection', (reason, p) => {
	console.error('Unhandled promise rejection', p, 'reason:', reason);
	process.exit(1);
});

// Flags are parsed properly in BaseApplication, however it's better to have
// the env as early as possible to enable debugging capabilities.
function envFromArgs(args) {
	if (!args) return 'prod';
	const envIndex = args.indexOf('--env');
	const devIndex = args.indexOf('dev');
	if (envIndex === devIndex - 1) return 'dev';
	return 'prod';
}

Logger.fsDriver_ = new FsDriverNode();

const env = envFromArgs(process.argv);

const wrapper = new ElectronAppWrapper(electronApp, env);

initBridge(wrapper);

wrapper.start().catch((error) => {
	console.error('Electron App fatal error:');
	console.error(error);
});