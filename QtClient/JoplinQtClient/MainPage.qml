import QtQuick 2.7
import QtQuick.Controls 2.0
import QtQuick.Layouts 1.0

Item {

	property Item appRoot
	property alias itemList: itemList

//	Component {
//		id: rectangleComponent
//		Rectangle { width: 80; height: 50; color: "red" }
//	}


//	function createRectangle() {
//		var rect = rectangleComponent.createObject(parent);
//		rect.x = 200;
//		//console.info("aAAAAAAAAAAAAAAAAAAAAAAAA");
//	}

	ItemList2 {
		id: itemList
		width: 800
		height: 600
	}



//	RowLayout {
//		id: layout
//		anchors.fill: parent
//		spacing: 0

//		ItemList {
//			id: folderList
//			model: folderListModel
//			Layout.fillWidth: true
//			Layout.fillHeight: true
//			Layout.minimumWidth: 50
//			Layout.preferredWidth: 100
//			Layout.maximumWidth: 200
//			Layout.minimumHeight: 150

//			onCurrentItemChanged: {
//				appRoot.currentFolderChanged()
//			}

//			onEditingAccepted: function(index, text) {
//				handleItemListEditingAccepted(folderList, index, text);
//			}

//			onStoppedEditing: {
//				handleItemListStoppedEditing(folderList);
//			}

//			onDeleteButtonClicked: {
//				handleItemListAction(folderList, "delete");
//			}
//		}

//		ItemList {
//			id: noteList
//			model: noteListModel
//			Layout.fillWidth: true
//			Layout.fillHeight: true
//			Layout.minimumWidth: 100
//			Layout.maximumWidth: 200
//			Layout.preferredWidth: 200
//			Layout.preferredHeight: 100

//			onCurrentItemChanged: {
//				appRoot.currentNoteChanged()
//			}

//			onEditingAccepted: function(index, text) {
//				handleItemListEditingAccepted(noteList, index, text);
//			}

//			onStoppedEditing: {
//				handleItemListStoppedEditing(noteList);
//			}

//			onDeleteButtonClicked: {
//				handleItemListAction(noteList, "delete");
//			}
//		}

//		NoteEditor {
//			id: noteEditor
//			model: noteModel
//			Layout.fillWidth: true
//			Layout.fillHeight: true
//			Layout.minimumWidth: 100
//			Layout.preferredHeight: 100
//		}

//	}

//	AddButton {
//		id: addButton
//		anchors.right: parent.right
//		anchors.bottom: parent.bottom
//		onAddFolderButtonClicked: handleAddItem(folderList)
//		onAddNoteButtonClicked: handleAddItem(noteList)
//	}

//	Button {
//		id: syncButton
//		text: "Sync"
//		anchors.right: parent.right
//		anchors.top: parent.top
//		onClicked: appRoot.syncButtonClicked()
//	}

//	Button {
//		id: logoutButton
//		text: "Logout"
//		anchors.right: syncButton.left
//		anchors.top: parent.top
//		onClicked: appRoot.logoutClicked()
//	}

}




//import QtQuick 2.7
//import QtQuick.Controls 2.0
//import QtQuick.Layouts 1.0

//Item {

//	property Item appRoot
//	property alias currentFolderIndex: folderList.currentIndex
//	property alias currentNoteIndex: noteList.currentIndex

//	function onShown() {}

//	function handleAddItem(list) {
//		list.model.showVirtualItem();
//		list.startEditing(list.model.rowCount() - 1);
//	}

//	function handleItemListEditingAccepted(list, index, text) {
//		if (list.model.virtualItemShown()) {
//			list.model.hideVirtualItem();
//			list.model.addData(text)
//			print("handleItemListEditingAccepted");
//			list.selectItemById(list.model.lastInsertId());
//		} else {
//			list.model.setData(index, text, "title")
//		}
//	}

//	function handleItemListStoppedEditing(list) {
//		if (list.model.virtualItemShown()) {
//			list.model.hideVirtualItem();
//		}
//	}

//	function handleItemListAction(list, action) {
//		if (action === "delete") {
//			if (list.currentIndex === undefined) return;
//			list.model.deleteData(list.currentIndex)
//		}
//	}

//	RowLayout {
//		id: layout
//		anchors.fill: parent
//		spacing: 0

//		ItemList {
//			id: folderList
//			model: folderListModel
//			Layout.fillWidth: true
//			Layout.fillHeight: true
//			Layout.minimumWidth: 50
//			Layout.preferredWidth: 100
//			Layout.maximumWidth: 200
//			Layout.minimumHeight: 150

//			onCurrentItemChanged: {
//				appRoot.currentFolderChanged()
//			}

//			onEditingAccepted: function(index, text) {
//				handleItemListEditingAccepted(folderList, index, text);
//			}

//			onStoppedEditing: {
//				handleItemListStoppedEditing(folderList);
//			}

//			onDeleteButtonClicked: {
//				handleItemListAction(folderList, "delete");
//			}
//		}

//		ItemList {
//			id: noteList
//			model: noteListModel
//			Layout.fillWidth: true
//			Layout.fillHeight: true
//			Layout.minimumWidth: 100
//			Layout.maximumWidth: 200
//			Layout.preferredWidth: 200
//			Layout.preferredHeight: 100

//			onCurrentItemChanged: {
//				appRoot.currentNoteChanged()
//			}

//			onEditingAccepted: function(index, text) {
//				handleItemListEditingAccepted(noteList, index, text);
//			}

//			onStoppedEditing: {
//				handleItemListStoppedEditing(noteList);
//			}

//			onDeleteButtonClicked: {
//				handleItemListAction(noteList, "delete");
//			}
//		}

//		NoteEditor {
//			id: noteEditor
//			model: noteModel
//			Layout.fillWidth: true
//			Layout.fillHeight: true
//			Layout.minimumWidth: 100
//			Layout.preferredHeight: 100
//		}

//	}

//	AddButton {
//		id: addButton
//		anchors.right: parent.right
//		anchors.bottom: parent.bottom
//		onAddFolderButtonClicked: handleAddItem(folderList)
//		onAddNoteButtonClicked: handleAddItem(noteList)
//	}

//	Button {
//		id: syncButton
//		text: "Sync"
//		anchors.right: parent.right
//		anchors.top: parent.top
//		onClicked: appRoot.syncButtonClicked()
//	}

//	Button {
//		id: logoutButton
//		text: "Logout"
//		anchors.right: syncButton.left
//		anchors.top: parent.top
//		onClicked: appRoot.logoutClicked()
//	}

//}
