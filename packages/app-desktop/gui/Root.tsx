import app from '../app';
import { AppState, AppStateDialog } from '../app.reducer';
import MainScreen from './MainScreen/MainScreen';
import ConfigScreen from './ConfigScreen/ConfigScreen';
import StatusScreen from './StatusScreen/StatusScreen';
import OneDriveLoginScreen from './OneDriveLoginScreen';
import DropboxLoginScreen from './DropboxLoginScreen';
import ErrorBoundary from './ErrorBoundary';
import { themeStyle } from '@joplin/lib/theme';
import { Size } from './ResizableLayout/utils/types';
import MenuBar from './MenuBar';
import { _ } from '@joplin/lib/locale';
const React = require('react');
const { render } = require('react-dom');
const { connect, Provider } = require('react-redux');
import Setting from '@joplin/lib/models/Setting';
import shim from '@joplin/lib/shim';
import ClipperServer from '@joplin/lib/ClipperServer';
import DialogTitle from './DialogTitle';
import DialogButtonRow, { ButtonSpec, ClickEvent, ClickEventHandler } from './DialogButtonRow';
import Dialog from './Dialog';
import SyncWizardDialog from './SyncWizard/Dialog';
import StyleSheetContainer from './StyleSheets/StyleSheetContainer';
const { ImportScreen } = require('./ImportScreen.min.js');
const { ResourceScreen } = require('./ResourceScreen.js');
const { Navigator } = require('./Navigator.min.js');
const WelcomeUtils = require('@joplin/lib/WelcomeUtils');
const { ThemeProvider, StyleSheetManager, createGlobalStyle } = require('styled-components');
const bridge = require('electron').remote.require('./bridge').default;

interface Props {
	themeId: number;
	appState: string;
	dispatch: Function;
	size: Size;
	zoomFactor: number;
	needApiAuth: boolean;
	dialogs: AppStateDialog;
}

interface ModalDialogProps {
	themeId: number;
	message: string;
	buttonSpecs: ButtonSpec[];
	onClick: ClickEventHandler;
}

interface RegisteredDialogProps {
	themeId: number;
	key: string;
	dispatch: Function;
}

interface RegisteredDialog {
	render: (props: RegisteredDialogProps)=> any;
}

const registeredDialogs: Record<string, RegisteredDialog> = {
	syncWizard: {
		render: (props: RegisteredDialogProps) => {
			return <SyncWizardDialog key={props.key} dispatch={props.dispatch} themeId={props.themeId}/>;
		},
	},
};

const GlobalStyle = createGlobalStyle`
	* {
		box-sizing: border-box;
	}

	div, span, a {
		/*color: ${(props: any) => props.theme.color};*/
		/*font-size: ${(props: any) => props.theme.fontSize}px;*/
		font-family: ${(props: any) => props.theme.fontFamily};
	}
`;

let wcsTimeoutId_: any = null;

async function initialize() {
	bridge().window().on('resize', function() {
		if (wcsTimeoutId_) shim.clearTimeout(wcsTimeoutId_);

		wcsTimeoutId_ = shim.setTimeout(() => {
			store.dispatch({
				type: 'WINDOW_CONTENT_SIZE_SET',
				size: bridge().windowContentSize(),
			});
			wcsTimeoutId_ = null;
		}, 10);
	});

	// Need to dispatch this to make sure the components are
	// displayed at the right size. The windowContentSize is
	// also set in the store default state, but at that point
	// the window might not be at its final size.
	store.dispatch({
		type: 'WINDOW_CONTENT_SIZE_SET',
		size: bridge().windowContentSize(),
	});

	store.dispatch({
		type: 'NOTE_VISIBLE_PANES_SET',
		panes: Setting.value('noteVisiblePanes'),
	});
}

class RootComponent extends React.Component<Props, any> {
	public async componentDidMount() {
		if (this.props.appState == 'starting') {
			this.props.dispatch({
				type: 'APP_STATE_SET',
				state: 'initializing',
			});

			await initialize();

			this.props.dispatch({
				type: 'APP_STATE_SET',
				state: 'ready',
			});
		}

		await WelcomeUtils.install(this.props.dispatch);
	}

	private renderModalMessage(props: ModalDialogProps) {
		if (!props) return null;

		const renderContent = () => {
			return (
				<div>
					<DialogTitle title={_('Confirmation')}/>
					<p>{props.message}</p>
					<DialogButtonRow
						themeId={props.themeId}
						onClick={props.onClick}
						okButtonShow={false}
						cancelButtonShow={false}
						customButtons={props.buttonSpecs}
					/>
				</div>
			);
		};

		return <Dialog renderContent={renderContent}/>;
	}

	private modalDialogProps(): ModalDialogProps {
		if (!this.props.needApiAuth) return null;

		let message = '';
		const buttonSpecs: ButtonSpec[] = [];
		let onClick: ClickEventHandler = null;

		if (this.props.needApiAuth) {
			message = _('The Web Clipper needs your authorisation to access your data.');
			buttonSpecs.push({ name: 'ok', label: _('Grant authorisation') });
			buttonSpecs.push({ name: 'cancel', label: _('Reject') });
			onClick = (event: ClickEvent) => {
				ClipperServer.instance().api.acceptAuthToken(event.buttonName === 'ok');
			};
		} else {
			return null;
		}

		return {
			themeId: this.props.themeId,
			buttonSpecs,
			message,
			onClick,
		};
	}

	private renderDialogs() {
		if (!this.props.dialogs.length) return null;

		const output: any[] = [];
		for (const dialog of this.props.dialogs) {
			const md = registeredDialogs[dialog.name];
			if (!md) throw new Error(`Unknown dialog: ${dialog.name}`);
			output.push(md.render({
				key: dialog.name,
				themeId: this.props.themeId,
				dispatch: this.props.dispatch,
			}));
		}
		return output;
	}

	public render() {
		const navigatorStyle = {
			width: this.props.size.width / this.props.zoomFactor,
			height: this.props.size.height / this.props.zoomFactor,
		};

		const theme = themeStyle(this.props.themeId);

		const screens = {
			Main: { screen: MainScreen },
			OneDriveLogin: { screen: OneDriveLoginScreen, title: () => _('OneDrive Login') },
			DropboxLogin: { screen: DropboxLoginScreen, title: () => _('Dropbox Login') },
			Import: { screen: ImportScreen, title: () => _('Import') },
			Config: { screen: ConfigScreen, title: () => _('Options') },
			Resources: { screen: ResourceScreen, title: () => _('Note attachments') },
			Status: { screen: StatusScreen, title: () => _('Synchronisation Status') },
		};

		return (
			<StyleSheetManager disableVendorPrefixes>
				<ThemeProvider theme={theme}>
					<StyleSheetContainer themeId={this.props.themeId}></StyleSheetContainer>
					<MenuBar/>
					<GlobalStyle/>
					<Navigator style={navigatorStyle} screens={screens} />
					{this.renderModalMessage(this.modalDialogProps())}
					{this.renderDialogs()}
				</ThemeProvider>
			</StyleSheetManager>
		);
	}
}

const mapStateToProps = (state: AppState) => {
	return {
		size: state.windowContentSize,
		zoomFactor: state.settings.windowContentZoomFactor / 100,
		appState: state.appState,
		themeId: state.settings.theme,
		needApiAuth: state.needApiAuth,
		dialogs: state.dialogs,
	};
};

const Root = connect(mapStateToProps)(RootComponent);

const store = app().store();

render(
	<Provider store={store}>
		<ErrorBoundary>
			<Root />
		</ErrorBoundary>
	</Provider>,
	document.getElementById('react-root')
);
