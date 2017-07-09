import React, { Component } from 'react';
import { View, Button, TextInput } from 'react-native';
import { connect } from 'react-redux'
import { Provider } from 'react-redux'
import { createStore } from 'redux';
import { combineReducers } from 'redux';
import { StackNavigator } from 'react-navigation';
import { addNavigationHelpers } from 'react-navigation';
import { shim } from 'lib/shim.js';
import { Log } from 'lib/log.js'
import { Logger } from 'lib/logger.js'
import { Note } from 'lib/models/note.js'
import { Folder } from 'lib/models/folder.js'
import { Resource } from 'lib/models/resource.js'
import { Tag } from 'lib/models/tag.js'
import { NoteTag } from 'lib/models/note-tag.js'
import { BaseItem } from 'lib/models/base-item.js'
import { BaseModel } from 'lib/base-model.js'
import { JoplinDatabase } from 'lib/joplin-database.js'
import { Database } from 'lib/database.js'
import { ItemList } from 'lib/components/item-list.js'
import { NotesScreen } from 'lib/components/screens/notes.js'
import { NotesScreenUtils } from 'lib/components/screens/notes-utils.js'
import { NoteScreen } from 'lib/components/screens/note.js'
import { FolderScreen } from 'lib/components/screens/folder.js'
import { FoldersScreen } from 'lib/components/screens/folders.js'
import { LogScreen } from 'lib/components/screens/log.js'
import { LoadingScreen } from 'lib/components/screens/loading.js'
import { OneDriveLoginScreen } from 'lib/components/screens/onedrive-login.js'
import { Setting } from 'lib/models/setting.js'
import { Synchronizer } from 'lib/synchronizer.js'
import { MenuContext } from 'react-native-popup-menu';
import { SideMenu } from 'lib/components/side-menu.js';
import { SideMenuContent } from 'lib/components/side-menu-content.js';
import { DatabaseDriverReactNative } from 'lib/database-driver-react-native';
import { reg } from 'lib/registry.js';
import RNFetchBlob from 'react-native-fetch-blob';

let defaultState = {
	notes: [],
	folders: [],
	selectedNoteId: null,
	selectedItemType: 'note',
	selectedFolderId: null,
	showSideMenu: false,
	screens: {},
	loading: true,
	historyCanGoBack: false,
};

let navHistory = [];

const reducer = (state = defaultState, action) => {
	reg.logger().info('Reducer action', action.type);

	let newState = state;

	switch (action.type) {

		case 'Navigation/BACK':

			if (navHistory.length < 2) break;

			action = navHistory.pop(); // Current page
			action = navHistory.pop(); // Previous page

			// newState = Object.assign({}, state);
			// newState.historyCanGoBack = false;

			// Fall throught

		case 'Navigation/NAVIGATE':

			const r = state.nav.routes;
			const currentRoute = r.length ? r[r.length - 1] : null;
			const currentRouteName = currentRoute ? currentRoute.routeName : '';

			reg.logger().info('Route: ' + currentRouteName + ' => ' + action.routeName);

			newState = Object.assign({}, state);

			if ('noteId' in action) {
				newState.selectedNoteId = action.noteId;
			}

			if ('folderId' in action) {
				newState.selectedFolderId = action.folderId;
			}

			if ('itemType' in action) {
				newState.selectedItemType = action.itemType;
			}

			if ('screens' in action) {
				for (let n in action.screens) {
					if (!action.screens.hasOwnProperty(n)) continue;
					newState.screens[n] = action.screens[n];
				}
			}

			if (currentRouteName == action.routeName) {
				// If the current screen is already the requested screen, don't do anything
			} else {
				const nextStateNav = AppNavigator.router.getStateForAction(action, state.nav);
				if (nextStateNav) {
					newState.nav = nextStateNav;
					navHistory.push(action);
				}
			}

			newState.historyCanGoBack = navHistory.length >= 2;
			break;

		// Replace all the notes with the provided array
		case 'APPLICATION_LOADING_DONE':

			newState = Object.assign({}, state);
			newState.loading = false;
			break;

		// Replace all the notes with the provided array
		case 'NOTES_UPDATE_ALL':

			newState = Object.assign({}, state);
			newState.notes = action.notes;
			break;

		// Insert the note into the note list if it's new, or
		// update it within the note array if it already exists.
		case 'NOTES_UPDATE_ONE':

			if (action.note.parent_id != state.selectedFolderId) break;

			let newNotes = state.notes.splice(0);
			var found = false;
			for (let i = 0; i < newNotes.length; i++) {
				let n = newNotes[i];
				if (n.id == action.note.id) {
					newNotes[i] = action.note;
					found = true;
					break;
				}
			}

			if (!found) newNotes.push(action.note);

			newState = Object.assign({}, state);
			newState.notes = newNotes;
			break;

		case 'FOLDERS_UPDATE_ALL':

			newState = Object.assign({}, state);
			newState.folders = action.folders;
			break;

		case 'FOLDERS_UPDATE_ONE':

			var newFolders = state.folders.splice(0);
			var found = false;
			for (let i = 0; i < newFolders.length; i++) {
				let n = newFolders[i];
				if (n.id == action.folder.id) {
					newFolders[i] = action.folder;
					found = true;
					break;
				}
			}

			if (!found) newFolders.push(action.folder);

			newState = Object.assign({}, state);
			newState.folders = newFolders;
			break;

		case 'FOLDER_DELETE':

			var newFolders = [];
			for (let i = 0; i < state.folders.length; i++) {
				let f = state.folders[i];
				if (f.id == action.folderId) continue;
				newFolders.push(f);
			}

			newState = Object.assign({}, state);
			newState.folders = newFolders;
			break;

		case 'SIDE_MENU_TOGGLE':

			newState = Object.assign({}, state);
			newState.showSideMenu = !newState.showSideMenu
			break;

		case 'SIDE_MENU_OPEN':

			newState = Object.assign({}, state);
			newState.showSideMenu = true
			break;

		case 'SIDE_MENU_CLOSE':

			newState = Object.assign({}, state);
			newState.showSideMenu = false
			break;

	}

	return newState;
}

