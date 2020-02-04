const Note = require('lib/models/Note.js');
const Folder = require('lib/models/Folder.js');
const ArrayUtils = require('lib/ArrayUtils.js');

const defaultState = {
	notes: [],
	notesSource: '',
	notesParentType: null,
	folders: [],
	tags: [],
	masterKeys: [],
	notLoadedMasterKeys: [],
	searches: [],
	selectedNoteIds: [],
	selectedNoteHash: '',
	selectedFolderId: null,
	selectedTagId: null,
	selectedSearchId: null,
	selectedItemType: 'note',
	lastSelectedNotesIds: {
		Folder: {},
		Tag: {},
		Search: {},
	},
	showSideMenu: false,
	screens: {},
	historyCanGoBack: false,
	syncStarted: false,
	syncReport: {},
	searchQuery: '',
	settings: {},
	sharedData: null,
	appState: 'starting',
	hasDisabledSyncItems: false,
	newNote: null,
	customCss: '',
	templates: [],
	collapsedFolderIds: [],
	clipperServer: {
		startState: 'idle',
		port: null,
	},
	decryptionWorker: {
		state: 'idle',
		itemIndex: 0,
		itemCount: 0,
	},
	selectedNoteTags: [],
	resourceFetcher: {
		toFetchCount: 0,
	},
	historyNotes: [],
	plugins: {},
};

const stateUtils = {};

const derivedStateCache_ = {};

// Allows, for a given state, to return the same derived
// objects, to prevent unecessary updates on calling components.
const cacheEnabledOutput = (key, output) => {
	key = `${key}_${JSON.stringify(output)}`;
	if (derivedStateCache_[key]) return derivedStateCache_[key];

	derivedStateCache_[key] = output;
	return derivedStateCache_[key];
};

stateUtils.notesOrder = function(stateSettings) {
	return cacheEnabledOutput('notesOrder', [
		{
			by: stateSettings['notes.sortOrder.field'],
			dir: stateSettings['notes.sortOrder.reverse'] ? 'DESC' : 'ASC',
		},
	]);
};

stateUtils.foldersOrder = function(stateSettings) {
	return cacheEnabledOutput('foldersOrder', [
		{
			by: stateSettings['folders.sortOrder.field'],
			dir: stateSettings['folders.sortOrder.reverse'] ? 'DESC' : 'ASC',
		},
	]);
};

stateUtils.parentItem = function(state) {
	const t = state.notesParentType;
	let id = null;
	if (t === 'Folder') id = state.selectedFolderId;
	if (t === 'Tag') id = state.selectedTagId;
	if (t === 'Search') id = state.selectedSearchId;
	if (!t || !id) return null;
	return { type: t, id: id };
};

stateUtils.lastSelectedNoteIds = function(state) {
	const parent = stateUtils.parentItem(state);
	if (!parent) return [];
	const output = state.lastSelectedNotesIds[parent.type][parent.id];
	return output ? output : [];
};

function arrayHasEncryptedItems(array) {
	for (let i = 0; i < array.length; i++) {
		if (array[i].encryption_applied) return true;
	}
	return false;
}

function stateHasEncryptedItems(state) {
	if (arrayHasEncryptedItems(state.notes)) return true;
	if (arrayHasEncryptedItems(state.folders)) return true;
	if (arrayHasEncryptedItems(state.tags)) return true;
	return false;
}

function folderSetCollapsed(state, action) {
	const collapsedFolderIds = state.collapsedFolderIds.slice();
	const idx = collapsedFolderIds.indexOf(action.id);

	if (action.collapsed) {
		if (idx >= 0) return state;
		collapsedFolderIds.push(action.id);
	} else {
		if (idx < 0) return state;
		collapsedFolderIds.splice(idx, 1);
	}

	let newState = Object.assign({}, state);
	newState.collapsedFolderIds = collapsedFolderIds;
	return newState;
}

