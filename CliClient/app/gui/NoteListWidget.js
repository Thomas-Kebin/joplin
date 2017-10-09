const Note = require('lib/models/note.js').Note;
const ListWidget = require('tkwidgets/ListWidget.js');

class NoteListWidget extends ListWidget {

	constructor() {
		super();
		this.selectedNoteId_ = 0;

		this.updateIndexFromSelectedNoteId_ = false;

		this.itemRenderer = (note) => {
			let label = note.title + ' ' + note.id;
			if (note.is_todo) {
				label = '[' + (note.todo_completed ? 'X' : ' ') + '] ' + label;
			}
			return label;
		};
	}

	set selectedNoteId(v) {
		if (v === this.selectedNoteId_) return;
		this.updateIndexFromSelectedNoteId_ = true;
		this.selectedNoteId_ = v;
	}

	render() {
		if (this.updateIndexFromSelectedNoteId_) {
			const index = this.itemIndexByKey('id', this.selectedNoteId_);
			this.currentIndex = index >= 0 ? index : 0;
			this.updateIndexFromSelectedNoteId_ = false;
		}

		super.render();
	}

}

module.exports = NoteListWidget;