const { ItemList } = require('./ItemList.min.js');
const React = require('react');
const { connect } = require('react-redux');
const { time } = require('lib/time-utils.js');
const { themeStyle } = require('../theme.js');
const { _ } = require('lib/locale.js');
const { bridge } = require('electron').remote.require('./bridge');
const Menu = bridge().Menu;
const MenuItem = bridge().MenuItem;

class NoteListComponent extends React.Component {

	style() {
		const theme = themeStyle(this.props.theme);

		const itemHeight = 34;

		let style = {
			root: {
				backgroundColor: theme.backgroundColor,
			},
			listItem: {
				height: itemHeight,
				boxSizing: 'border-box',
				display: 'flex',
				alignItems: 'stretch',
				backgroundColor: theme.backgroundColor,
				borderBottom: '1px solid ' + theme.dividerColor,
			},
			listItemSelected: {
				backgroundColor: theme.selectedColor,
			},
			listItemTitle: {
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize,
				textDecoration: 'none',
				color: theme.color,
				cursor: 'default',
				whiteSpace: 'nowrap',
				flex: 1,
				display: 'flex',
				alignItems: 'center',
				overflow: 'hidden',
			},
			listItemTitleCompleted: {
				opacity: 0.5,
				textDecoration: 'line-through',
			},
		};

		return style;
	}

	itemContextMenu(event) {
		const noteId = event.target.getAttribute('data-id');
		if (!noteId) throw new Error('No data-id on element');

		const menu = new Menu()

		menu.append(new MenuItem({label: _('Delete'), click: async () => {
			const ok = bridge().showConfirmMessageBox(_('Delete note?'));
			if (!ok) return;
			await Note.delete(noteId);
		}}));

		menu.append(new MenuItem({label: _('Switch between note and to-do'), click: async () => {
			const note = await Note.load(noteId);
			await Note.save(Note.toggleIsTodo(note));
		}}))

		menu.popup(bridge().window());
	}

	itemRenderer(item, theme, width) {
		const onTitleClick = async (event, item) => {
			this.props.dispatch({
				type: 'NOTE_SELECT',
				id: item.id,
			});
		}

		const onCheckboxClick = async (event) => {
			const checked = event.target.checked;
			const newNote = {
				id: item.id,
				todo_completed: checked ? time.unixMs() : 0,
			}
			await Note.save(newNote);
		}

		const padding = 6;

		let style = Object.assign({ width: width }, this.style().listItem);
		if (this.props.selectedNoteId === item.id) style = Object.assign(style, this.style().listItemSelected);

		// Setting marginBottom = 1 because it makes the checkbox looks more centered, at least on Windows
		// but don't know how it will look in other OSes.
		const checkbox = item.is_todo ? 
			<div style={{display: 'flex', height: style.height, alignItems: 'center', paddingLeft: padding}}>
				<input style={{margin:0, marginBottom:1}} type="checkbox" defaultChecked={!!item.todo_completed} onClick={(event) => { onCheckboxClick(event, item) }}/>
			</div>
		: null;

		let listItemTitleStyle = Object.assign({}, this.style().listItemTitle);
		listItemTitleStyle.paddingLeft = checkbox ? padding : 4;
		if (item.is_todo && !!item.todo_completed) listItemTitleStyle = Object.assign(listItemTitleStyle, this.style().listItemTitleCompleted);

		return <div key={item.id} style={style}>
			{checkbox}
			<a
				data-id={item.id}
				className="list-item"
				onContextMenu={(event) => this.itemContextMenu(event)}
				href="#"
				style={listItemTitleStyle}
				onClick={(event) => { onTitleClick(event, item) }}
			>
			{item.title}
			</a>
		</div>
	}

	render() {
		const theme = themeStyle(this.props.theme);
		const style = this.props.style;

		if (!this.props.notes.length) {
			const padding = 10;
			const emptyDivStyle = Object.assign({
				padding: padding + 'px',
				fontSize: theme.fontSize,
				color: theme.color,
				backgroundColor: theme.backgroundColor,
				fontFamily: theme.fontFamily,
			}, style);
			emptyDivStyle.width = emptyDivStyle.width - padding * 2;
			emptyDivStyle.height = emptyDivStyle.height - padding * 2;
			return <div style={emptyDivStyle}>{_('No notes in here. Create one by clicking on "New note".')}</div>
		}

		return (
			<ItemList
				itemHeight={this.props.itemHeight}
				style={style}
				className={"note-list"}
				items={this.props.notes}
				itemRenderer={ (item) => { return this.itemRenderer(item, theme, style.width) } }
			></ItemList>
		);
	}

}

const mapStateToProps = (state) => {
	return {
		notes: state.notes,
		selectedNoteId: state.selectedNoteId,
		theme: state.settings.theme,
	};
};

const NoteList = connect(mapStateToProps)(NoteListComponent);

module.exports = { NoteList };