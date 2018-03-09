const { BaseCommand } = require("./base-command.js");
const { app } = require("./app.js");
const { _ } = require("lib/locale.js");
const Folder = require("lib/models/Folder.js");
const Note = require("lib/models/Note.js");
const Tag = require("lib/models/Tag.js");

class Command extends BaseCommand {
	usage() {
		return "dump";
	}

	description() {
		return "Dumps the complete database as JSON.";
	}

	hidden() {
		return true;
	}

	async action(args) {
		let items = [];
		let folders = await Folder.all();
		for (let i = 0; i < folders.length; i++) {
			let folder = folders[i];
			let notes = await Note.previews(folder.id);
			items.push(folder);
			items = items.concat(notes);
		}

		let tags = await Tag.all();
		for (let i = 0; i < tags.length; i++) {
			tags[i].notes_ = await Tag.noteIds(tags[i].id);
		}

		items = items.concat(tags);

		this.stdout(JSON.stringify(items));
	}
}

module.exports = Command;
