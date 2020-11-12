const shim = require('./shim').default;
const time = require('./time').default;
const Mustache = require('mustache');

const TemplateUtils = {};


// Mustache escapes strings (including /) with the html code by default
// This isn't useful for markdown so it's disabled
Mustache.escape = text => {
	return text;
};

function beginningOfWeek(index) {
	// index: 0 for Sunday, 1 for Monday
	const thisDate = new Date();
	const day = thisDate.getDay(),
		diff = day >= index ? day - index : 6 - day;

	return new Date().setDate(thisDate.getDate() - diff);
}

TemplateUtils.render = function(input) {
	// new template variables can be added here
	// If there are too many, this should be moved to a new file
	// view needs to be set in this function so that the formats reflect settings
	const view = {
		date: time.formatMsToLocal(new Date().getTime(), time.dateFormat()),
		time: time.formatMsToLocal(new Date().getTime(), time.timeFormat()),
		datetime: time.formatMsToLocal(new Date().getTime()),
		custom_datetime: () => {
			return (text, render) => {
				return render(time.formatMsToLocal(new Date().getTime(), text));
			};
		},
		bowm: time.formatMsToLocal(beginningOfWeek(1), time.dateFormat()),
		bows: time.formatMsToLocal(beginningOfWeek(0), time.dateFormat()),
	};

	return Mustache.render(input, view);
};

TemplateUtils.loadTemplates = async function(filePath) {
	const templates = [];
	let files = [];

	if (await shim.fsDriver().exists(filePath)) {
		try {
			files = await shim.fsDriver().readDirStats(filePath);
		} catch (error) {
			let msg = error.message ? error.message : '';
			msg = `Could not read template names from ${filePath}\n${msg}`;
			error.message = msg;
			throw error;
		}

		// Make sure templates are always in the same order
		// sensitivity ensures that the sort will ignore case
		files.sort((a, b) => { return a.path.localeCompare(b.path, undefined, { sensitivity: 'accent' }); });

		for (const file of files) {
			if (file.path.endsWith('.md')) {
				try {
					const fileString = await shim.fsDriver().readFile(`${filePath}/${file.path}`, 'utf-8');
					templates.push({ label: file.path, value: fileString });
				} catch (error) {
					let msg = error.message ? error.message : '';
					msg = `Could not load template ${file.path}\n${msg}`;
					error.message = msg;
					throw error;
				}
			}
		}
	}

	return templates;
};

module.exports = TemplateUtils;
