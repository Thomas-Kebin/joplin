import React, { Component } from 'react';
import { StyleSheet, TouchableHighlight } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const styles = StyleSheet.create({
	checkboxIcon: {
		fontSize: 20,
		height: 22,
		marginRight: 10,
	},
});

class Checkbox extends Component {

	constructor() {
		super();
		this.state = {
			checked: false,
		}
	}

	componentWillMount() {
		this.state = { checked: this.props.checked };
	}

	componentWillReceiveProps(newProps) {
		if ('checked' in newProps) {
			this.setState({ checked: newProps.checked });
		}
	}

	onPress() {
		let newChecked = !this.state.checked;
		this.setState({ checked: newChecked });
		if (this.props.onChange) this.props.onChange(newChecked);
	}

	render() {
		const iconName = this.state.checked ? 'md-checkbox-outline' : 'md-square-outline';

		let style = this.props.style ? Object.assign({}, this.props.style) : {};
		style.justifyContent = 'center';
		style.alignItems = 'center';

		return (
			<TouchableHighlight onPress={() => this.onPress()} style={style}>
				<Icon name={iconName} style={styles.checkboxIcon}/>
			</TouchableHighlight>
		);
	}

}

export { Checkbox };