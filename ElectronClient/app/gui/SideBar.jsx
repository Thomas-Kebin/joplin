const React = require("react");
const { connect } = require("react-redux");
const shared = require("lib/components/shared/side-menu-shared.js");
const { Synchronizer } = require("lib/synchronizer.js");
const BaseModel = require("lib/BaseModel.js");
const Folder = require("lib/models/Folder.js");
const Note = require("lib/models/Note.js");
const Tag = require("lib/models/Tag.js");
const { _ } = require("lib/locale.js");
const { themeStyle } = require("../theme.js");
const { bridge } = require("electron").remote.require("./bridge");
const Menu = bridge().Menu;
const MenuItem = bridge().MenuItem;
const InteropServiceHelper = require("../InteropServiceHelper.js");

class SideBarComponent extends React.Component {
	style() {
		const theme = themeStyle(this.props.theme);

		const itemHeight = 25;

		let style = {
			root: {
				backgroundColor: theme.backgroundColor2,
			},
			listItemContainer: {
				boxSizing: "border-box",
				height: itemHeight,
				paddingLeft: 14,
				display: "flex",
				alignItems: "stretch",
			},
			listItem: {
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize,
				textDecoration: "none",
				color: theme.color2,
				cursor: "default",
				opacity: 0.8,
				whiteSpace: "nowrap",
				display: "flex",
				flex: 1,
				alignItems: 'center',
			},
			listItemSelected: {
				backgroundColor: theme.selectedColor2,
			},
			listItemExpandIcon: {
				color: theme.color2,
				cursor: "default",
				opacity: 0.8,
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize,
				textDecoration: "none",
				paddingRight: 5,
				display: "flex",
				alignItems: 'center',
			},
			conflictFolder: {
				color: theme.colorError2,
				fontWeight: "bold",
			},
			header: {
				height: itemHeight * 1.8,
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize * 1.3,
				textDecoration: "none",
				boxSizing: "border-box",
				color: theme.color2,
				paddingLeft: 8,
				display: "flex",
				alignItems: "center",
			},
			button: {
				padding: 6,
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize,
				textDecoration: "none",
				boxSizing: "border-box",
				color: theme.color2,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				border: "1px solid rgba(255,255,255,0.2)",
				marginTop: 10,
				marginLeft: 5,
				marginRight: 5,
				cursor: "default",
			},
			syncReport: {
				fontFamily: theme.fontFamily,
				fontSize: Math.round(theme.fontSize * 0.9),
				color: theme.color2,
				opacity: 0.5,
				display: "flex",
				alignItems: "left",
				justifyContent: "top",
				flexDirection: "column",
				marginTop: 10,
				marginLeft: 5,
				marginRight: 5,
				minHeight: 70,
				wordWrap: "break-word",
				width: "100%",
			},
		};

		return style;
	}

	itemContextMenu(event) {
		const itemId = event.target.getAttribute("data-id");
		if (itemId === Folder.conflictFolderId()) return;

		const itemType = Number(event.target.getAttribute("data-type"));
		if (!itemId || !itemType) throw new Error("No data on element");

		let deleteMessage = "";
		if (itemType === BaseModel.TYPE_FOLDER) {
			deleteMessage = _("Delete notebook? All notes within this notebook will also be deleted.");
		} else if (itemType === BaseModel.TYPE_TAG) {
			deleteMessage = _("Remove this tag from all the notes?");
		} else if (itemType === BaseModel.TYPE_SEARCH) {
			deleteMessage = _("Remove this search from the sidebar?");
		}

		const menu = new Menu();

		let item = null;
		if (itemType === BaseModel.TYPE_FOLDER) {
			item = BaseModel.byId(this.props.folders, itemId);
		}

		menu.append(
			new MenuItem({
				label: _("Delete"),
				click: async () => {
					const ok = bridge().showConfirmMessageBox(deleteMessage);
					if (!ok) return;

					if (itemType === BaseModel.TYPE_FOLDER) {
						await Folder.delete(itemId);
					} else if (itemType === BaseModel.TYPE_TAG) {
						await Tag.untagAll(itemId);
					} else if (itemType === BaseModel.TYPE_SEARCH) {
						this.props.dispatch({
							type: "SEARCH_DELETE",
							id: itemId,
						});
					}
				},
			})
		);

		if (itemType === BaseModel.TYPE_FOLDER && !item.encryption_applied) {
			menu.append(
				new MenuItem({
					label: _("Rename"),
					click: async () => {
						this.props.dispatch({
							type: "WINDOW_COMMAND",
							name: "renameFolder",
							id: itemId,
						});
					},
				})
			);

			menu.append(new MenuItem({ type: "separator" }));

			const InteropService = require("lib/services/InteropService.js");

			menu.append(
				new MenuItem({
					label: _("Export"),
					click: async () => {
						const ioService = new InteropService();
						const module = ioService.moduleByFormat_("exporter", "jex");
						await InteropServiceHelper.export(this.props.dispatch.bind(this), module, { sourceFolderIds: [itemId] });
					},
				})
			);
		}

		menu.popup(bridge().window());
	}

	folderItem_click(folder) {
		this.props.dispatch({
			type: "FOLDER_SELECT",
			id: folder ? folder.id : null,
		});
	}

	tagItem_click(tag) {
		this.props.dispatch({
			type: "TAG_SELECT",
			id: tag ? tag.id : null,
		});
	}

	searchItem_click(search) {
		this.props.dispatch({
			type: "SEARCH_SELECT",
			id: search ? search.id : null,
		});
	}

	async sync_click() {
		await shared.synchronize_press(this);
	}