// When deleting a note, tag or folder
function handleItemDelete(state, action) {
	const map = {
		FOLDER_DELETE: ['folders', 'selectedFolderId', true],
		NOTE_DELETE: ['notes', 'selectedNoteIds', false],
		TAG_DELETE: ['tags', 'selectedTagId', true],
		SEARCH_DELETE: ['searches', 'selectedSearchId', true],
	};

	const listKey = map[action.type][0];
	const selectedItemKey = map[action.type][1];
	const isSingular = map[action.type][2];

	const selectedItemKeys = isSingular ? [state[selectedItemKey]] : state[selectedItemKey];
	const isSelected = selectedItemKeys.includes(action.id);

	const items = state[listKey];
	let newItems = [];
	let newSelectedIndexes = [];

	for (let i = 0; i < items.length; i++) {
		let item = items[i];
		if (isSelected) {
			// the selected item is deleted so select the following item
			// if multiple items are selected then just use the first one
			if (selectedItemKeys[0] == item.id) {
				newSelectedIndexes.push(newItems.length);
			}
		} else {
			// the selected item/s is not deleted so keep it selected
			if (selectedItemKeys.includes(item.id)) {
				newSelectedIndexes.push(newItems.length);
			}
		}
		if (item.id == action.id) {
			continue;
		}
		newItems.push(item);
	}

	if (newItems.length == 0) {
		newSelectedIndexes = []; // no remaining items so no selection

	}  else if (newSelectedIndexes.length == 0) {
		newSelectedIndexes.push(0); // no selection exists so select the top

	} else {
		// when the items at end of list are deleted then select the end
		for (let i = 0; i < newSelectedIndexes.length; i++) {
			if (newSelectedIndexes[i] >= newItems.length) {
				newSelectedIndexes = [newItems.length - 1];
				break;
			}
		}
	}

	let newState = Object.assign({}, state);
	newState[listKey] = newItems;

	const newIds = [];
	for (let i = 0; i < newSelectedIndexes.length; i++) {
		newIds.push(newItems[newSelectedIndexes[i]].id);
	}
	newState[selectedItemKey] = isSingular ? newIds[0] : newIds;

	if ((newIds.length == 0) && newState.notesParentType !== 'Folder') {
		newState.notesParentType = 'Folder';
	}

	return newState;
}

function updateOneItem(state, action, keyName = '') {
	let itemsKey = null;
	if (keyName) itemsKey = keyName;
	else {
		if (action.type === 'TAG_UPDATE_ONE') itemsKey = 'tags';
		if (action.type === 'FOLDER_UPDATE_ONE') itemsKey = 'folders';
		if (action.type === 'MASTERKEY_UPDATE_ONE') itemsKey = 'masterKeys';
	}

	let newItems = state[itemsKey].splice(0);
	let item = action.item;

	var found = false;
	for (let i = 0; i < newItems.length; i++) {
		let n = newItems[i];
		if (n.id == item.id) {
			newItems[i] = Object.assign(newItems[i], item);
			found = true;
			break;
		}
	}

	if (!found) newItems.push(item);

	let newState = Object.assign({}, state);

	newState[itemsKey] = newItems;

	return newState;
}

function defaultNotesParentType(state, exclusion) {
	let newNotesParentType = null;

	if (exclusion !== 'Folder' && state.selectedFolderId) {
		newNotesParentType = 'Folder';
	} else if (exclusion !== 'Tag' && state.selectedTagId) {
		newNotesParentType = 'Tag';
	} else if (exclusion !== 'Search' && state.selectedSearchId) {
		newNotesParentType = 'Search';
	}

	return newNotesParentType;
}

function changeSelectedFolder(state, action, options = null) {
	if (!options) options = {};
	if (!('clearNoteHistory' in options)) options.clearNoteHistory = true;

	let newState = Object.assign({}, state);
	newState.selectedFolderId = 'folderId' in action ? action.folderId : action.id;
	if (!newState.selectedFolderId) {
		newState.notesParentType = defaultNotesParentType(state, 'Folder');
	} else {
		newState.notesParentType = 'Folder';
	}

	if (newState.selectedFolderId === state.selectedFolderId && newState.notesParentType === state.notesParentType) return state;

	if (options.clearNoteHistory) newState.historyNotes = [];
	if (options.clearSelectedNoteIds) newState.selectedNoteIds = [];

	return newState;
}

