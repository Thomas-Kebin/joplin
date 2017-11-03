const React = require('react'); const Component = React.Component;
const { connect } = require('react-redux');
const { View, Text, Button, StyleSheet, TouchableOpacity, Picker, Image } = require('react-native');
const Icon = require('react-native-vector-icons/Ionicons').default;
const { Log } = require('lib/log.js');
const { BackButtonService } = require('lib/services/back-button.js');
const { Menu, MenuOptions, MenuOption, MenuTrigger } = require('react-native-popup-menu');
const { _ } = require('lib/locale.js');
const { Setting } = require('lib/models/setting.js');
const { FileApi } = require('lib/file-api.js');
const { FileApiDriverOneDrive } = require('lib/file-api-driver-onedrive.js');
const { reg } = require('lib/registry.js');
const { themeStyle } = require('lib/components/global-style.js');

// Rather than applying a padding to the whole bar, it is applied to each
// individual component (button, picker, etc.) so that the touchable areas
// are widder and to give more room to the picker component which has a larger
// default height.
const PADDING_V = 10;

class ScreenHeaderComponent extends Component {

	constructor() {
		super();
		this.styles_ = {};
	}

	styles() {
		const themeId = Setting.value('theme');
		if (this.styles_[themeId]) return this.styles_[themeId];
		this.styles_ = {};

		const theme = themeStyle(themeId);

		let styleObject = {
			container: {
				flexDirection: 'row',
				backgroundColor: theme.raisedBackgroundColor,
				alignItems: 'center',
				shadowColor: '#000000',
				elevation: 5,
			},
			folderPicker: {
				flex:1,
				color: theme.raisedHighlightedColor,
				// Note: cannot set backgroundStyle as that would remove the arrow in the component
			},
			divider: {
				borderBottomWidth: 1,
				borderColor: theme.dividerColor,
				backgroundColor: "#0000ff"
			},
			sideMenuButton: {
				flex: 1,
				alignItems: 'center',
				backgroundColor: theme.raisedBackgroundColor,
				paddingLeft: theme.marginLeft,
				paddingRight: 5,
				marginRight: 2,
				paddingTop: PADDING_V,
				paddingBottom: PADDING_V,
			},
			iconButton: {
				flex: 1,
				backgroundColor: theme.raisedBackgroundColor,
				paddingLeft: 15,
				paddingRight: 15,
				paddingTop: PADDING_V,
				paddingBottom: PADDING_V,
			},
			saveButton: {
				flex: 0,
				flexDirection: 'row',
				alignItems: 'center',
				padding: 10,
				borderWidth: 1,
				borderColor: theme.raisedHighlightedColor,
				borderRadius: 4,
				marginRight: 8,
			},
			saveButtonText: {
				textAlignVertical: 'center',
				color: theme.raisedHighlightedColor,
				fontWeight: 'bold',
			},
			savedButtonIcon: {
				fontSize: 20,
				color: theme.raisedHighlightedColor,
				width: 18,
				height: 18,
			},
			saveButtonIcon: {
				width: 18,
				height: 18,
			},
			contextMenuTrigger: {
				fontSize: 25,
				paddingRight: theme.marginRight,
				color: theme.raisedColor,
				fontWeight: 'bold',
			},
			contextMenu: {
				backgroundColor: theme.raisedBackgroundColor,
			},
			contextMenuItem: {
				backgroundColor: theme.backgroundColor,
			},
			contextMenuItemText: {
				flex: 1,
				textAlignVertical: 'center',
				paddingLeft: theme.marginLeft,
				paddingRight: theme.marginRight,
				paddingTop: theme.itemMarginTop,
				paddingBottom: theme.itemMarginBottom,
				color: theme.color,
				backgroundColor: theme.backgroundColor,
				fontSize: theme.fontSize,
			},
			titleText: {
				flex: 1,
				marginLeft: 0,
				color: theme.raisedHighlightedColor,
				fontWeight: 'bold',
				fontSize: theme.fontSize,
			}
		};

		styleObject.topIcon = Object.assign({}, theme.icon);
		styleObject.topIcon.flex = 1;
		styleObject.topIcon.textAlignVertical = 'center';
		styleObject.topIcon.color = theme.raisedColor;

		styleObject.backButton = Object.assign({}, styleObject.iconButton);
		styleObject.backButton.marginRight = 1;

		styleObject.backButtonDisabled = Object.assign({}, styleObject.backButton, { opacity: theme.disabledOpacity });
		styleObject.saveButtonDisabled = Object.assign({}, styleObject.saveButton, { opacity: theme.disabledOpacity });

		this.styles_[themeId] = StyleSheet.create(styleObject);
		return this.styles_[themeId];
	}

	sideMenuButton_press() {
		this.props.dispatch({ type: 'SIDE_MENU_TOGGLE' });
	}

	async backButton_press() {
		await BackButtonService.back();
		//this.props.dispatch({ type: 'NAV_BACK' });
	}

