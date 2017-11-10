const React = require('react');
const { connect } = require('react-redux');
const shared = require('lib/components/shared/side-menu-shared.js');
const { Synchronizer } = require('lib/synchronizer.js');
const { BaseModel } = require('lib/base-model.js');
const { Folder } = require('lib/models/folder.js');
const { Tag } = require('lib/models/tag.js');
const { _ } = require('lib/locale.js');
const { themeStyle } = require('../theme.js');
const { bridge } = require('electron').remote.require('./bridge');
const Menu = bridge().Menu;
const MenuItem = bridge().MenuItem;

class SideBarComponent extends React.Component {

	style() {
		const theme = themeStyle(this.props.theme);

		const itemHeight = 25;

		let style = {
			root: {
				backgroundColor: theme.backgroundColor2,
			},
			listItem: {
				height: itemHeight,
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize,
				textDecoration: 'none',
				boxSizing: 'border-box',
				color: theme.color2,
				paddingLeft: 14,
				display: 'flex',
				alignItems: 'center',
				cursor: 'default',
			},
			listItemSelected: {
				backgroundColor: theme.selectedColor2,
			},
			header: {
				height: itemHeight * 1.8,
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize * 1.3,
				textDecoration: 'none',
				boxSizing: 'border-box',
				color: theme.color2,
				paddingLeft: 8,
				display: 'flex',
				alignItems: 'center',
			},
			button: {
				padding: 6,
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize,
				textDecoration: 'none',
				boxSizing: 'border-box',
				color: theme.color2,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				border: "1px solid rgba(255,255,255,0.2)",
				marginTop: 10,
				marginLeft: 5,
				marginRight: 5,
				cursor: 'default',
			},
			syncReport: {
				fontFamily: theme.fontFamily,
				fontSize: Math.round(theme.fontSize * .9),
				color: theme.color2,
				opacity: .8,
				display: 'flex',
				alignItems: 'left',
				justifyContent: 'top',
				marginTop: 10,
				marginLeft: 5,
				marginRight: 5,
			},
		};

		return style;
	}

	itemContextMenu(event) {
		const itemId = event.target.getAttribute('data-id');
		const itemType = Number(event.target.getAttribute('data-type'));
		if (!itemId || !itemType) throw new Error('No data on element');

		let deleteMessage = '';
		if (itemType === BaseModel.TYPE_FOLDER) {
			deleteMessage = _('Delete notebook?');
		} else if (itemType === BaseModel.TYPE_TAG) {
			deleteMessage = _('Remove this tag from all the notes?');
		}

		const menu = new Menu();

		menu.append(new MenuItem({label: _('Delete'), click: async () => {

			const ok = bridge().showConfirmMessageBox(deleteMessage);
			if (!ok) return;

			if (itemType === BaseModel.TYPE_FOLDER) {
				await Folder.delete(itemId);
			} else if (itemType === BaseModel.TYPE_TAG) {
				await Tag.untagAll(itemId);
			}
		}}))

		menu.popup(bridge().window());
	}

	folderItem_click(folder) {
		this.props.dispatch({
			type: 'FOLDER_SELECT',
			id: folder ? folder.id : null,
		});
	}

	tagItem_click(tag) {
		this.props.dispatch({
			type: 'TAG_SELECT',
			id: tag ? tag.id : null,
		});
	}

	async sync_click() {
		await shared.synchronize_press(this);
	}

	folderItem(folder, selected) {
		let style = Object.assign({}, this.style().listItem);
		if (selected) style = Object.assign(style, this.style().listItemSelected);
		return <a className="list-item" href="#" data-id={folder.id} data-type={BaseModel.TYPE_FOLDER} onContextMenu={(event) => this.itemContextMenu(event)} key={folder.id} style={style} onClick={() => {this.folderItem_click(folder)}}>{folder.title}</a>
	}

	tagItem(tag, selected) {
		let style = Object.assign({}, this.style().listItem);
		if (selected) style = Object.assign(style, this.style().listItemSelected);
		return <a className="list-item" href="#" data-id={tag.id} data-type={BaseModel.TYPE_TAG} onContextMenu={(event) => this.itemContextMenu(event)} key={tag.id} style={style} onClick={() => {this.tagItem_click(tag)}}>{tag.title}</a>
	}

	makeDivider(key) {
		return <div style={{height:2, backgroundColor:'blue' }} key={key}></div>
	}

	makeHeader(key, label, iconName) {
		const style = this.style().header;
		const icon = <i style={{fontSize: style.fontSize * 1.2, marginRight: 5}} className={"icon " + iconName}></i>
		return <div style={style} key={key}>{icon}{label}</div>
	}

	synchronizeButton(label) {
		const style = this.style().button;
		return <a className="synchronize-button" style={style} href="#" key="sync_button" onClick={() => {this.sync_click()}}>{label}</a>
	}

	render() {
		const theme = themeStyle(this.props.theme);
		const style = Object.assign({}, this.style().root, this.props.style);

		let items = [];

		items.push(this.makeHeader('folderHeader', _('Notebooks'), 'ion-android-folder'));

		if (this.props.folders.length) {
			const folderItems = shared.renderFolders(this.props, this.folderItem.bind(this));
			items = items.concat(folderItems);
		}

		items.push(this.makeHeader('tagHeader', _('Tags'), 'ion-pricetags'));

		if (this.props.tags.length) {
			const tagItems = shared.renderTags(this.props, this.tagItem.bind(this));

			items.push(<div className="tags" key="tag_items">{tagItems}</div>);
		}

		let lines = Synchronizer.reportToLines(this.props.syncReport);
		while (lines.length < 10) lines.push(''); // Add blank lines so that height of report text is fixed and doesn't affect scrolling
		const syncReportText = lines.join("\n");

		items.push(this.synchronizeButton(this.props.syncStarted ? _('Cancel') : _('Synchronise')));

		items.push(<div style={this.style().syncReport} key='sync_report'>{syncReportText}</div>);

		return (
			<div className="side-bar" style={style}>
				{items}
			</div>
		);
	}

}

const mapStateToProps = (state) => {
	return {
		folders: state.folders,
		tags: state.tags,
		syncStarted: state.syncStarted,
		syncReport: state.syncReport,
		selectedFolderId: state.selectedFolderId,
		selectedTagId: state.selectedTagId,
		notesParentType: state.notesParentType,
		locale: state.settings.locale,
		theme: state.settings.theme,
	};
};

const SideBar = connect(mapStateToProps)(SideBarComponent);

module.exports = { SideBar };