	folderItem(folder, selected, hasChildren, depth) {
		let style = Object.assign({}, this.style().listItem);
		if (folder.id === Folder.conflictFolderId()) style = Object.assign(style, this.style().conflictFolder);

		const onDragOver = (event, folder) => {
			if (event.dataTransfer.types.indexOf("text/x-jop-note-ids") >= 0) event.preventDefault();
		};

		const onDrop = async (event, folder) => {
			if (event.dataTransfer.types.indexOf("text/x-jop-note-ids") < 0) return;
			event.preventDefault();

			const noteIds = JSON.parse(event.dataTransfer.getData("text/x-jop-note-ids"));
			for (let i = 0; i < noteIds.length; i++) {
				await Note.moveToFolder(noteIds[i], folder.id);
			}
		};

		const itemTitle = Folder.displayTitle(folder);

		let containerStyle = Object.assign({}, this.style().listItemContainer);
		containerStyle.marginLeft = depth * 5;

		if (selected) containerStyle = Object.assign(containerStyle, this.style().listItemSelected);

		const expandIcon = !hasChildren ? null : <a href="#" style={this.style().listItemExpandIcon}>[+]</a>

		return (
			<div style={containerStyle} key={folder.id}>
				{ expandIcon }
				<a
					className="list-item"
					onDragOver={event => {
						onDragOver(event, folder);
					}}
					onDrop={event => {
						onDrop(event, folder);
					}}
					href="#"
					data-id={folder.id}
					data-type={BaseModel.TYPE_FOLDER}
					onContextMenu={event => this.itemContextMenu(event)}
					style={style}
					onClick={() => {
						this.folderItem_click(folder);
					}}
				>
					{itemTitle}
				</a>
			</div>
		);
	}

	tagItem(tag, selected) {
		let style = Object.assign({}, this.style().listItem);
		if (selected) style = Object.assign(style, this.style().listItemSelected);
		return (
			<a
				className="list-item"
				href="#"
				data-id={tag.id}
				data-type={BaseModel.TYPE_TAG}
				onContextMenu={event => this.itemContextMenu(event)}
				key={tag.id}
				style={style}
				onClick={() => {
					this.tagItem_click(tag);
				}}
			>
				{Tag.displayTitle(tag)}
			</a>
		);
	}

	searchItem(search, selected) {
		let style = Object.assign({}, this.style().listItem);
		if (selected) style = Object.assign(style, this.style().listItemSelected);
		return (
			<a
				className="list-item"
				href="#"
				data-id={search.id}
				data-type={BaseModel.TYPE_SEARCH}
				onContextMenu={event => this.itemContextMenu(event)}
				key={search.id}
				style={style}
				onClick={() => {
					this.searchItem_click(search);
				}}
			>
				{search.title}
			</a>
		);
	}

	makeDivider(key) {
		return <div style={{ height: 2, backgroundColor: "blue" }} key={key} />;
	}

	makeHeader(key, label, iconName) {
		const style = this.style().header;
		const icon = <i style={{ fontSize: style.fontSize * 1.2, marginRight: 5 }} className={"fa " + iconName} />;
		return (
			<div style={style} key={key}>
				{icon}
				{label}
			</div>
		);
	}

	synchronizeButton(type) {
		const style = this.style().button;
		const iconName = type === "sync" ? "fa-refresh" : "fa-times";
		const label = type === "sync" ? _("Synchronise") : _("Cancel");
		const icon = <i style={{ fontSize: style.fontSize, marginRight: 5 }} className={"fa " + iconName} />;
		return (
			<a
				className="synchronize-button"
				style={style}
				href="#"
				key="sync_button"
				onClick={() => {
					this.sync_click();
				}}
			>
				{icon}
				{label}
			</a>
		);
	}

	render() {
		const theme = themeStyle(this.props.theme);
		const style = Object.assign({}, this.style().root, this.props.style, {
			overflowX: "hidden",
			overflowY: "auto",
		});

		let items = [];

		items.push(this.makeHeader("folderHeader", _("Notebooks"), "fa-folder-o"));

		if (this.props.folders.length) {
			const folderItems = shared.renderFolders(this.props, this.folderItem.bind(this));
			items = items.concat(folderItems);
		}

		items.push(this.makeHeader("tagHeader", _("Tags"), "fa-tags"));

		if (this.props.tags.length) {
			const tagItems = shared.renderTags(this.props, this.tagItem.bind(this));

			items.push(
				<div className="tags" key="tag_items">
					{tagItems}
				</div>
			);
		}

		let lines = Synchronizer.reportToLines(this.props.syncReport);
		const syncReportText = [];
		for (let i = 0; i < lines.length; i++) {
			syncReportText.push(
				<div key={i} style={{ wordWrap: "break-word", width: "100%" }}>
					{lines[i]}
				</div>
			);
		}

		items.push(this.synchronizeButton(this.props.syncStarted ? "cancel" : "sync"));

		items.push(
			<div style={this.style().syncReport} key="sync_report">
				{syncReportText}
			</div>
		);

		return (
			<div className="side-bar" style={style}>
				{items}
			</div>
		);
	}
}

const mapStateToProps = state => {
	return {
		folders: state.folders,
		tags: state.tags,
		searches: state.searches,
		syncStarted: state.syncStarted,
		syncReport: state.syncReport,
		selectedFolderId: state.selectedFolderId,
		selectedTagId: state.selectedTagId,
		selectedSearchId: state.selectedSearchId,
		notesParentType: state.notesParentType,
		locale: state.settings.locale,
		theme: state.settings.theme,
	};
};

const SideBar = connect(mapStateToProps)(SideBarComponent);

module.exports = { SideBar };
