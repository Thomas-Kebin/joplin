const React = require('react'); const Component = React.Component;
const { WebView, View, Linking } = require('react-native');
const { globalStyle } = require('lib/components/global-style.js');
const { Resource } = require('lib/models/resource.js');
const { reg } = require('lib/registry.js');
const { markdownUtils, MdToHtml } = require('lib/markdown-utils.js');

class NoteBodyViewer extends Component {

	constructor() {
		super();
		this.state = {
			resources: {},
			webViewLoaded: false,
		}

		this.isMounted_ = false;
	}

	componentWillMount() {
		this.mdToHtml_ = new MdToHtml();
		this.isMounted_ = true;
	}

	componentWillUnmount() {
		this.mdToHtml_ = null;
		this.isMounted_ = false;
	}

	onLoadEnd() {
		if (this.state.webViewLoaded) return;

		// Need to display after a delay to avoid a white flash before
		// the content is displayed.
		setTimeout(() => {
			if (!this.isMounted_) return;
			this.setState({ webViewLoaded: true });
		}, 100);
	}

	render() {
		const note = this.props.note;
		const style = this.props.style;
		const onCheckboxChange = this.props.onCheckboxChange;

		const mdOptions = {
			onResourceLoaded: function() {
				this.forceUpdated();
			},
		};

		const html = this.mdToHtml_.render(note ? note.body : '', this.props.webViewStyle, mdOptions);

		let webViewStyle = {}
		webViewStyle.opacity = this.state.webViewLoaded ? 1 : 0.01;

		return (
			<View style={style}>
				<WebView
					style={webViewStyle}
					source={{ html: html }}
					onLoadEnd={() => this.onLoadEnd()}
					onError={(e) => reg.logger().error('WebView error', e) }
					onMessage={(event) => {
						let msg = event.nativeEvent.data;

						if (msg.indexOf('checkboxclick:') === 0) {
							const newBody = this.mdToHtml_.handleCheckboxClick(msg, note.body);
							if (onCheckboxChange) onCheckboxChange(newBody);
						} else if (msg.indexOf('bodyscroll:') === 0) {
							//msg = msg.split(':');
							//this.bodyScrollTop_ = Number(msg[1]);
						} else {
							Linking.openURL(msg);
						}
					}}
				/>
			</View>
		);
	}

}

module.exports = { NoteBodyViewer };