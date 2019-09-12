let browser_ = null;
if (typeof browser !== 'undefined') {
	browser_ = browser;
	browserSupportsPromises_ = true;
} else if (typeof chrome !== 'undefined') {
	browser_ = chrome;
	browserSupportsPromises_ = false;
}

let env_ = null;

// Make this function global so that it can be accessed
// from the popup too.
// https://stackoverflow.com/questions/6323184/communication-between-background-page-and-popup-page-in-a-chrome-extension
window.joplinEnv = function() {
	if (env_) return env_;

	const manifest = browser_.runtime.getManifest();
	env_ = manifest.name.indexOf('[DEV]') >= 0 ? 'dev' : 'prod';
	return env_;
};

async function browserCaptureVisibleTabs(windowId) {
	const options = { format: 'jpeg' };
	if (browserSupportsPromises_) return browser_.tabs.captureVisibleTab(windowId, options);

	return new Promise((resolve) => {
		browser_.tabs.captureVisibleTab(windowId, options, (image) => {
			resolve(image);
		});
	});
}

async function browserGetZoom(tabId) {
	if (browserSupportsPromises_) return browser_.tabs.getZoom(tabId);

	return new Promise((resolve) => {
		browser_.tabs.getZoom(tabId, (zoom) => {
			resolve(zoom);
		});
	});
}

browser_.runtime.onInstalled.addListener(function() {
	if (window.joplinEnv() === 'dev') {
		browser_.browserAction.setIcon({
			path: 'icons/32-dev.png',
		});
	}
});

browser_.runtime.onMessage.addListener(async (command) => {
	if (command.name === 'screenshotArea') {

		const zoom = await browserGetZoom();

		const imageDataUrl = await browserCaptureVisibleTabs(null);
		const content = Object.assign({}, command.content);
		content.image_data_url = imageDataUrl;

		const newArea = Object.assign({}, command.content.crop_rect);
		newArea.x *= zoom;
		newArea.y *= zoom;
		newArea.width *= zoom;
		newArea.height *= zoom;
		content.crop_rect = newArea;

		fetch(command.api_base_url + '/notes', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(content),
		});
	}
});
