const BaseModel = require('lib/BaseModel.js');

class NoteResource extends BaseModel {

	static tableName() {
		return 'note_resources';
	}

	static modelType() {
		return BaseModel.TYPE_NOTE_RESOURCE;
	}

	static async setAssociatedResources(noteId, resourceIds) {
		const existingRows = await this.modelSelectAll('SELECT * FROM note_resources WHERE note_id = ?', [noteId]);

		const notProcessedResourceIds = resourceIds.slice();
		const queries = [];
		for (let i = 0; i < existingRows.length; i++) {
			const row = existingRows[i];
			const resourceIndex = resourceIds.indexOf(row.resource_id);

			if (resourceIndex >= 0) {
				queries.push({ sql: 'UPDATE note_resources SET last_seen_time = ?, is_associated = 1 WHERE id = ?', params: [Date.now(), row.id] });
				notProcessedResourceIds.splice(notProcessedResourceIds.indexOf(row.resource_id), 1);
			} else {
				queries.push({ sql: 'UPDATE note_resources SET is_associated = 0 WHERE id = ?', params: [row.id] });
			}
		}

		for (let i = 0; i < notProcessedResourceIds.length; i++) {
			queries.push({ sql: 'INSERT INTO note_resources (note_id, resource_id, is_associated, last_seen_time) VALUES (?, ?, ?, ?)', params: [noteId, notProcessedResourceIds[i], 1, Date.now()] });
		}

		await this.db().transactionExecBatch(queries);		
	}

	static async remove(noteId) {
		await this.db().exec({ sql: 'UPDATE note_resources SET is_associated = 0 WHERE note_id = ?', params: [noteId] });
	}

	static async orphanResources(expiryDelay = null) {
		if (expiryDelay === null) expiryDelay = 1000 * 60 * 60 * 24;
		const cutOffTime = Date.now() - expiryDelay;
		const output = await this.modelSelectAll('SELECT DISTINCT resource_id FROM note_resources WHERE is_associated = 0 AND last_seen_time < ?', [cutOffTime]);
		return output.map(r => r.resource_id);
	}

}

module.exports = NoteResource;