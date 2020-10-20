import * as React from 'react';
import SideBar from './SideBar';
import ButtonBar from './ButtonBar';
import Button, { ButtonLevel } from '../Button/Button';
import { _ } from 'lib/locale';
const { connect } = require('react-redux');
const Setting = require('lib/models/Setting').default;
const { themeStyle } = require('lib/theme');
const pathUtils = require('lib/path-utils');
const SyncTargetRegistry = require('lib/SyncTargetRegistry');
const shared = require('lib/components/shared/config-shared.js');
const bridge = require('electron').remote.require('./bridge').default;
const { EncryptionConfigScreen } = require('../EncryptionConfigScreen.min');
const { ClipperConfigScreen } = require('../ClipperConfigScreen.min');
const { KeymapConfigScreen } = require('../KeymapConfig/KeymapConfigScreen');

class ConfigScreenComponent extends React.Component<any, any> {

	rowStyle_:any = null;

	constructor(props:any) {
		super(props);

		shared.init(this);

		this.state = {
			selectedSectionName: 'general',
			screenName: '',
			changedSettingKeys: [],
		};

		this.rowStyle_ = {
			marginBottom: 10,
		};

		this.sideBar_selectionChange = this.sideBar_selectionChange.bind(this);
		this.checkSyncConfig_ = this.checkSyncConfig_.bind(this);
		this.checkNextcloudAppButton_click = this.checkNextcloudAppButton_click.bind(this);
		this.showLogButton_click = this.showLogButton_click.bind(this);
		this.nextcloudAppHelpLink_click = this.nextcloudAppHelpLink_click.bind(this);
		this.onCancelClick = this.onCancelClick.bind(this);
		this.onSaveClick = this.onSaveClick.bind(this);
		this.onApplyClick = this.onApplyClick.bind(this);
	}

	async checkSyncConfig_() {
		await shared.checkSyncConfig(this, this.state.settings);
	}

	async checkNextcloudAppButton_click() {
		this.setState({ showNextcloudAppLog: true });
		await shared.checkNextcloudApp(this, this.state.settings);
	}

	showLogButton_click() {
		this.setState({ showNextcloudAppLog: true });
	}

	nextcloudAppHelpLink_click() {
		bridge().openExternal('https://joplinapp.org/nextcloud_app');
	}

	UNSAFE_componentWillMount() {
		this.setState({ settings: this.props.settings });
	}

	componentDidMount() {
		if (this.props.defaultSection) {
			this.setState({ selectedSectionName: this.props.defaultSection }, () => {
				this.switchSection(this.props.defaultSection);
			});
		}
	}

	sectionByName(name:string) {
		const sections = shared.settingsSections({ device: 'desktop', settings: this.state.settings });
		for (const section of sections) {
			if (section.name === name) return section;
		}

		throw new Error(`Invalid section name: ${name}`);
	}

	screenFromName(screenName:string) {
		if (screenName === 'encryption') return <EncryptionConfigScreen themeId={this.props.themeId}/>;
		if (screenName === 'server') return <ClipperConfigScreen themeId={this.props.themeId}/>;
		if (screenName === 'keymap') return <KeymapConfigScreen themeId={this.props.themeId}/>;

		throw new Error(`Invalid screen name: ${screenName}`);
	}

	switchSection(name:string) {
		const section = this.sectionByName(name);
		let screenName = '';
		if (section.isScreen) {
			screenName = section.name;

			if (this.hasChanges()) {
				const ok = confirm(_('This will open a new screen. Save your current changes?'));
				if (ok) shared.saveSettings(this);
			}
		}

		this.setState({ selectedSectionName: section.name, screenName: screenName });
	}

	sideBar_selectionChange(event:any) {
		this.switchSection(event.section.name);
	}

	keyValueToArray(kv:any) {
		const output = [];
		for (const k in kv) {
			if (!kv.hasOwnProperty(k)) continue;
			output.push({
				key: k,
				label: kv[k],
			});
		}

		return output;
	}