let store = createStore(reducer);

const AppNavigator = StackNavigator({
	Notes: { screen: NotesScreen },
	Note: { screen: NoteScreen },
	Folder: { screen: FolderScreen },
	Loading: { screen: LoadingScreen },
	OneDriveLogin: { screen: OneDriveLoginScreen },
	Log: { screen: LogScreen },
});

let initializationState_ = 'waiting';

async function initialize(dispatch) {
	if (initializationState_ != 'waiting') return;

	initializationState_ = 'in_progress';

	shim.fetchBlob = async function(url, options) {
		if (!options || !options.path) throw new Error('fetchBlob: target file path is missing');
		if (!options.method) options.method = 'GET';

		let headers = options.headers ? options.headers : {};
		let method = options.method ? options.method : 'GET';

		let dirs = RNFetchBlob.fs.dirs;
		let localFilePath = options.path;
		if (localFilePath.indexOf('/') !== 0) localFilePath = dirs.DocumentDir + '/' + localFilePath;

		delete options.path;

		try {
			let response = await RNFetchBlob.config({
				path: localFilePath
			}).fetch(method, url, headers);

			// Returns an object that roughtly compatible with a standard Response object
			let output = {
				ok: response.respInfo.status < 400,
				path: response.data,
				text: response.text,
				json: response.json,
				status: response.respInfo.status,
				headers: response.respInfo.headers,
			};

			return output;
		} catch (error) {
			throw new Error('fetchBlob: ' + method + ' ' + url + ': ' + error.toString());
		}
	}

	Setting.setConstant('env', __DEV__ ? 'dev' : 'prod');
	Setting.setConstant('appId', 'net.cozic.joplin');
	Setting.setConstant('appType', 'mobile');
	Setting.setConstant('resourceDir', RNFetchBlob.fs.dirs.DocumentDir);

	const logDatabase = new Database(new DatabaseDriverReactNative());
	await logDatabase.open({ name: 'log.sqlite' });
	await logDatabase.exec(Logger.databaseCreateTableSql());
	reg.logger().addTarget('database', { database: logDatabase, source: 'm' });

	reg.logger().info('====================================');
	reg.logger().info('Starting application ' + Setting.value('appId') + ' (' + Setting.value('env') + ')');

	let db = new JoplinDatabase(new DatabaseDriverReactNative());
	reg.setDb(db);

	BaseModel.dispatch = dispatch;
	NotesScreenUtils.dispatch = dispatch;
	BaseModel.db_ = db;

	BaseItem.loadClass('Note', Note);
	BaseItem.loadClass('Folder', Folder);
	BaseItem.loadClass('Resource', Resource);
	BaseItem.loadClass('Tag', Tag);
	BaseItem.loadClass('NoteTag', NoteTag);

	try {
		if (Setting.value('env') == 'prod') {
			await db.open({ name: 'joplin.sqlite' })
		} else {
			await db.open({ name: 'joplin-53.sqlite' })

			// await db.exec('DELETE FROM notes');
			// await db.exec('DELETE FROM folders');
			// await db.exec('DELETE FROM tags');
			// await db.exec('DELETE FROM note_tags');
			// await db.exec('DELETE FROM resources');
			// await db.exec('DELETE FROM deleted_items');
		}

		reg.logger().info('Database is ready.');
		reg.logger().info('Loading settings...');
		await Setting.load();

		reg.logger().info('Loading folders...');
		let initialFolders = await Folder.all();

		dispatch({
			type: 'FOLDERS_UPDATE_ALL',
			folders: initialFolders,
		});

		dispatch({
			type: 'APPLICATION_LOADING_DONE',
		});

		if (initialFolders.length) {
			const selectedFolder = await Folder.defaultFolder();
			if (selectedFolder) NotesScreenUtils.openNoteList(selectedFolder.id);
		}
	} catch (error) {
		reg.logger().error('Initialization error:', error);
	}

	initializationState_ = 'done';

	reg.logger().info('Application initialized');
}

class AppComponent extends React.Component {

	async componentDidMount() {
		await initialize(this.props.dispatch);
	}

	sideMenu_change(isOpen) {
		// Make sure showSideMenu property of state is updated
		// when the menu is open/closed.
		this.props.dispatch({
			type: isOpen ? 'SIDE_MENU_OPEN' : 'SIDE_MENU_CLOSE',
		});
	}

	render() {
		const sideMenuContent = <SideMenuContent/>;

		return (
			<SideMenu menu={sideMenuContent} onChange={(isOpen) => this.sideMenu_change(isOpen)}>
				<MenuContext style={{ flex: 1 }}>
					<AppNavigator navigation={addNavigationHelpers({
						dispatch: this.props.dispatch,
						state: this.props.nav,
					})} />
				</MenuContext>
			</SideMenu>
		);
	}
}

defaultState.nav = AppNavigator.router.getStateForAction({
	type: 'Navigation/NAVIGATE',
	routeName: 'Loading',
	params: {}
});

const mapStateToProps = (state) => {
	return {
  		nav: state.nav
  	};
};

const App = connect(mapStateToProps)(AppComponent);

class Root extends React.Component {
	render() {
		return (
			<Provider store={store}>
				<App />
			</Provider>
		);
	}
}

export { Root };