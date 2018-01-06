const { time } = require('lib/time-utils');
const BaseItem = require('lib/models/BaseItem.js');
const Alarm = require('lib/models/Alarm');
const Folder = require('lib/models/Folder.js');
const Note = require('lib/models/Note.js');
const { _ } = require('lib/locale.js');

class ReportService {

	csvEscapeCell(cell) {
		cell = this.csvValueToString(cell);
		let output = cell.replace(/"/, '""');
		if (this.csvCellRequiresQuotes(cell, ',')) {
			return '"' + output + '"';
		}
		return output;
	}

	csvCellRequiresQuotes(cell, delimiter) {
		if (cell.indexOf('\n') >= 0) return true;
		if (cell.indexOf('"') >= 0) return true;
		if (cell.indexOf(delimiter) >= 0) return true;
		return false;
	}

	csvValueToString(v) {
		if (v === undefined || v === null) return '';
		return v.toString();
	}

	csvCreateLine(row) {
		for (let i = 0; i < row.length; i++) {
			row[i] = this.csvEscapeCell(row[i]);
		}
		return row.join(',');
	}

	csvCreate(rows) {
		let output = [];
		for (let i = 0; i < rows.length; i++) {
			output.push(this.csvCreateLine(rows[i]));
		}
		return output.join('\n');
	}

	async basicItemList(option = null) {
		if (!option) option = {};
		if (!option.format) option.format = 'array';

		const itemTypes = BaseItem.syncItemTypes();
		let output = [];
		output.push(['type', 'id', 'updated_time', 'sync_time', 'is_conflict']);
		for (let i = 0; i < itemTypes.length; i++) {
			const itemType = itemTypes[i];
			const ItemClass = BaseItem.getClassByItemType(itemType);
			const items = await ItemClass.modelSelectAll('SELECT items.id, items.updated_time, sync_items.sync_time FROM ' + ItemClass.tableName() + ' items JOIN sync_items ON sync_items.item_id = items.id');

			for (let j = 0; j < items.length; j++) {
				const item = items[j];
				let row = [itemType, item.id, item.updated_time, item.sync_time];
				row.push(('is_conflict' in item) ? item.is_conflict : '');
				output.push(row);
			}
		}

		return option.format === 'csv' ? this.csvCreate(output) : output;
	}

	async syncStatus(syncTarget) {
		let output = {
			items: {},
			total: {},
		};

		let itemCount = 0;
		let syncedCount = 0;
		for (let i = 0; i < BaseItem.syncItemDefinitions_.length; i++) {
			let d = BaseItem.syncItemDefinitions_[i];
			let ItemClass = BaseItem.getClass(d.className);
			let o = {
				total: await ItemClass.count(),
				synced: await ItemClass.syncedCount(syncTarget),
			};
			output.items[d.className] = o;
			itemCount += o.total;
			syncedCount += o.synced;
		}

		let conflictedCount = await Note.conflictedCount();

		output.total = {
			total: itemCount - conflictedCount,
			synced: syncedCount,
		};

		output.toDelete = {
			total: await BaseItem.deletedItemCount(syncTarget),
		};

		output.conflicted = {
			total: await Note.conflictedCount(),
		};

		output.items['Note'].total -= output.conflicted.total;

		return output;
	}

	async status(syncTarget) {
		let r = await this.syncStatus(syncTarget);
		let sections = [];
		let section = null;

		const disabledItems = await BaseItem.syncDisabledItems(syncTarget);

		if (disabledItems.length) {
			section = { title: _('Items that cannot be synchronised'), body: [] };

			for (let i = 0; i < disabledItems.length; i++) {
				const row = disabledItems[i];
				section.body.push(_('%s (%s): %s', row.item.title, row.item.id, row.syncInfo.sync_disabled_reason));
			}

			section.body.push('');
			section.body.push(_('These items will remain on the device but will not be uploaded to the sync target. In order to find these items, either search for the title or the ID (which is displayed in brackets above).'));

			sections.push(section);
		}

		section = { title: _('Sync status (synced items / total items)'), body: [] };

		for (let n in r.items) {
			if (!r.items.hasOwnProperty(n)) continue;
			section.body.push(_('%s: %d/%d', n, r.items[n].synced, r.items[n].total));
		}

		section.body.push(_('Total: %d/%d', r.total.synced, r.total.total));
		section.body.push('');
		section.body.push(_('Conflicted: %d', r.conflicted.total));
		section.body.push(_('To delete: %d', r.toDelete.total));

		sections.push(section);

		section = { title: _('Folders'), body: [] };

		const folders = await Folder.all({
			order: { by: 'title', dir: 'ASC' },
			caseInsensitive: true,
		});

		for (let i = 0; i < folders.length; i++) {
			const folder = folders[i];
			section.body.push(_('%s: %d notes', folders[i].title, await Folder.noteCount(folders[i].id)));
		}

		sections.push(section);

		const alarms = await Alarm.allDue();

		if (alarms.length) {
			section = { title: _('Coming alarms'), body: [] };

			for (let i = 0; i < alarms.length; i++) {
				const alarm = alarms[i];
				const note = await Note.load(alarm.note_id);
				section.body.push(_('On %s: %s', time.formatMsToLocal(alarm.trigger_time), note.title));
			}

			sections.push(section);
		}

		return sections;
	}

}

module.exports = { ReportService };