function recordLastSelectedNoteIds(state, noteIds) {
	const newOnes = Object.assign({}, state.lastSelectedNotesIds);
	const parent = stateUtils.parentItem(state);
	if (!parent) return state;

	newOnes[parent.type][parent.id] = noteIds.slice();

	return Object.assign({}, state, {
		lastSelectedNotesIds: newOnes,
	});
}

function changeSelectedNotes(state, action, options = null) {
	if (!options) options = {};
	if (!('clearNoteHistory' in options)) options.clearNoteHistory = true;

	let noteIds = [];
	if (action.id) noteIds = [action.id];
	if (action.ids) noteIds = action.ids;
	if (action.noteId) noteIds = [action.noteId];

	// const noteIds = 'id' in action ? (action.id ? [action.id] : []) : action.ids;

	let newState = Object.assign({}, state);

	if (action.type === 'NOTE_SELECT') {
		if (JSON.stringify(newState.selectedNoteIds) === JSON.stringify(noteIds)) return state;
		newState.selectedNoteIds = noteIds;
		newState.newNote = null;
		newState.selectedNoteHash = action.hash ? action.hash : '';
	} else if (action.type === 'NOTE_SELECT_ADD') {
		if (!noteIds.length) return state;
		newState.selectedNoteIds = ArrayUtils.unique(newState.selectedNoteIds.concat(noteIds));
		newState.newNote = null;
	} else if (action.type === 'NOTE_SELECT_REMOVE') {
		if (!noteIds.length) return state; // Nothing to unselect
		if (state.selectedNoteIds.length <= 1) return state; // Cannot unselect the last note

		let newSelectedNoteIds = [];
		for (let i = 0; i < newState.selectedNoteIds.length; i++) {
			const id = newState.selectedNoteIds[i];
			if (noteIds.indexOf(id) >= 0) continue;
			newSelectedNoteIds.push(id);
		}
		newState.selectedNoteIds = newSelectedNoteIds;
		newState.newNote = null;
	} else if (action.type === 'NOTE_SELECT_TOGGLE') {
		if (!noteIds.length) return state;

		if (newState.selectedNoteIds.indexOf(noteIds[0]) >= 0) {
			newState = changeSelectedNotes(state, { type: 'NOTE_SELECT_REMOVE', id: noteIds[0] });
		} else {
			newState = changeSelectedNotes(state, { type: 'NOTE_SELECT_ADD', id: noteIds[0] });
		}

		newState.newNote = null;
	} else {
		throw new Error('Unreachable');
	}

	newState = recordLastSelectedNoteIds(newState, newState.selectedNoteIds);

	if (options.clearNoteHistory) newState.historyNotes = [];

	return newState;
}

function removeItemFromArray(array, property, value) {
	for (let i = 0; i !== array.length; ++i) {
		let currentItem = array[i];
		if (currentItem[property] === value) {
			array.splice(i, 1);
			break;
		}
	}
	return array;
}

