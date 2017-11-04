const { _ } = require('lib/locale.js');
const { BrowserWindow } = require('electron');
const url = require('url')
const path = require('path')

class ElectronAppWrapper {

	constructor(electronApp) {
		this.electronApp_ = electronApp;
		this.loadState_ = 'start';
		this.win_ = null;

		this.electronApp_.on('ready', () => {
			this.loadState_ = 'ready';
		});
	}

	createWindow() {
		// Create the browser window.
		this.win_ = new BrowserWindow({width: 800, height: 600})

		// and load the index.html of the app.
		this.win_.loadURL(url.format({
			pathname: path.join(__dirname, 'index.html'),
			protocol: 'file:',
			slashes: true
		}))

		// Open the DevTools.
		this.win_.webContents.openDevTools()

		// Emitted when the window is closed.
		this.win_.on('closed', () => {
			// Dereference the window object, usually you would store windows
			// in an array if your app supports multi windows, this is the time
			// when you should delete the corresponding element.
			this.win_ = null
		})
	}

	async waitForElectronAppReady() {
		if (this.loadState_ === 'ready') return Promise.resolve();

		return new Promise((resolve, reject) => {
			const iid = setInterval(() => {
				if (this.loadState_ === 'ready') {
					clearInterval(iid);
					resolve();
				}
			}, 10);
		});
	}

	async start() {
		// Since we are doing other async things before creating the window, we might miss
		// the "ready" event. So we use the function below to make sure that the app is ready.
		await this.waitForElectronAppReady();

		this.createWindow();

		// Quit when all windows are closed.
		this.electronApp_.on('window-all-closed', () => {
			// On macOS it is common for applications and their menu bar
			// to stay active until the user quits explicitly with Cmd + Q
			if (process.platform !== 'darwin') {
				this.electronApp_.quit()
			}
		})

		this.electronApp_.on('activate', () => {
			// On macOS it's common to re-create a window in the app when the
			// dock icon is clicked and there are no other windows open.
			if (this.win_ === null) {
				createWindow()
			}
		})
	}

}

module.exports = { ElectronAppWrapper };