	renderSectionDescription(section:any) {
		const description = Setting.sectionDescription(section.name);
		if (!description) return null;

		const theme = themeStyle(this.props.themeId);
		return (
			<div style={Object.assign({}, theme.textStyle, { marginBottom: 15 })}>
				{description}
			</div>
		);
	}

	sectionToComponent(key:string, section:any, settings:any, selected:boolean) {
		const theme = themeStyle(this.props.themeId);

		const createSettingComponents = (advanced:boolean) => {
			const output = [];
			for (let i = 0; i < section.metadatas.length; i++) {
				const md = section.metadatas[i];
				if (!!md.advanced !== advanced) continue;
				const settingComp = this.settingToComponent(md.key, settings[md.key]);
				output.push(settingComp);
			}
			return output;
		};

		const settingComps = createSettingComponents(false);
		const advancedSettingComps = createSettingComponents(true);

		const sectionStyle:any = {
			marginTop: 20,
			marginBottom: 20,
			maxWidth: 640,
		};

		if (!selected) sectionStyle.display = 'none';

		if (section.name === 'general') {
			sectionStyle.borderTopWidth = 0;
		}

		if (section.name === 'sync') {
			const syncTargetMd = SyncTargetRegistry.idToMetadata(settings['sync.target']);
			const statusStyle = Object.assign({}, theme.textStyle, { marginTop: 10 });

			if (syncTargetMd.supportsConfigCheck) {
				const messages = shared.checkSyncConfigMessages(this);
				const statusComp = !messages.length ? null : (
					<div style={statusStyle}>
						{messages[0]}
						{messages.length >= 1 ? <p>{messages[1]}</p> : null}
					</div>
				);

				settingComps.push(
					<div key="check_sync_config_button" style={this.rowStyle_}>
						<Button
							title={_('Check synchronisation configuration')}
							level={ButtonLevel.Secondary}
							disabled={this.state.checkSyncConfigResult === 'checking'}
							onClick={this.checkSyncConfig_}
						/>
						{statusComp}
					</div>
				);
			}

			if (syncTargetMd.name === 'nextcloud') {
				const syncTarget = settings['sync.5.syncTargets'][settings['sync.5.path']];

				let status = _('Unknown');
				let errorMessage = null;

				if (this.state.checkNextcloudAppResult === 'checking') {
					status = _('Checking...');
				} else if (syncTarget) {
					if (syncTarget.uuid) status = _('OK');
					if (syncTarget.error) {
						status = _('Error');
						errorMessage = syncTarget.error;
					}
				}

				const statusComp = !errorMessage || this.state.checkNextcloudAppResult === 'checking' || !this.state.showNextcloudAppLog ? null : (
					<div style={statusStyle}>
						<p style={theme.textStyle}>{_('The Joplin Nextcloud App is either not installed or misconfigured. Please see the full error message below:')}</p>
						<pre>{errorMessage}</pre>
					</div>
				);

				const showLogButton = !errorMessage || this.state.showNextcloudAppLog ? null : (
					<a style={theme.urlStyle} href="#" onClick={this.showLogButton_click}>[{_('Show Log')}]</a>
				);

				const appStatusStyle = Object.assign({}, theme.textStyle, { fontWeight: 'bold' });

				settingComps.push(
					<div key="nextcloud_app_check" style={this.rowStyle_}>
						<span style={theme.textStyle}>Beta: {_('Joplin Nextcloud App status:')} </span><span style={appStatusStyle}>{status}</span>
						&nbsp;&nbsp;
						{showLogButton}
						&nbsp;&nbsp;
						<Button level={ButtonLevel.Secondary} style={{ display: 'inline-block' }} title={_('Check Status')} disabled={this.state.checkNextcloudAppResult === 'checking'} onClick={this.checkNextcloudAppButton_click}/>
						&nbsp;&nbsp;
						<a style={theme.urlStyle} href="#" onClick={this.nextcloudAppHelpLink_click}>[{_('Help')}]</a>
						{statusComp}
					</div>
				);
			}
		}

		let advancedSettingsButton = null;
		const advancedSettingsSectionStyle = { display: 'none' };

		if (advancedSettingComps.length) {
			const iconName = this.state.showAdvancedSettings ? 'fa fa-angle-down' : 'fa fa-angle-right';
			// const advancedSettingsButtonStyle = Object.assign({}, theme.buttonStyle, { marginBottom: 10 });
			advancedSettingsButton = (
				<div style={{ marginBottom: 10 }}>
					<Button
						level={ButtonLevel.Secondary}
						onClick={() => shared.advancedSettingsButton_click(this)}
						iconName={iconName}
						title={_('Show Advanced Settings')}
					/>
				</div>
			);
			advancedSettingsSectionStyle.display = this.state.showAdvancedSettings ? 'block' : 'none';
		}

		return (
			<div key={key} style={sectionStyle}>
				{this.renderSectionDescription(section)}
				<div>{settingComps}</div>
				{advancedSettingsButton}
				<div style={advancedSettingsSectionStyle}>{advancedSettingComps}</div>
			</div>
		);
	}