const reducer = (state = defaultState, action) => {
	let newState = state;

	try {
		switch (action.type) {
		case 'NOTE_SELECT':
		case 'NOTE_SELECT_ADD':
		case 'NOTE_SELECT_REMOVE':
		case 'NOTE_SELECT_TOGGLE':
			newState = changeSelectedNotes(state, action);
			break;

		case 'NOTE_SELECT_EXTEND':
			{
				newState = Object.assign({}, state);

				if (!newState.selectedNoteIds.length) {
					newState.selectedNoteIds = [action.id];
				} else {
					const selectRangeId1 = state.selectedNoteIds[state.selectedNoteIds.length - 1];
					const selectRangeId2 = action.id;
					if (selectRangeId1 === selectRangeId2) return state;

					let newSelectedNoteIds = state.selectedNoteIds.slice();
					let selectionStarted = false;
					for (let i = 0; i < state.notes.length; i++) {
						const id = state.notes[i].id;

						if (!selectionStarted && (id === selectRangeId1 || id === selectRangeId2)) {
							selectionStarted = true;
							if (newSelectedNoteIds.indexOf(id) < 0) newSelectedNoteIds.push(id);
							continue;
						} else if (selectionStarted && (id === selectRangeId1 || id === selectRangeId2)) {
							if (newSelectedNoteIds.indexOf(id) < 0) newSelectedNoteIds.push(id);
							break;
						}

						if (selectionStarted && newSelectedNoteIds.indexOf(id) < 0) {
							newSelectedNoteIds.push(id);
						}
					}
					newState.selectedNoteIds = newSelectedNoteIds;
				}
			}
			break;

		case 'NOTE_SELECT_ALL':
			newState = Object.assign({}, state);
			newState.selectedNoteIds = newState.notes.map(n => n.id);
			break;

		case 'FOLDER_SELECT':
			newState = changeSelectedFolder(state, action, { clearSelectedNoteIds: true });
			break;

		case 'FOLDER_AND_NOTE_SELECT':
			{
				newState = changeSelectedFolder(state, action, { clearNoteHistory: false });
				const noteSelectAction = Object.assign({}, action, { type: 'NOTE_SELECT' });
				newState = changeSelectedNotes(newState, noteSelectAction, { clearNoteHistory: false });

				if (action.historyNoteAction) {
					const historyNotes = newState.historyNotes.slice();
					if (typeof action.historyNoteAction === 'object') {
						historyNotes.push(Object.assign({}, action.historyNoteAction));
					} else if (action.historyNoteAction === 'pop') {
						historyNotes.pop();
					}
					newState.historyNotes = historyNotes;
				} else if (newState !== state) {
					// Clear the note history if folder and selected note have actually been changed. For example
					// they won't change if they are already selected. That way, the "Back" button to go to the
					// previous note wll stay.
					newState.historyNotes = [];
				}
			}
			break;

		case 'SETTING_UPDATE_ALL':
			newState = Object.assign({}, state);
			newState.settings = action.settings;
			break;

		case 'SETTING_UPDATE_ONE':
			{
				newState = Object.assign({}, state);
				let newSettings = Object.assign({}, state.settings);
				newSettings[action.key] = action.value;
				newState.settings = newSettings;
			}
			break;

			// Replace all the notes with the provided array
		case 'NOTE_UPDATE_ALL':
			newState = Object.assign({}, state);
			newState.notes = action.notes;
			newState.notesSource = action.notesSource;
			break;

			// Insert the note into the note list if it's new, or
			// update it within the note array if it already exists.
		case 'NOTE_UPDATE_ONE':
			{
				const modNote = action.note;

				const noteIsInFolder = function(note, folderId) {
					if (note.is_conflict) return folderId === Folder.conflictFolderId();
					if (!('parent_id' in modNote) || note.parent_id == folderId) return true;
					return false;
				};

				let movedNotePreviousIndex = 0;
				let noteFolderHasChanged = false;
				let newNotes = state.notes.slice();
				var found = false;
				for (let i = 0; i < newNotes.length; i++) {
					let n = newNotes[i];
					if (n.id == modNote.id) {
						// Note is still in the same folder
						if (noteIsInFolder(modNote, n.parent_id)) {
							// Merge the properties that have changed (in modNote) into
							// the object we already have.
							newNotes[i] = Object.assign({}, newNotes[i]);

							for (let n in modNote) {
								if (!modNote.hasOwnProperty(n)) continue;
								newNotes[i][n] = modNote[n];
							}
						} else {
							// Note has moved to a different folder
							newNotes.splice(i, 1);
							noteFolderHasChanged = true;
							movedNotePreviousIndex = i;
						}
						found = true;
						break;
					}
				}

				// Note was not found - if the current folder is the same as the note folder,
				// add it to it.
				if (!found) {
					if (noteIsInFolder(modNote, state.selectedFolderId)) {
						newNotes.push(modNote);
					}
				}

				// newNotes = Note.sortNotes(newNotes, state.notesOrder, newState.settings.uncompletedTodosOnTop);
				newNotes = Note.sortNotes(newNotes, stateUtils.notesOrder(state.settings), newState.settings.uncompletedTodosOnTop);
				newState = Object.assign({}, state);
				newState.notes = newNotes;

				if (noteFolderHasChanged) {
					let newIndex = movedNotePreviousIndex;
					if (newIndex >= newNotes.length) newIndex = newNotes.length - 1;
					if (!newNotes.length) newIndex = -1;
					newState.selectedNoteIds = newIndex >= 0 ? [newNotes[newIndex].id] : [];
				}
			}
			break;

		case 'NOTE_DELETE':
			newState = handleItemDelete(state, action);
			break;

		case 'TAG_DELETE':
			newState = handleItemDelete(state, action);
			newState.selectedNoteTags = removeItemFromArray(newState.selectedNoteTags.splice(0), 'id', action.id);
			break;

		case 'FOLDER_UPDATE_ALL':
			newState = Object.assign({}, state);
			newState.folders = action.items;
			break;

		case 'FOLDER_SET_COLLAPSED':
			newState = folderSetCollapsed(state, action);
			break;

		case 'FOLDER_TOGGLE':
			if (state.collapsedFolderIds.indexOf(action.id) >= 0) {
				newState = folderSetCollapsed(state, Object.assign({ collapsed: false }, action));
			} else {
				newState = folderSetCollapsed(state, Object.assign({ collapsed: true }, action));
			}
			break;

		case 'FOLDER_SET_COLLAPSED_ALL':
			newState = Object.assign({}, state);
			newState.collapsedFolderIds = action.ids.slice();
			break;

		case 'TAG_UPDATE_ALL':
			newState = Object.assign({}, state);
			newState.tags = action.items;
			break;

		case 'TAG_SELECT':
			newState = Object.assign({}, state);
			newState.selectedTagId = action.id;
			if (!action.id) {
				newState.notesParentType = defaultNotesParentType(state, 'Tag');
			} else {
				newState.notesParentType = 'Tag';
			}
			newState.selectedNoteIds = [];
			break;

		case 'TAG_UPDATE_ONE':
			newState = updateOneItem(state, action);
			newState = updateOneItem(newState, action, 'selectedNoteTags');
			break;

		case 'NOTE_TAG_REMOVE':
			{
				newState = updateOneItem(state, action, 'tags');
				let tagRemoved = action.item;
				newState.selectedNoteTags = removeItemFromArray(newState.selectedNoteTags.splice(0), 'id', tagRemoved.id);
			}
			break;

		case 'FOLDER_UPDATE_ONE':
		case 'MASTERKEY_UPDATE_ONE':
			newState = updateOneItem(state, action);
			break;

		case 'FOLDER_DELETE':
			newState = handleItemDelete(state, action);
			break;

		case 'MASTERKEY_UPDATE_ALL':
			newState = Object.assign({}, state);
			newState.masterKeys = action.items;
			break;

		case 'MASTERKEY_SET_NOT_LOADED':
			newState = Object.assign({}, state);
			newState.notLoadedMasterKeys = action.ids;
			break;

		case 'MASTERKEY_ADD_NOT_LOADED':
			{
				if (state.notLoadedMasterKeys.indexOf(action.id) < 0) {
					newState = Object.assign({}, state);
					const keys = newState.notLoadedMasterKeys.slice();
					keys.push(action.id);
					newState.notLoadedMasterKeys = keys;
				}
			}
			break;

		case 'MASTERKEY_REMOVE_NOT_LOADED':
			{
				const ids = action.id ? [action.id] : action.ids;
				for (let i = 0; i < ids.length; i++) {
					const id = ids[i];
					const index = state.notLoadedMasterKeys.indexOf(id);
					if (index >= 0) {
						newState = Object.assign({}, state);
						const keys = newState.notLoadedMasterKeys.slice();
						keys.splice(index, 1);
						newState.notLoadedMasterKeys = keys;
					}
				}
			}
			break;

		case 'SYNC_STARTED':
			newState = Object.assign({}, state);
			newState.syncStarted = true;
			break;

		case 'SYNC_COMPLETED':
			newState = Object.assign({}, state);
			newState.syncStarted = false;
			break;

		case 'SYNC_REPORT_UPDATE':
			newState = Object.assign({}, state);
			newState.syncReport = action.report;
			break;

		case 'SEARCH_QUERY':
			newState = Object.assign({}, state);
			newState.searchQuery = action.query.trim();
			break;

		case 'SEARCH_ADD':
			{
				newState = Object.assign({}, state);
				let searches = newState.searches.slice();
				searches.push(action.search);
				newState.searches = searches;
			}
			break;

		case 'SEARCH_UPDATE':
			{
				newState = Object.assign({}, state);
				let searches = newState.searches.slice();
				let found = false;
				for (let i = 0; i < searches.length; i++) {
					if (searches[i].id === action.search.id) {
						searches[i] = Object.assign({}, action.search);
						found = true;
						break;
					}
				}

				if (!found) searches.push(action.search);

				if (!action.search.query_pattern) {
					newState.notesParentType = defaultNotesParentType(state, 'Search');
				} else {
					newState.notesParentType = 'Search';
				}

				newState.searches = searches;
			}
			break;

		case 'SEARCH_DELETE':
			newState = handleItemDelete(state, action);
			break;

		case 'SEARCH_SELECT':
			newState = Object.assign({}, state);
			newState.selectedSearchId = action.id;
			if (!action.id) {
				newState.notesParentType = defaultNotesParentType(state, 'Search');
			} else {
				newState.notesParentType = 'Search';
			}
			newState.selectedNoteIds = [];
			break;

		case 'APP_STATE_SET':
			newState = Object.assign({}, state);
			newState.appState = action.state;
			break;

		case 'SYNC_HAS_DISABLED_SYNC_ITEMS':
			newState = Object.assign({}, state);
			newState.hasDisabledSyncItems = true;
			break;

		case 'NOTE_SET_NEW_ONE':
			newState = Object.assign({}, state);
			newState.newNote = action.item;
			if (newState.selectedNoteIds.length > 1) {
				newState.selectedNoteIds = newState.selectedNoteIds.slice();
				newState.selectedNoteIds = [newState.selectedNoteIds[0]];
			}
			break;

		case 'CLIPPER_SERVER_SET':
			{
				newState = Object.assign({}, state);
				const clipperServer = Object.assign({}, newState.clipperServer);
				if ('startState' in action) clipperServer.startState = action.startState;
				if ('port' in action) clipperServer.port = action.port;
				newState.clipperServer = clipperServer;
			}
			break;

		case 'DECRYPTION_WORKER_SET':
			{
				newState = Object.assign({}, state);
				const decryptionWorker = Object.assign({}, newState.decryptionWorker);
				for (var n in action) {
					if (!action.hasOwnProperty(n) || n === 'type') continue;
					decryptionWorker[n] = action[n];
				}
				newState.decryptionWorker = decryptionWorker;
			}
			break;

		case 'RESOURCE_FETCHER_SET':
			{
				newState = Object.assign({}, state);
				const rf = Object.assign({}, action);
				delete rf.type;
				newState.resourceFetcher = rf;
			}
			break;

		case 'LOAD_CUSTOM_CSS':
			newState = Object.assign({}, state);
			newState.customCss = action.css;
			break;

		case 'TEMPLATE_UPDATE_ALL':
			newState = Object.assign({}, state);
			newState.templates = action.templates;
			break;

		case 'SET_NOTE_TAGS':
			newState = Object.assign({}, state);
			newState.selectedNoteTags = action.items;
			break;

		case 'PLUGIN_DIALOG_SET':
			{
				if (!action.pluginName) throw new Error('action.pluginName not specified');
				newState = Object.assign({}, state);
				const newPlugins = Object.assign({}, newState.plugins);
				const newPlugin = newState.plugins[action.pluginName] ? Object.assign({}, newState.plugins[action.pluginName]) : {};
				if ('open' in action) newPlugin.dialogOpen = action.open;
				newPlugins[action.pluginName] = newPlugin;
				newState.plugins = newPlugins;
			}
			break;
		}
	} catch (error) {
		error.message = `In reducer: ${error.message} Action: ${JSON.stringify(action)}`;
		throw error;
	}

	if (action.type.indexOf('NOTE_UPDATE') === 0 || action.type.indexOf('FOLDER_UPDATE') === 0 || action.type.indexOf('TAG_UPDATE') === 0) {
		newState = Object.assign({}, newState);
		newState.hasEncryptedItems = stateHasEncryptedItems(newState);
	}

	return newState;
};

module.exports = { reducer, defaultState, stateUtils };
