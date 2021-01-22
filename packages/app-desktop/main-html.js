// This is the initialization for the Electron RENDERER process

// Disable React message in console "Download the React DevTools for a better development experience"
// https://stackoverflow.com/questions/42196819/disable-hide-download-the-react-devtools#42196820
// eslint-disable-next-line no-undef
__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
	supportsFiber: true,
	inject: function() {},
	onCommitFiberRoot: function() {},
	onCommitFiberUnmount: function() {},
};

const app = require('./app').default;
const Folder = require('@joplin/lib/models/Folder').default;
const Resource = require('@joplin/lib/models/Resource').default;
const BaseItem = require('@joplin/lib/models/BaseItem').default;
const Note = require('@joplin/lib/models/Note').default;
const Tag = require('@joplin/lib/models/Tag').default;
const NoteTag = require('@joplin/lib/models/NoteTag').default;
const MasterKey = require('@joplin/lib/models/MasterKey').default;
const Setting = require('@joplin/lib/models/Setting').default;
const Revision = require('@joplin/lib/models/Revision').default;
const Logger = require('@joplin/lib/Logger').default;
const FsDriverNode = require('@joplin/lib/fs-driver-node').default;
const shim = require('@joplin/lib/shim').default;
const { shimInit } = require('@joplin/lib/shim-init-node.js');
const EncryptionService = require('@joplin/lib/services/EncryptionService').default;
const bridge = require('electron').remote.require('./bridge').default;
const { FileApiDriverLocal } = require('@joplin/lib/file-api-driver-local.js');
const React = require('react');

if (bridge().env() === 'dev') {
	const newConsole = function(oldConsole) {
		const output = {};
		const fnNames = ['assert', 'clear', 'context', 'count', 'countReset', 'debug', 'dir', 'dirxml', 'error', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log', 'memory', 'profile', 'profileEnd', 'table', 'time', 'timeEnd', 'timeLog', 'timeStamp', 'trace', 'warn'];
		for (const fnName of fnNames) {
			if (fnName === 'warn') {
				output.warn = function(...text) {
					const s = [...text].join('');
					// React spams the console with walls of warnings even outside of strict mode, and even after having renamed
					// unsafe methods to UNSAFE_xxxx, so we need to hack the console to remove them...
					if (s.indexOf('Warning: componentWillReceiveProps has been renamed, and is not recommended for use') === 0) return;
					if (s.indexOf('Warning: componentWillUpdate has been renamed, and is not recommended for use.') === 0) return;
					oldConsole.warn(...text);
				};
			} else {
				output[fnName] = function(...text) {
					return oldConsole[fnName](...text);
				};
			}
		}
		return output;
	}(window.console);

	window.console = newConsole;
}

console.info(`Environment: ${bridge().env()}`);

const fsDriver = new FsDriverNode();
Logger.fsDriver_ = fsDriver;
Resource.fsDriver_ = fsDriver;
EncryptionService.fsDriver_ = fsDriver;
FileApiDriverLocal.fsDriver_ = fsDriver;

// That's not good, but it's to avoid circular dependency issues
// in the BaseItem class.
BaseItem.loadClass('Note', Note);
BaseItem.loadClass('Folder', Folder);
BaseItem.loadClass('Resource', Resource);
BaseItem.loadClass('Tag', Tag);
BaseItem.loadClass('NoteTag', NoteTag);
BaseItem.loadClass('MasterKey', MasterKey);
BaseItem.loadClass('Revision', Revision);

Setting.setConstant('appId', `net.cozic.joplin${bridge().env() === 'dev' ? 'dev' : ''}-desktop`);
Setting.setConstant('appType', 'desktop');

console.info(`appId: ${Setting.value('appId')}`);
console.info(`appType: ${Setting.value('appType')}`);

let keytar;
try {
	keytar = shim.platformSupportsKeyChain() ? require('keytar') : null;
} catch (error) {
	console.error('Cannot load keytar - keychain support will be disabled', error);
	keytar = null;
}

shimInit(null, keytar, React);

// Disable drag and drop of links inside application (which would
// open it as if the whole app was a browser)
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

// Disable middle-click (which would open a new browser window, but we don't want this)
document.addEventListener('auxclick', event => event.preventDefault());

// Each link (rendered as a button or list item) has its own custom click event
// so disable the default. In particular this will disable Ctrl+Clicking a link
// which would open a new browser window.
document.addEventListener('click', (event) => event.preventDefault());

app().start(bridge().processArgv()).then((result) => {
	if (!result || !result.action) {
		require('./gui/Root');
	} else if (result.action === 'upgradeSyncTarget') {
		require('./gui/Root_UpgradeSyncTarget');
	}
}).catch((error) => {
	const env = bridge().env();

	if (error.code == 'flagError') {
		bridge().showErrorMessageBox(error.message);
	} else {
		// If something goes wrong at this stage we don't have a console or a log file
		// so display the error in a message box.
		const msg = ['Fatal error:', error.message];
		if (error.fileName) msg.push(error.fileName);
		if (error.lineNumber) msg.push(error.lineNumber);
		if (error.stack) msg.push(error.stack);

		if (env === 'dev') {
			console.error(error);
		} else {
			bridge().showErrorMessageBox(msg.join('\n\n'));
		}
	}

	// In dev, we leave the app open as debug statements in the console can be useful
	if (env !== 'dev') bridge().electronApp().exit(1);
});
