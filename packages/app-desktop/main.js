// This is the basic initialization for the Electron MAIN process

const electronApp = require('electron').app;
const ElectronAppWrapper = require('./ElectronAppWrapper').default;
const { initBridge } = require('./bridge');
const Logger = require('@joplinapp/lib/Logger').default;
const FsDriverNode = require('@joplinapp/lib/fs-driver-node').default;
const envFromArgs = require('@joplinapp/lib/envFromArgs');

process.on('unhandledRejection', (reason, p) => {
	console.error('Unhandled promise rejection', p, 'reason:', reason);
	process.exit(1);
});

// Likewise, we want to know if a profile is specified early, in particular
// to save the window state data.
function profileFromArgs(args) {
	if (!args) return null;
	const profileIndex = args.indexOf('--profile');
	if (profileIndex <= 0 || profileIndex >= args.length - 1) return null;
	const profileValue = args[profileIndex + 1];
	return profileValue ? profileValue : null;
}

Logger.fsDriver_ = new FsDriverNode();

const env = envFromArgs(process.argv);
const profilePath = profileFromArgs(process.argv);
const isDebugMode = !!process.argv && process.argv.indexOf('--debug') >= 0;

const wrapper = new ElectronAppWrapper(electronApp, env, profilePath, isDebugMode);

initBridge(wrapper);

wrapper.start().catch((error) => {
	console.error('Electron App fatal error:');
	console.error(error);
});
