import React, { Component } from 'react';
import { connect } from 'react-redux'
import { View, Text, Button, StyleSheet, TouchableOpacity, Picker, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Log } from 'lib/log.js';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import { _ } from 'lib/locale.js';
import { Setting } from 'lib/models/setting.js';
import { FileApi } from 'lib/file-api.js';
import { FileApiDriverOneDrive } from 'lib/file-api-driver-onedrive.js';
import { reg } from 'lib/registry.js'
import { globalStyle } from 'lib/components/global-style.js';

// Rather than applying a padding to the whole bar, it is applied to each
// individual component (button, picker, etc.) so that the touchable areas
// are widder and to give more room to the picker component which has a larger
// default height.
const PADDING_V = 10;

let styleObject = {
	container: {
		flexDirection: 'row',
		backgroundColor: globalStyle.raisedBackgroundColor,
		alignItems: 'center',
		shadowColor: '#000000',
		elevation: 5,
	},
	folderPicker: {
		flex:1,
		color: globalStyle.raisedHighlightedColor,
		// Note: cannot set backgroundStyle as that would remove the arrow in the component
	},
	divider: {
		borderBottomWidth: 1,
		borderColor: globalStyle.dividerColor,
		backgroundColor: "#0000ff"
	},
	sideMenuButton: {
		flex: 1,
		alignItems: 'center',
		backgroundColor: globalStyle.raisedBackgroundColor,
		paddingLeft: globalStyle.marginLeft,
		paddingRight: 5,
		marginRight: 2,
		paddingTop: PADDING_V,
		paddingBottom: PADDING_V,
	},
	iconButton: {
		flex: 1,
		backgroundColor: globalStyle.raisedBackgroundColor,
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
		borderColor: globalStyle.raisedHighlightedColor,
		borderRadius: 4,
		marginRight: 8,
	},
	saveButtonText: {
		textAlignVertical: 'center',
		color: globalStyle.raisedHighlightedColor,
		fontWeight: 'bold',
	},
	savedButtonIcon: {
		fontSize: 20,
		color: globalStyle.raisedHighlightedColor,
		width: 18,
		height: 18,
	},
	saveButtonIcon: {
		width: 18,
		height: 18,
	},
	contextMenuTrigger: {
		fontSize: 25,
		paddingRight: globalStyle.marginRight,
		color: globalStyle.raisedColor,
		fontWeight: 'bold',
	},
	contextMenu: {
		backgroundColor: globalStyle.raisedBackgroundColor,
	},
	contextMenuItem: {
		backgroundColor: globalStyle.backgroundColor,
	},
	contextMenuItemText: {
		flex: 1,
		textAlignVertical: 'center',
		paddingLeft: globalStyle.marginLeft,
		paddingRight: globalStyle.marginRight,
		paddingTop: globalStyle.itemMarginTop,
		paddingBottom: globalStyle.itemMarginBottom,
		color: globalStyle.color,
		backgroundColor: globalStyle.backgroundColor,
		fontSize: globalStyle.fontSize,
	},
	titleText: {
		flex: 1,
		marginLeft: 0,
		color: globalStyle.raisedHighlightedColor,
		fontWeight: 'bold',
		fontSize: globalStyle.fontSize,
	}
};

styleObject.topIcon = Object.assign({}, globalStyle.icon);
styleObject.topIcon.flex = 1;
styleObject.topIcon.textAlignVertical = 'center';
styleObject.topIcon.color = globalStyle.raisedColor;

styleObject.backButton = Object.assign({}, styleObject.iconButton);
styleObject.backButton.marginRight = 1;

styleObject.backButtonDisabled = Object.assign({}, styleObject.backButton, { opacity: globalStyle.disabledOpacity });
styleObject.saveButtonDisabled = Object.assign({}, styleObject.saveButton, { opacity: globalStyle.disabledOpacity });

const styles = StyleSheet.create(styleObject);

class ScreenHeaderComponent extends Component {

	sideMenuButton_press() {
		this.props.dispatch({ type: 'SIDE_MENU_TOGGLE' });
	}

	backButton_press() {
		this.props.dispatch({ type: 'NAV_BACK' });
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
						<Icon name='md-menu' style={styleObject.topIcon} />
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
				<MenuOption value={o.onPress} key={'menuOption_' + key++} style={styles.contextMenuItem}>
					<Text style={styles.contextMenuItemText}>{o.title}</Text>
				</MenuOption>);
		}

		if (menuOptionComponents.length) {
			menuOptionComponents.push(<View key={'menuOption_' + key++} style={styles.divider}/>);
		}

		menuOptionComponents.push(
			<MenuOption value={() => this.log_press()} key={'menuOption_' + key++} style={styles.contextMenuItem}>
				<Text style={styles.contextMenuItemText}>{_('Log')}</Text>
			</MenuOption>);

		menuOptionComponents.push(
			<MenuOption value={() => this.status_press()} key={'menuOption_' + key++} style={styles.contextMenuItem}>
				<Text style={styles.contextMenuItemText}>{_('Status')}</Text>
			</MenuOption>);

		if (menuOptionComponents.length) {
			menuOptionComponents.push(<View key={'menuOption_' + key++} style={styles.divider}/>);
		}

		menuOptionComponents.push(
			<MenuOption value={() => this.config_press()} key={'menuOption_' + key++} style={styles.contextMenuItem}>
				<Text style={styles.contextMenuItemText}>{_('Configuration')}</Text>
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
						<Picker style={styles.folderPicker} selectedValue={p.selectedValue} onValueChange={(itemValue, itemIndex) => { if (p.onValueChange) p.onValueChange(itemValue, itemIndex); }}>
							{ items }
						</Picker>
					</View>
				);
			} else {
				let title = 'title' in this.props && this.props.title !== null ? this.props.title : '';
				return <Text style={styles.titleText}>{title}</Text>
			}
		}

		const titleComp = createTitleComponent();

		return (
			<View style={styles.container} >
				{ sideMenuButton(styles, () => this.sideMenuButton_press()) }
				{ backButton(styles, () => this.backButton_press(), !this.props.historyCanGoBack) }
				{ saveButton(styles, () => { if (this.props.onSaveButtonPress) this.props.onSaveButtonPress() }, this.props.saveButtonDisabled === true, this.props.showSaveButton === true) }
				{ titleComp }
				{ searchButton(styles, () => this.searchButton_press()) }
			    <Menu onSelect={(value) => this.menu_select(value)} style={styles.contextMenu}>
					<MenuTrigger style={{ paddingTop: PADDING_V, paddingBottom: PADDING_V }}>
						<Text style={styles.contextMenuTrigger}>  &#8942;</Text>
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
		};
	}
)(ScreenHeaderComponent)

export { ScreenHeader };