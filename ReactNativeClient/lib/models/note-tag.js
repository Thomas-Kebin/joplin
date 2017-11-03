const { BaseItem } = require('lib/models/base-item.js');
const { BaseModel } = require('lib/base-model.js');
const lodash = require('lodash');

class NoteTag extends BaseItem {

	static tableName() {
		return 'note_tags';
	}

	static modelType() {
		return BaseModel.TYPE_NOTE_TAG;
	}

	static async serialize(item, type = null, shownKeys = null) {
		let fieldNames = this.fieldNames();
		fieldNames.push('type_');
		return super.serialize(item, 'note_tag', fieldNames);
	}

	static async byNoteIds(noteIds) {
		if (!noteIds.length) return [];
		return this.modelSelectAll('SELECT * FROM note_tags WHERE note_id IN ("' + noteIds.join('","') + '")');
	}

}

module.exports = { NoteTag };