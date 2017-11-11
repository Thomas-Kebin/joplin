const React = require('react');
const { render } = require('react-dom');
const { createStore } = require('redux');
const { connect, Provider } = require('react-redux');

const { MainScreen } = require('./MainScreen.min.js');
const { OneDriveLoginScreen } = require('./OneDriveLoginScreen.min.js');
const { ImportScreen } = require('./ImportScreen.min.js');
const { Navigator } = require('./Navigator.min.js');

const { app } = require('../app');

const { bridge } = require('electron').remote.require('./bridge');

async function initialize(dispatch) {
	this.wcsTimeoutId_ = null;

	bridge().window().on('resize', function() {
		if (this.wcsTimeoutId_) clearTimeout(this.wcsTimeoutId_);

		this.wcsTimeoutId_ = setTimeout(() => {
			store.dispatch({
				type: 'WINDOW_CONTENT_SIZE_SET',
				size: bridge().windowContentSize(),
			});
			this.wcsTimeoutId_ = null;
		}, 10);
	});

	store.dispatch({
		type: 'WINDOW_CONTENT_SIZE_SET',
		size: bridge().windowContentSize(),
	});
}

class RootComponent extends React.Component {

	async componentDidMount() {
		if (this.props.appState == 'starting') {
			this.props.dispatch({
				type: 'APP_STATE_SET',
				state: 'initializing',
			});

			await initialize(this.props.dispatch);

			this.props.dispatch({
				type: 'APP_STATE_SET',
				state: 'ready',
			});
		}
	}

	render() {
		const navigatorStyle = {
			width: this.props.size.width,
			height: this.props.size.height,
		};

		const screens = {
			Main: { screen: MainScreen },
			OneDriveLogin: { screen: OneDriveLoginScreen },
			Import: { screen: ImportScreen },
		};

		return (
			<Navigator style={navigatorStyle} screens={screens} />
		);
	}

}

const mapStateToProps = (state) => {
	return {
		size: state.windowContentSize,
		appState: state.appState,
	};
};

const Root = connect(mapStateToProps)(RootComponent);

const store = app().store();

render(
	<Provider store={store}>
		<Root />
	</Provider>,
	document.getElementById('react-root')
)