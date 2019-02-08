const React = require('react');
const { connect } = require('react-redux');
const { themeStyle } = require('../theme.js');
const { _ } = require('lib/locale.js');

class NoteTextViewerComponent extends React.Component {

	constructor() {
		super();

		this.initialized_ = false;

		this.webviewRef_ = React.createRef();
		this.webviewListeners_ = null;

		this.webview_domReady = this.webview_domReady.bind(this);
		this.webview_ipcMessage = this.webview_ipcMessage.bind(this);
	}

	webview_domReady(event) {
		this.props.onDomReady(event);
	}

	webview_ipcMessage(event) {
		this.props.onIpcMessage(event);
	}

	initWebview() {
		const wv = this.webviewRef_.current;

		if (!this.webviewListeners_) {
			this.webviewListeners_ = {
				'dom-ready': this.webview_domReady.bind(this),
				'ipc-message': this.webview_ipcMessage.bind(this),
			};
		}

		for (let n in this.webviewListeners_) {
			if (!this.webviewListeners_.hasOwnProperty(n)) continue;
			const fn = this.webviewListeners_[n];
			wv.addEventListener(n, fn);
		}
	}

	destroyWebview() {
		const wv = this.webviewRef_.current;
		if (!wv || !this.initialized_) return;

		for (let n in this.webviewListeners_) {
			if (!this.webviewListeners_.hasOwnProperty(n)) continue;
			const fn = this.webviewListeners_[n];
			wv.removeEventListener(n, fn);
		}
	}

	componentDidUpdate() {
		if (!this.initialized_ && this.webviewRef_.current) {
			this.initWebview();
			this.initialized_ = true;
		}
	}

	componentWillUnmount() {
		this.destroyWebview();
	}

	send(channel, arg0 = null, arg1 = null, arg2 = null, arg3 = null) {
		return this.webviewRef_.current.send(channel, arg0, arg1, arg2, arg3);
	}

	printToPDF(options, callback) {
		return this.webviewRef_.current.printToPDF(options, callback);
	}

	print(options = {}) {
		return this.webviewRef_.current.print(options);
	}

	render() {
		return  <webview
			ref={this.webviewRef_}
			style={this.props.viewerStyle}
			preload="gui/note-viewer/preload.js"
			src="gui/note-viewer/index.html"
			webpreferences="contextIsolation"
		/>
	}

}

const mapStateToProps = (state) => {
	return {
		theme: state.settings.theme,
	};
};

const NoteTextViewer = connect(mapStateToProps, null, null, { withRef: true })(NoteTextViewerComponent);

module.exports = NoteTextViewer;