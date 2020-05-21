const fs = require('fs-extra');
const glob = require('glob');

async function main() {
	const sourceDir = `${__dirname}/../../Modules/TinyMCE/langs`;
	const destDir = `${__dirname}/../node_modules/tinymce/langs`;
	console.info(`Copying ${sourceDir} => ${destDir}`);
	await fs.remove(destDir);
	await fs.mkdirp(destDir);
	await fs.copy(sourceDir, destDir);

	const supportedLocales = glob.sync(`${sourceDir}/*.js`).map(s => {
		s = s.split('/');
		s = s[s.length - 1];
		s = s.split('.');
		return s[0];
	});

	const content = `module.exports = ${JSON.stringify(supportedLocales, null, 2)}`;

	await fs.writeFile(`${__dirname}/../gui/NoteEditor/NoteBody/TinyMCE/supportedLocales.js`, content, 'utf8');
}

module.exports = main;
