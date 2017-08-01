import React, { Component } from 'react';
import { connect } from 'react-redux'
import { NotesScreen } from 'lib/components/screens/notes.js';
import { SearchScreen } from 'lib/components/screens/search.js';
import { View } from 'react-native';
import { _ } from 'lib/locale.js';

class AppNavComponent extends Component {

	constructor() {
		super();
		this.previousRouteName_ = null;
	}

	render() {
		if (!this.props.route) throw new Error('Route must not be null');

		// Note: certain screens are kept into memory, in particular Notes and Search
		// so that the scroll position is not lost when the user navigate away from them.

		let route = this.props.route;
		let Screen = null;
		let notesScreenVisible = false;
		let searchScreenVisible = false;

		if (route.routeName == 'Notes') {
			notesScreenVisible = true;
		} else if (route.routeName == 'Search') {
			searchScreenVisible = true;
		} else {
			Screen = this.props.screens[route.routeName].screen;
		}

		// Keep the search screen loaded if the user is viewing a note from that search screen
		// so that if the back button is pressed, the screen is still loaded. However, unload
		// it if navigating away.
		let searchScreenLoaded = searchScreenVisible || (this.previousRouteName_ == 'Search' && route.routeName == 'Note');

		this.previousRouteName_ = route.routeName;

		return (
			<View style={{ flex: 1 }}>
				<NotesScreen visible={notesScreenVisible} navigation={{ state: route }} />
				{ searchScreenLoaded && <SearchScreen visible={searchScreenVisible} navigation={{ state: route }} /> }
				{ (!notesScreenVisible && !searchScreenVisible) && <Screen navigation={{ state: route }} /> }
			</View>
		);
	}

}

const AppNav = connect(
	(state) => {
		return {
			route: state.route,
		};
	}
)(AppNavComponent)

export { AppNav };