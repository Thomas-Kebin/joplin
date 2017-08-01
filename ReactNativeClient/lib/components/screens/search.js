import React, { Component } from 'react';
import { ListView, StyleSheet, View, TextInput, FlatList, TouchableHighlight } from 'react-native';
import { connect } from 'react-redux'
import { ScreenHeader } from 'lib/components/screen-header.js';
import Icon from 'react-native-vector-icons/Ionicons';
import { _ } from 'lib/locale.js';
import { Note } from 'lib/models/note.js';
import { NoteItem } from 'lib/components/note-item.js';
import { BaseScreenComponent } from 'lib/components/base-screen.js';
import { themeStyle } from 'lib/components/global-style.js';

class SearchScreenComponent extends BaseScreenComponent {
	
	static navigationOptions(options) {
		return { header: null };
	}

	constructor() {
		super();
		this.state = {
			query: '',
			notes: [],
		};
		this.isMounted_ = false;
		this.styles_ = {};
	}

	styles() {
		const theme = themeStyle(this.props.theme);

		if (this.styles_[this.props.theme]) return this.styles_[this.props.theme];
		this.styles_ = {};

		let styles = {
			body: {
				flex: 1,
			},
			searchContainer: {
				flexDirection: 'row',
				alignItems: 'center',
				borderWidth: 1,
				borderColor: theme.dividerColor,
			}
		}

		styles.searchTextInput = Object.assign({}, theme.lineInput);
		styles.searchTextInput.paddingLeft = theme.marginLeft;
		styles.searchTextInput.flex = 1;
		styles.searchTextInput.backgroundColor = theme.backgroundColor;
		styles.searchTextInput.color = theme.color;

		styles.clearIcon = Object.assign({}, theme.icon);
		styles.clearIcon.color = theme.colorFaded;
		styles.clearIcon.paddingRight = theme.marginRight;
		styles.clearIcon.backgroundColor = theme.backgroundColor;

		this.styles_[this.props.theme] = StyleSheet.create(styles);
		return this.styles_[this.props.theme];
	}

	componentDidMount() {
		this.setState({ query: this.props.query });
		this.refreshSearch(this.props.query);
		this.isMounted_ = true;
	}

	componentWillUnmount() {
		this.isMounted_ = false;
	}

	componentWillReceiveProps(newProps) {
		let newState = {};
		if ('query' in newProps) newState.query = newProps.query;

		if (Object.getOwnPropertyNames(newState).length) {
			this.setState(newState);
			this.refreshSearch(newState.query);
		}
	}

	searchTextInput_submit() {
		const query = this.state.query.trim();
		if (!query) return;

		this.props.dispatch({
			type: 'SEARCH_QUERY',
			query: query,
		});
	}

	clearButton_press() {
		this.props.dispatch({
			type: 'SEARCH_QUERY',
			query: '',
		});
	}

	async refreshSearch(query = null) {
		query = query === null ? this.state.query.trim : query.trim();

		let notes = []

		if (query) {
			let p = query.split(' ');
			let temp = [];
			for (let i = 0; i < p.length; i++) {
				let t = p[i].trim();
				if (!t) continue;
				temp.push(t);
			}

			notes = await Note.previews(null, {
				anywherePattern: '*' + temp.join('*') + '*',
			});
		}

		if (!this.isMounted_) return;

		this.setState({ notes: notes });
	}

	searchTextInput_changeText(text) {
		this.setState({ query: text });
	}

	render() {
		if (!this.isMounted_) return null;

		return (
			<View style={this.rootStyle(this.props.theme).root}>
				<ScreenHeader title={_('Search')}/>
				<View style={this.styles().body}>
					<View style={this.styles().searchContainer}>
						<TextInput
							style={this.styles().searchTextInput}
							autoFocus={true}
							underlineColorAndroid="#ffffff00" 
							onSubmitEditing={() => { this.searchTextInput_submit() }}
							onChangeText={(text) => this.searchTextInput_changeText(text) }
							value={this.state.query}
						/>
						<TouchableHighlight onPress={() => this.clearButton_press() }>
							<Icon name='md-close-circle' style={this.styles().clearIcon} />
						</TouchableHighlight>
					</View>

					<FlatList
						data={this.state.notes}
						keyExtractor={(item, index) => item.id}
						renderItem={(event) => <NoteItem note={event.item}/>}
					/>
				</View>
			</View>
		);
	}

}

const SearchScreen = connect(
	(state) => {
		return {
			query: state.searchQuery,
			theme: state.settings.theme,
		};
	}
)(SearchScreenComponent)

export { SearchScreen };