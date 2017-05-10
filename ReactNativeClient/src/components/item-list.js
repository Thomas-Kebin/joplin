import React, { Component } from 'react';
import { connect } from 'react-redux'
import { ListView, Text, TouchableHighlight } from 'react-native';
import { _ } from 'src/locale.js';

class ItemListComponent extends Component {

	constructor() {
		super();
		const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
		this.state = { dataSource: ds };
	}

	componentWillMount() {
		const newDataSource = this.state.dataSource.cloneWithRows(this.props.notes);
		this.state = { dataSource: newDataSource };
	}

	componentWillReceiveProps(newProps) {
		// TODO: use this to update:
		// https://stackoverflow.com/questions/38186114/react-native-redux-and-listview
	}

	render() {
		let renderRow = (rowData) => {
			let onPress = () => {
				this.props.onItemClick(rowData.id)
			}
			return (
				<TouchableHighlight onPress={onPress}>
					<Text>{rowData.title}</Text>
				</TouchableHighlight>
			);
		}
		return (
			<ListView
				dataSource={this.state.dataSource}
				renderRow={renderRow}
			/>
		);
	}
}

const ItemList = connect(
	(state) => {
		return { notes: state.notes };
	},
	(dispatch) => {
		return {
			onItemClick: (noteId) => {
				dispatch({
					type: 'Navigation/NAVIGATE',
					routeName: 'Note',
					noteId: noteId,
				});
			}
		}
	}
)(ItemListComponent)

export { ItemList };