	searchButton_press() {
		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Search',
		});	
	}

	menu_select(value) {
		if (typeof(value) == 'function') {
			value();
		}
	}

	log_press() {
		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Log',
		});	
	}

	status_press() {
		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Status',
		});	
	}

	config_press() {
		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Config',
		});	
	}

	render() {

		function sideMenuButton(styles, onPress) {
			return (
				<TouchableOpacity onPress={onPress}>
					<View style={styles.sideMenuButton}>
						<Icon name='md-menu' style={styles.topIcon} />
					</View>
				</TouchableOpacity>
			);
		}

		function backButton(styles, onPress, disabled) {
			return (
				<TouchableOpacity onPress={onPress} disabled={disabled}>
					<View style={disabled ? styles.backButtonDisabled : styles.backButton}>
						<Icon name='md-arrow-back' style={styles.topIcon} />
					</View>
				</TouchableOpacity>
			);
		}

		function saveButton(styles, onPress, disabled, show) {
			if (!show) return null;

			const icon = disabled ? <Icon name='md-checkmark' style={styles.savedButtonIcon} /> : <Image style={styles.saveButtonIcon} source={require('./SaveIcon.png')} />;

			return (
				<TouchableOpacity onPress={onPress} disabled={disabled} style={{ padding:0 }}>
					<View style={disabled ? styles.saveButtonDisabled : styles.saveButton}>
						{ icon }
					</View>
				</TouchableOpacity>
			);
		}

		function searchButton(styles, onPress) {
			return (
				<TouchableOpacity onPress={onPress}>
					<View style={styles.iconButton}>
						<Icon name='md-search' style={styles.topIcon} />
					</View>
				</TouchableOpacity>
			);
		}

		let key = 0;
		let menuOptionComponents = [];
		for (let i = 0; i < this.props.menuOptions.length; i++) {
			let o = this.props.menuOptions[i];
			menuOptionComponents.push(
				<MenuOption value={o.onPress} key={'menuOption_' + key++} style={this.styles().contextMenuItem}>
					<Text style={this.styles().contextMenuItemText}>{o.title}</Text>
				</MenuOption>);
		}

		if (this.props.showAdvancedOptions) {
			if (menuOptionComponents.length) {
				menuOptionComponents.push(<View key={'menuOption_' + key++} style={this.styles().divider}/>);
			}

			menuOptionComponents.push(
				<MenuOption value={() => this.log_press()} key={'menuOption_' + key++} style={this.styles().contextMenuItem}>
					<Text style={this.styles().contextMenuItemText}>{_('Log')}</Text>
				</MenuOption>);

			menuOptionComponents.push(
				<MenuOption value={() => this.status_press()} key={'menuOption_' + key++} style={this.styles().contextMenuItem}>
					<Text style={this.styles().contextMenuItemText}>{_('Status')}</Text>
				</MenuOption>);
		}

		if (menuOptionComponents.length) {
			menuOptionComponents.push(<View key={'menuOption_' + key++} style={this.styles().divider}/>);
		}

		menuOptionComponents.push(
			<MenuOption value={() => this.config_press()} key={'menuOption_' + key++} style={this.styles().contextMenuItem}>
				<Text style={this.styles().contextMenuItemText}>{_('Configuration')}</Text>
			</MenuOption>);

		const createTitleComponent = () => {
			const p = this.props.titlePicker;
			if (p) {
				let items = [];
				for (let i = 0; i < p.items.length; i++) {
					let item = p.items[i];
					items.push(<Picker.Item label={item.label} value={item.value} key={item.value}/>);
				}
				return (
					<View style={{ flex: 1 }}>
						<Picker style={this.styles().folderPicker} selectedValue={p.selectedValue} onValueChange={(itemValue, itemIndex) => { if (p.onValueChange) p.onValueChange(itemValue, itemIndex); }}>
							{ items }
						</Picker>
					</View>
				);
			} else {
				let title = 'title' in this.props && this.props.title !== null ? this.props.title : '';
				return <Text style={this.styles().titleText}>{title}</Text>
			}
		}

		const titleComp = createTitleComponent();

		return (
			<View style={this.styles().container} >
				{ sideMenuButton(this.styles(), () => this.sideMenuButton_press()) }
				{ backButton(this.styles(), () => this.backButton_press(), !this.props.historyCanGoBack) }
				{ saveButton(this.styles(), () => { if (this.props.onSaveButtonPress) this.props.onSaveButtonPress() }, this.props.saveButtonDisabled === true, this.props.showSaveButton === true) }
				{ titleComp }
				{ searchButton(this.styles(), () => this.searchButton_press()) }
			    <Menu onSelect={(value) => this.menu_select(value)} style={this.styles().contextMenu}>
					<MenuTrigger style={{ paddingTop: PADDING_V, paddingBottom: PADDING_V }}>
						<Text style={this.styles().contextMenuTrigger}>  &#8942;</Text>
					</MenuTrigger>
					<MenuOptions>
						{ menuOptionComponents }
					</MenuOptions>
				</Menu>
			</View>
		);
	}

}

ScreenHeaderComponent.defaultProps = {
	menuOptions: [],
};

const ScreenHeader = connect(
	(state) => {
		return {
			historyCanGoBack: state.historyCanGoBack,
			locale: state.settings.locale,
			theme: state.settings.theme,
			showAdvancedOptions: state.settings.showAdvancedOptions,
		};
	}
)(ScreenHeaderComponent)

export { ScreenHeader };