	settingToComponent(key:string, value:any) {
		const theme = themeStyle(this.props.themeId);

		const output:any = null;

		const rowStyle = {
			marginBottom: theme.mainPadding,
		};

		const labelStyle = Object.assign({}, theme.textStyle, {
			display: 'block',
			color: theme.color,
			fontSize: theme.fontSize * 1.083333,
			fontWeight: 500,
			marginBottom: theme.mainPadding / 4,
		});

		const subLabel = Object.assign({}, labelStyle, {
			display: 'block',
			opacity: 0.7,
			marginBottom: labelStyle.marginBottom,
		});

		const checkboxLabelStyle = Object.assign({}, labelStyle, {
			marginLeft: 8,
			display: 'inline',
			backgroundColor: 'transparent',
		});

		const controlStyle = {
			display: 'inline-block',
			color: theme.color,
			fontFamily: theme.fontFamily,
			backgroundColor: theme.backgroundColor,
		};

		const descriptionStyle = Object.assign({}, theme.textStyle, {
			color: theme.colorFaded,
			marginTop: 5,
			fontStyle: 'italic',
			maxWidth: '70em',
		});

		const textInputBaseStyle = Object.assign({}, controlStyle, {
			fontFamily: theme.fontFamily,
			border: '1px solid',
			padding: '4px 6px',
			boxSizing: 'border-box',
			borderColor: theme.borderColor4,
			borderRadius: 3,
			paddingLeft: 6,
			paddingRight: 6,
			paddingTop: 4,
			paddingBottom: 4,
		});

		const updateSettingValue = (key:string, value:any) => {
			// console.info(key + ' = ' + value);
			return shared.updateSettingValue(this, key, value);
		};

		// Component key needs to be key+value otherwise it doesn't update when the settings change.

		const md = Setting.settingMetadata(key);

		const descriptionText = Setting.keyDescription(key, 'desktop');
		const descriptionComp = descriptionText ? <div style={descriptionStyle}>{descriptionText}</div> : null;

		if (md.isEnum) {
			const items = [];
			const settingOptions = md.options();
			const array = this.keyValueToArray(settingOptions);
			for (let i = 0; i < array.length; i++) {
				const e = array[i];
				items.push(
					<option value={e.key.toString()} key={e.key}>
						{settingOptions[e.key]}
					</option>
				);
			}

			const selectStyle = Object.assign({}, controlStyle, {
				paddingLeft: 6,
				paddingRight: 6,
				paddingTop: 4,
				paddingBottom: 4,
				borderColor: theme.borderColor4,
				borderRadius: 3,
			});

			return (
				<div key={key} style={rowStyle}>
					<div style={labelStyle}>
						<label>{md.label()}</label>
					</div>
					<select
						value={value}
						style={selectStyle}
						onChange={(event:any) => {
							updateSettingValue(key, event.target.value);
						}}
					>
						{items}
					</select>
					{descriptionComp}
				</div>
			);
		} else if (md.type === Setting.TYPE_BOOL) {
			const onCheckboxClick = () => {
				updateSettingValue(key, !value);
			};

			const checkboxSize = theme.fontSize * 1.1666666666666;

			// Hack: The {key+value.toString()} is needed as otherwise the checkbox doesn't update when the state changes.
			// There's probably a better way to do this but can't figure it out.

			return (
				<div key={key + value.toString()} style={rowStyle}>
					<div style={{ ...controlStyle, backgroundColor: 'transparent', display: 'flex', alignItems: 'center' }}>
						<input
							id={`setting_checkbox_${key}`}
							type="checkbox"
							checked={!!value}
							onChange={() => {
								onCheckboxClick();
							}}
							style={{ marginLeft: 0, width: checkboxSize, height: checkboxSize }}
						/>
						<label
							onClick={() => {
								onCheckboxClick();
							}}
							style={{ ...checkboxLabelStyle, marginLeft: 5, marginBottom: 0 }}
							htmlFor={`setting_checkbox_${key}`}
						>
							{md.label()}
						</label>
					</div>
					{descriptionComp}
				</div>
			);
		} else if (md.type === Setting.TYPE_STRING) {
			const inputStyle:any = Object.assign({}, textInputBaseStyle, {
				width: '50%',
				minWidth: '20em',
			});
			const inputType = md.secure === true ? 'password' : 'text';

			if (md.subType === 'file_path_and_args') {
				inputStyle.marginBottom = subLabel.marginBottom;

				const splitCmd = (cmdString:string) => {
					const path = pathUtils.extractExecutablePath(cmdString);
					const args = cmdString.substr(path.length + 1);
					return [pathUtils.unquotePath(path), args];
				};

				const joinCmd = (cmdArray:string[]) => {
					if (!cmdArray[0] && !cmdArray[1]) return '';
					let cmdString = pathUtils.quotePath(cmdArray[0]);
					if (!cmdString) cmdString = '""';
					if (cmdArray[1]) cmdString += ` ${cmdArray[1]}`;
					return cmdString;
				};

				const onPathChange = (event:any) => {
					const cmd = splitCmd(this.state.settings[key]);
					cmd[0] = event.target.value;
					updateSettingValue(key, joinCmd(cmd));
				};

				const onArgsChange = (event:any) => {
					const cmd = splitCmd(this.state.settings[key]);
					cmd[1] = event.target.value;
					updateSettingValue(key, joinCmd(cmd));
				};

				const browseButtonClick = () => {
					const paths = bridge().showOpenDialog();
					if (!paths || !paths.length) return;
					const cmd = splitCmd(this.state.settings[key]);
					cmd[0] = paths[0];
					updateSettingValue(key, joinCmd(cmd));
				};

				const cmd = splitCmd(this.state.settings[key]);

				return (
					<div key={key} style={rowStyle}>
						<div style={labelStyle}>
							<label>{md.label()}</label>
						</div>
						<div style={{ display: 'flex' }}>
							<div style={{ flex: 1 }}>
								<div style={{ ...rowStyle, marginBottom: 5 }}>
									<div style={subLabel}>Path:</div>
									<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: inputStyle.marginBottom }}>
										<input
											type={inputType}
											style={Object.assign({}, inputStyle, { marginBottom: 0, marginRight: 5 })}
											onChange={(event:any) => {
												onPathChange(event);
											}}
											value={cmd[0]}
										/>
										<Button
											level={ButtonLevel.Secondary}
											title={_('Browse...')}
											onClick={browseButtonClick}
										/>
									</div>
								</div>
								<div style={{ ...rowStyle, marginBottom: 5 }}>
									<div style={subLabel}>Arguments:</div>
									<input
										type={inputType}
										style={inputStyle}
										onChange={(event:any) => {
											onArgsChange(event);
										}}
										value={cmd[1]}
									/>
									<div style={{ width: inputStyle.width }}>
										{descriptionComp}
									</div>
								</div>
							</div>
						</div>


					</div>
				);
			} else {
				const onTextChange = (event:any) => {
					updateSettingValue(key, event.target.value);
				};

				return (
					<div key={key} style={rowStyle}>
						<div style={labelStyle}>
							<label>{md.label()}</label>
						</div>
						<input
							type={inputType}
							style={inputStyle}
							value={this.state.settings[key]}
							onChange={(event:any) => {
								onTextChange(event);
							}}
						/>
						<div style={{ width: inputStyle.width }}>
							{descriptionComp}
						</div>
					</div>
				);
			}
		} else if (md.type === Setting.TYPE_INT) {
			const onNumChange = (event:any) => {
				updateSettingValue(key, event.target.value);
			};

			const label = [md.label()];
			if (md.unitLabel) label.push(`(${md.unitLabel()})`);

			const inputStyle:any = Object.assign({}, textInputBaseStyle);

			return (
				<div key={key} style={rowStyle}>
					<div style={labelStyle}>
						<label>{label.join(' ')}</label>
					</div>
					<input
						type="number"
						style={inputStyle}
						value={this.state.settings[key]}
						onChange={(event:any) => {
							onNumChange(event);
						}}
						min={md.minimum}
						max={md.maximum}
						step={md.step}
					/>
					{descriptionComp}
				</div>
			);
		} else if (md.type === Setting.TYPE_BUTTON) {
			return (
				<div key={key} style={rowStyle}>
					<div style={labelStyle}>
						<label>{md.label()}</label>
					</div>
					<Button level={ButtonLevel.Secondary} title={_('Edit')} onClick={md.onClick}/>
					{descriptionComp}
				</div>
			);
		} else {
			console.warn(`Type not implemented: ${key}`);
		}

		return output;
	}

	onApplyClick() {
		shared.saveSettings(this);
	}

	onSaveClick() {
		shared.saveSettings(this);
		this.props.dispatch({ type: 'NAV_BACK' });
	}

	onCancelClick() {
		this.props.dispatch({ type: 'NAV_BACK' });
	}

	hasChanges() {
		return !!this.state.changedSettingKeys.length;
	}

	render() {
		const theme = themeStyle(this.props.themeId);

		const style = Object.assign({},
			this.props.style,
			{
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column',
				backgroundColor: theme.backgroundColor3,
			}
		);

		const settings = this.state.settings;

		const containerStyle = {
			overflow: 'auto',
			padding: theme.configScreenPadding,
			paddingTop: 0,
			display: 'flex',
			flex: 1,
		};

		const hasChanges = this.hasChanges();

		const settingComps = shared.settingsToComponents2(this, 'desktop', settings, this.state.selectedSectionName);

		// screenComp is a custom config screen, such as the encryption config screen or keymap config screen.
		// These screens handle their own loading/saving of settings and have bespoke rendering.
		// When screenComp is null, it means we are viewing the regular settings.
		const screenComp = this.state.screenName ? <div style={{ overflow: 'scroll', flex: 1 }}>{this.screenFromName(this.state.screenName)}</div> : null;

		if (screenComp) containerStyle.display = 'none';

		const sections = shared.settingsSections({ device: 'desktop', settings });

		return (
			<div style={{ display: 'flex', flexDirection: 'row' }}>
				<SideBar
					selection={this.state.selectedSectionName}
					onSelectionChange={this.sideBar_selectionChange}
					sections={sections}
				/>
				<div style={style}>
					{screenComp}
					<div style={containerStyle}>{settingComps}</div>
					<ButtonBar
						hasChanges={hasChanges}
						backButtonTitle={hasChanges && !screenComp ? _('Cancel') : _('Back')}
						onCancelClick={this.onCancelClick}
						onSaveClick={screenComp ? null : this.onSaveClick}
						onApplyClick={screenComp ? null : this.onApplyClick}
					/>
				</div>
			</div>
		);
	}
}

const mapStateToProps = (state:any) => {
	return {
		themeId: state.settings.theme,
		settings: state.settings,
		locale: state.settings.locale,
	};
};

export default connect(mapStateToProps)(ConfigScreenComponent);

