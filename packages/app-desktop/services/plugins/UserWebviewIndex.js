// This is the API that JS files loaded from the webview can see
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
const webviewApi = {
	postMessage: function(message) {
		window.postMessage({ target: 'plugin', message: message }, '*');
	},
};

(function() {
	function docReady(fn) {
		if (document.readyState === 'complete' || document.readyState === 'interactive') {
			setTimeout(fn, 1);
		} else {
			document.addEventListener('DOMContentLoaded', fn);
		}
	}

	function fileExtension(path) {
		if (!path) throw new Error('Path is empty');

		const output = path.split('.');
		if (output.length <= 1) return '';
		return output[output.length - 1];
	}

	docReady(() => {
		const rootElement = document.createElement('div');
		document.getElementsByTagName('body')[0].appendChild(rootElement);

		const contentElement = document.createElement('div');
		contentElement.setAttribute('id', 'joplin-plugin-content');
		rootElement.appendChild(contentElement);

		const headElement = document.getElementsByTagName('head')[0];

		const addedScripts = {};

		function addScript(scriptPath, id = null) {
			const ext = fileExtension(scriptPath).toLowerCase();

			if (ext === 'js') {
				const script = document.createElement('script');
				script.src = scriptPath;
				if (id) script.id = id;
				headElement.appendChild(script);
			} else if (ext === 'css') {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = scriptPath;
				if (id) link.id = id;
				headElement.appendChild(link);
			} else {
				throw new Error(`Unsupported script: ${scriptPath}`);
			}
		}

		const ipc = {
			setHtml: (args) => {
				contentElement.innerHTML = args.html;
			},

			setScript: (args) => {
				const { script, key } = args;

				const scriptPath = `file://${script}`;
				const elementId = `joplin-script-${key}`;

				if (addedScripts[elementId]) {
					document.getElementById(elementId).remove();
					delete addedScripts[elementId];
				}

				addScript(scriptPath, elementId);
			},

			setScripts: (args) => {
				const scripts = args.scripts;

				if (!scripts) return;

				for (let i = 0; i < scripts.length; i++) {
					const scriptPath = `file://${scripts[i]}`;

					if (addedScripts[scriptPath]) continue;
					addedScripts[scriptPath] = true;

					addScript(scriptPath);
				}
			},
		};

		window.addEventListener('message', ((event) => {
			if (!event.data || event.data.target !== 'webview') return;

			const callName = event.data.name;
			const args = event.data.args;

			if (!ipc[callName]) {
				console.warn('Missing IPC function:', event.data);
			} else {
				ipc[callName](args);
			}
		}));

		// Send a message to the containing component to notify
		// it that the view content is fully ready.
		window.postMessage({ target: 'UserWebview', message: 'ready' }, '*');
	});
})();
