import * as React from 'react';
import versionInfo from '@joplin/lib/versionInfo';
import PluginService from '@joplin/lib/services/plugins/PluginService';
import Setting from '@joplin/lib/models/Setting';
import bridge from '../services/bridge';
const packageInfo = require('../packageInfo.js');
const ipcRenderer = require('electron').ipcRenderer;

interface ErrorInfo {
	componentStack: string;
}

interface PluginInfo {
	id: string;
	name: string;
	enabled: boolean;
	version: string;
}

interface State {
	error: Error;
	errorInfo: ErrorInfo;
	pluginInfos: PluginInfo[];
}

interface Props {}

export default class ErrorBoundary extends React.Component<Props, State> {

	public state: State = { error: null, errorInfo: null, pluginInfos: [] };

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		const pluginInfos: PluginInfo[] = [];
		try {
			const service = PluginService.instance();
			const pluginSettings = service.unserializePluginSettings(Setting.value('plugins.states'));
			for (const pluginId in pluginSettings) {
				const plugin = PluginService.instance().pluginById(pluginId);

				pluginInfos.push({
					id: pluginId,
					name: plugin.manifest.name,
					enabled: pluginSettings[pluginId].enabled,
					version: plugin.manifest.version,
				});
			}
		} catch (error) {
			console.error('Could not get plugin info:', error);
		}

		this.setState({ error, errorInfo, pluginInfos });
	}

	componentDidMount() {
		const onAppClose = () => {
			ipcRenderer.send('asynchronous-message', 'appCloseReply', {
				canClose: true,
			});
		};

		ipcRenderer.on('appClose', onAppClose);
	}

	render() {
		if (this.state.error) {
			const safeMode_click = async () => {
				Setting.setValue('isSafeMode', true);
				await Setting.saveAll();
				bridge().restart();
			};

			try {
				const output = [];

				output.push(
					<section key="message">
						<h2>Message</h2>
						<p>{this.state.error.message}</p>
					</section>
				);

				output.push(
					<section key="versionInfo">
						<h2>Version info</h2>
						<pre>{versionInfo(packageInfo).message}</pre>
					</section>
				);

				if (this.state.pluginInfos.length) {
					output.push(
						<section key="pluginSettings">
							<h2>Plugins</h2>
							<pre>{JSON.stringify(this.state.pluginInfos, null, 4)}</pre>
						</section>
					);
				}

				if (this.state.error.stack) {
					output.push(
						<section key="stacktrace">
							<h2>Stack trace</h2>
							<pre>{this.state.error.stack}</pre>
						</section>
					);
				}

				if (this.state.errorInfo) {
					if (this.state.errorInfo.componentStack) {
						output.push(
							<section key="componentStack">
								<h2>Component stack</h2>
								<pre>{this.state.errorInfo.componentStack}</pre>
							</section>
						);
					}
				}

				return (
					<div style={{ overflow: 'auto', fontFamily: 'sans-serif', padding: '5px 20px' }}>
						<h1>Error</h1>
						<p>Joplin encountered a fatal error and could not continue. To report the error, please copy the *entire content* of this page and post it on Joplin forum or GitHub.</p>
						<p>To continue you may close the app. Alternatively, if the error persists you may try to <a href="#" onClick={safeMode_click}>restart in safe mode</a>, which will temporarily disable all plugins.</p>
						{output}
					</div>
				);
			} catch (error) {
				return (
					<div>
						{JSON.stringify(this.state)}
					</div>
				);
			}
		}

		return this.props.children;
	}
}
