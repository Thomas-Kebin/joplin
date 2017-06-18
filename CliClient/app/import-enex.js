require('app-module-path').addPath(__dirname);

import { uuid } from 'src/uuid.js';
import moment from 'moment';
import { promiseChain } from 'src/promise-utils.js';
import { WebApi } from 'src/web-api.js'
import { folderItemFilename } from 'src/string-utils.js'
import jsSHA from "jssha";

let webApi = new WebApi('http://joplin.local');

const Promise = require('promise');
const fs = require('fs');
const stringToStream = require('string-to-stream')
 
const BLOCK_OPEN = "<div>";
const BLOCK_CLOSE = "</div>";
const NEWLINE = "<br/>";
const NEWLINE_MERGED = "<merged/>";
const SPACE = "<space/>";

function processMdArrayNewLines(md) {
	while (md.length && md[0] == BLOCK_OPEN) {
		md.shift();
	}

	while (md.length && md[md.length - 1] == BLOCK_CLOSE) {
		md.pop();
	}

	let temp = [];
	let last = '';
	for (let i = 0; i < md.length; i++) { let v = md[i];
		if (isNewLineBlock(last) && isNewLineBlock(v) && last == v) {
			// Skip it
		} else {
			temp.push(v);
		}
		last = v;
	}
	md = temp;



	temp = [];
	last = "";
	for (let i = 0; i < md.length; i++) { let v = md[i];
		if (last == BLOCK_CLOSE && v == BLOCK_OPEN) {
			temp.pop();
			temp.push(NEWLINE_MERGED);
		} else {
			temp.push(v);
		}
		last = v;
	}
	md = temp;



	temp = [];
	last = "";
	for (let i = 0; i < md.length; i++) { let v = md[i];
		if (last == NEWLINE && (v == NEWLINE_MERGED || v == BLOCK_CLOSE)) {
			// Skip it
		} else {
			temp.push(v);
		}
		last = v;
	}
	md = temp;



	// NEW!!!
	temp = [];
	last = "";
	for (let i = 0; i < md.length; i++) { let v = md[i];
		if (last == NEWLINE && (v == NEWLINE_MERGED || v == BLOCK_OPEN)) {
			// Skip it
		} else {
			temp.push(v);
		}
		last = v;
	}
	md = temp;




	if (md.length > 2) {
		if (md[md.length - 2] == NEWLINE_MERGED && md[md.length - 1] == NEWLINE) {
			md.pop();
		}
	}

	let output = '';
	let previous = '';
	let start = true;
	for (let i = 0; i < md.length; i++) { let v = md[i];
		let add = '';
		if (v == BLOCK_CLOSE || v == BLOCK_OPEN || v == NEWLINE || v == NEWLINE_MERGED) {
			add = "\n";
		} else if (v == SPACE) {
			if (previous == SPACE || previous == "\n" || start) {
				continue; // skip
			} else {
				add = " ";
			}
		} else {
			add = v;
		}
		start = false;
		output += add;
		previous = add;
	}

	if (!output.trim().length) return '';

	return output;
}

function isWhiteSpace(c) {
	return c == '\n' || c == '\r' || c == '\v' || c == '\f' || c == '\t' || c == ' ';
}

// Like QString::simpified(), except that it preserves non-breaking spaces (which
// Evernote uses for identation, etc.)
function simplifyString(s) {
	let output = '';
	let previousWhite = false;
	for (let i = 0; i < s.length; i++) {
		let c = s[i];
		let isWhite = isWhiteSpace(c);
		if (previousWhite && isWhite) {
			// skip
		} else {
			output += c;
		}
		previousWhite = isWhite;
	}

	while (output.length && isWhiteSpace(output[0])) output = output.substr(1);
	while (output.length && isWhiteSpace(output[output.length - 1])) output = output.substr(0, output.length - 1);

	return output;
}

function collapseWhiteSpaceAndAppend(lines, state, text) {
	if (state.inCode) {
		text = "\t" + text;
		lines.push(text);
	} else {
		// Remove all \n and \r from the left and right of the text
		while (text.length && (text[0] == "\n" || text[0] == "\r")) text = text.substr(1);
		while (text.length && (text[text.length - 1] == "\n" || text[text.length - 1] == "\r")) text = text.substr(0, text.length - 1);

		// Collapse all white spaces to just one. If there are spaces to the left and right of the string
		// also collapse them to just one space.
		let spaceLeft = text.length && text[0] == ' ';
		let spaceRight = text.length && text[text.length - 1] == ' ';
		text = simplifyString(text);

		if (!spaceLeft && !spaceRight && text == "") return lines;

		if (spaceLeft) lines.push(SPACE);
		lines.push(text);
		if (spaceRight) lines.push(SPACE);
	}

	return lines;
}

const imageMimeTypes = ["image/cgm", "image/fits", "image/g3fax", "image/gif", "image/ief", "image/jp2", "image/jpeg", "image/jpm", "image/jpx", "image/naplps", "image/png", "image/prs.btif", "image/prs.pti", "image/t38", "image/tiff", "image/tiff-fx", "image/vnd.adobe.photoshop", "image/vnd.cns.inf2", "image/vnd.djvu", "image/vnd.dwg", "image/vnd.dxf", "image/vnd.fastbidsheet", "image/vnd.fpx", "image/vnd.fst", "image/vnd.fujixerox.edmics-mmr", "image/vnd.fujixerox.edmics-rlc", "image/vnd.globalgraphics.pgb", "image/vnd.microsoft.icon", "image/vnd.mix", "image/vnd.ms-modi", "image/vnd.net-fpx", "image/vnd.sealed.png", "image/vnd.sealedmedia.softseal.gif", "image/vnd.sealedmedia.softseal.jpg", "image/vnd.svf", "image/vnd.wap.wbmp", "image/vnd.xiff"];

function isImageMimeType(m) {
	return imageMimeTypes.indexOf(m) >= 0;
}

function addResourceTag(lines, resource, alt = "") {
	let tagAlt = alt == "" ? resource.alt : alt;
	if (!tagAlt) tagAlt = '';
	if (isImageMimeType(resource.mime)) {
		lines.push("![");
		lines.push(tagAlt);
		lines.push("](:/" + resource.id + ")");
	} else {
		lines.push("[");
		lines.push(tagAlt);
		lines.push("](:/" + resource.id + ")");
	}

	return lines;
}


function enexXmlToMd(stream, resources) {
	resources = resources.slice();

	return new Promise((resolve, reject) => {
		let output = [];

		let state = {
			inCode: false,
			lists: [],
			anchorAttributes: [],
		};

		let options = {};
		let strict = true;
		var saxStream = require('sax').createStream(strict, options)

		saxStream.on('error', function(e) {
		  reject(e);
		})

		saxStream.on('text', function(text) {
			output = collapseWhiteSpaceAndAppend(output, state, text);
		})

		saxStream.on('opentag', function(node) {
			let n = node.name.toLowerCase();
			if (n == 'en-note') {
				// Start of note
			} else if (isBlockTag(n)) {
				output.push(BLOCK_OPEN);
			} else if (isListTag(n)) {
				output.push(BLOCK_OPEN);
				state.lists.push({ tag: n, counter: 1 });
			} else if (n == 'li') {
				output.push(BLOCK_OPEN);
				if (!state.lists.length) {
					reject("Found <li> tag without being inside a list"); // TODO: could be a warning, but nothing to handle warnings at the moment
					return;
				}

				let container = state.lists[state.lists.length - 1];
				if (container.tag == "ul") {
					output.push("- ");
				} else {
					output.push(container.counter + '. ');
					container.counter++;
				}
			} else if (isStrongTag(n)) {
				output.push("**");
			} else if (n == 's') {
				// Not supported
			} else if (isAnchor(n)) {
				state.anchorAttributes.push(node.attributes);
				output.push('[');
			} else if (isEmTag(n)) {
				output.push("*");
			} else if (n == "en-todo") {
				let x = node.attributes && node.attributes.checked && node.attributes.checked.toLowerCase() == 'true' ? 'X' : ' ';
				output.push('- [' + x + '] ');
			} else if (n == "hr") {
				output.push('------------------------------------------------------------------------------');
			} else if (n == "h1") {
				output.push(BLOCK_OPEN); output.push("# ");
			} else if (n == "h2") {
				output.push(BLOCK_OPEN); output.push("## ");
			} else if (n == "h3") {
				output.push(BLOCK_OPEN); output.push("### ");
			} else if (n == "h4") {
				output.push(BLOCK_OPEN); output.push("#### ");
			} else if (n == "h5") {
				output.push(BLOCK_OPEN); output.push("##### ");
			} else if (n == "h6") {
				output.push(BLOCK_OPEN); output.push("###### ");
			} else if (isCodeTag(n)) {
				output.push(BLOCK_OPEN);
				state.inCode = true;
			} else if (n == "br") {
				output.push(NEWLINE);
			} else if (n == "en-media") {
				const hash = node.attributes.hash;

				let resource = null;
				for (let i = 0; i < resources.length; i++) {
					let r = resources[i];
					if (r.id == hash) {
						resource = r;
						resources.splice(i, 1);
						break;
					}
				}

				if (!resource) {
					// This is a bit of a hack. Notes sometime have resources attached to it, but those <resource> tags don't contain
					// an "objID" tag, making it impossible to reference the resource. However, in this case the content of the note
					// will contain a corresponding <en-media/> tag, which has the ID in the "hash" attribute. All this information
					// has been collected above so we now set the resource ID to the hash attribute of the en-media tags. Here's an
					// example of note that shows this problem:

					//	<?xml version="1.0" encoding="UTF-8"?>
					//	<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export2.dtd">
					//	<en-export export-date="20161221T203133Z" application="Evernote/Windows" version="6.x">
					//		<note>
					//			<title>Commande</title>
					//			<content>
					//				<![CDATA[
					//					<?xml version="1.0" encoding="UTF-8"?>
					//					<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
					//					<en-note>
					//						<en-media alt="your QR code" hash="216a16a1bbe007fba4ccf60b118b4ccc" type="image/png"></en-media>
					//					</en-note>
					//				]]>
					//			</content>
					//			<created>20160921T203424Z</created>
					//			<updated>20160921T203438Z</updated>
					//			<note-attributes>
					//				<reminder-order>20160902T140445Z</reminder-order>
					//				<reminder-done-time>20160924T101120Z</reminder-done-time>
					//			</note-attributes>
					//			<resource>
					//				<data encoding="base64">........</data>
					//				<mime>image/png</mime>
					//				<width>150</width>
					//				<height>150</height>
					//			</resource>
					//		</note>
					//	</en-export>

					let found = false;
					for (let i = 0; i < resources.length; i++) {
						let r = resources[i];
						if (!r.id) {
							r.id = hash;
							resources[i] = r;
							found = true;
							break;
						}
					}

					if (!found) {
						console.warn('Hash with no associated resource: ' + hash);
					}
				} else {
					// If the resource does not appear among the note's resources, it
					// means it's an attachement. It will be appended along with the
					// other remaining resources at the bottom of the markdown text.
					if (!!resource.id) {
						output = addResourceTag(output, resource, node.attributes.alt);
					}
				}
			} else if (n == "span" || n == "font") {
				// Ignore
			} else {
				console.warn("Unsupported start tag: " + n);
			}
		})

		saxStream.on('closetag', function(n) {
			if (n == 'en-note') {
				// End of note
			} else if (isNewLineOnlyEndTag(n)) {
				output.push(BLOCK_CLOSE);
			} else if (isIgnoredEndTag(n)) {
				// Skip
			} else if (isListTag(n)) {
				output.push(BLOCK_CLOSE);
				state.lists.pop();
			} else if (isStrongTag(n)) {
				output.push("**");
			} else if (isEmTag(n)) {
				output.push("*");
			} else if (isCodeTag(n)) {
				state.inCode = false;
				output.push(BLOCK_CLOSE);
			} else if (isAnchor(n)) {
				let attributes = state.anchorAttributes.pop();
				let url = attributes && attributes.href ? attributes.href : '';
				output.push('](' + url + ')');
			} else if (isListTag(n)) {
				output.push(BLOCK_CLOSE);
				state.lists.pop();
			} else if (n == "en-media") {
				// Skip
			} else if (isIgnoredEndTag(n)) {
				// Skip
			} else {
				console.warn("Unsupported end tag: " + n);
			}

		})

		saxStream.on('attribute', function(attr) {
			
		})

		saxStream.on('end', function() {
			resolve({
				lines: output,
				resources: resources,
			});
		})

		stream.pipe(saxStream);
	});
}



// const path = require('path');

// var walk = function (dir, done) {
// 	fs.readdir(dir, function (error, list) {
// 		if (error) return done(error);
// 		var i = 0;
// 		(function next () {
// 			var file = list[i++];

// 			if (!file) return done(null);            
// 			file = dir + '/' + file;
			
// 			fs.stat(file, function (error, stat) {
// 				if (stat && stat.isDirectory()) {
// 					walk(file, function (error) {
// 						next();
// 					});
// 				} else {
// 					if (path.basename(file) != 'sample4.xml') {
// 						next();
// 						return;
// 					}

// 					if (path.extname(file) == '.xml') {
// 						console.info('Processing: ' + file);
// 						let stream = fs.createReadStream(file);
// 						enexXmlToMd(stream).then((md) => {
// 							console.info(md);
// 							console.info(processMdArrayNewLines(md));
// 							next();
// 						}).catch((error) => {
// 							console.error(error);
// 							return done(error);
// 						});
// 					} else {
// 						next();
// 					}
// 				}
// 			});
// 		})();
// 	});
// };

// walk('/home/laurent/Dropbox/Samples/', function(error) {
// 	if (error) {
// 		throw error;
// 	} else {
// 		console.log('-------------------------------------------------------------');
// 		console.log('finished.');
// 		console.log('-------------------------------------------------------------');
// 	}
// });

function isBlockTag(n) {
	return n=="div" || n=="p" || n=="dl" || n=="dd" || n=="center" || n=="table" || n=="tr" || n=="td" || n=="th" || n=="tbody";
}

function isStrongTag(n) {
	return n == "strong" || n == "b";
}

function isEmTag(n) {
	return n == "em" || n == "i" || n == "u";
}

function isAnchor(n) {
	return n == "a";
}

function isIgnoredEndTag(n) {
	return n=="en-note" || n=="en-todo" || n=="span" || n=="body" || n=="html" || n=="font" || n=="br" || n=='hr' || n=='s';
}

function isListTag(n) {
	return n == "ol" || n == "ul";
}

// Elements that don't require any special treatment beside adding a newline character
function isNewLineOnlyEndTag(n) {
	return n=="div" || n=="p" || n=="li" || n=="h1" || n=="h2" || n=="h3" || n=="h4" || n=="h5" || n=="dl" || n=="dd" || n=="center" || n=="table" || n=="tr" || n=="td" || n=="th" || n=="tbody";
}

function isCodeTag(n) {
	return n == "pre" || n == "code";
}

function isNewLineBlock(s) {
	return s == BLOCK_OPEN || s == BLOCK_CLOSE;
}

function xmlNodeText(xmlNode) {
	if (!xmlNode || !xmlNode.length) return '';
	return xmlNode[0];
}

function dateToTimestamp(s) {
	let m = moment(s, 'YYYYMMDDTHHmmssZ');
	if (!m.isValid()) {
		throw new Error('Invalid date: ' + s);
	}
	return Math.round(m.toDate().getTime() / 1000);
}

function evernoteXmlToMdArray(xml) {
	return parseXml(xml).then((xml) => {
		console.info(xml);
	});
}

function extractRecognitionObjId(recognitionXml) {
	const r = recognitionXml.match(/objID="(.*?)"/);
	return r && r.length >= 2 ? r[1] : null;
}

function saveNoteToWebApi(note) {
	let data = Object.assign({}, note);
	delete data.resources;
	delete data.tags;

	webApi.post('notes', null, data).then((r) => {
		//console.info(r);
	}).catch((error) => {
		console.error("Error for note: " + note.title);
		console.error(error);
	});
}

function noteserialize_format(propName, propValue) {
	if (['created_time', 'updated_time'].indexOf(propName) >= 0) {
		if (!propValue) return '';
		propValue = moment.unix(propValue).format('YYYY-MM-DD hh:mm:ss');
	} else if (propValue === null || propValue === undefined) {
		propValue = '';
	}

	return propValue;
}

function noteserialize(note) {
	let shownKeys = ["author", "longitude", "latitude", "is_todo", "todo_due", "todo_completed", 'created_time', 'updated_time'];
	let output = [];

	output.push(note.title);
	output.push("");
	output.push(note.body);
	output.push('');
	for (let i = 0; i < shownKeys.length; i++) {
		let v = note[shownKeys[i]];
		v = noteserialize_format(shownKeys[i], v);
		output.push(shownKeys[i] + ': ' + v);
	}

	return output.join("\n");
}

// function folderItemFilename(item) {
// 	let output = escapeFilename(item.title).trim();
// 	if (!output.length) output = '_';
// 	return output + '.' + item.id.substr(0, 7);
// }

function noteFilename(note) {
	return folderItemFilename(note) + '.md';
}

function folderFilename(folder) {
	return folderItemFilename(folder);
}

function filePutContents(filePath, content) {
	return new Promise((resolve, reject) => {
		fs.writeFile(filePath, content, function(error) {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

function setModifiedTime(filePath, time) {
	return new Promise((resolve, reject) => {
		fs.utimes(filePath, time, time, (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		})
	});
}

function createDirectory(path) {
	return new Promise((resolve, reject) => {
		fs.exists(path, (exists) => {
			if (exists) {
				resolve();
				return;
			}

			const mkdirp = require('mkdirp');
		
			mkdirp(path, (error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	});
}

const baseNoteDir = '/home/laurent/Temp/TestImport';

// createDirectory('/home/laurent/Temp/TestImport').then(() => {
// 	console.info('OK');
// }).catch((error) => {
// 	console.error(error);
// });

function saveNoteToDisk(folder, note) {
	const noteContent = noteserialize(note);
	const notePath = baseNoteDir + '/' + folderFilename(folder) + '/' + noteFilename(note);

	// console.info('===================================================');
	// console.info(note);//noteContent);
	return filePutContents(notePath, noteContent).then(() => {
		return setModifiedTime(notePath, note.updated_time ? note.updated_time : note.created_time);
	});
}

function saveFolderToDisk(folder) {
	let path = baseNoteDir + '/' + folderFilename(folder);
	return createDirectory(path);
}

function createNoteId(note) {
	let shaObj = new jsSHA("SHA-256", "TEXT");
	shaObj.update(note.title + '_' + note.body + "_" + note.created_time + "_" + note.updated_time + "_");
	let hash = shaObj.getHash("HEX");
	return hash.substr(0, 32);
}

function importEnex(parentFolder, stream) {
	return new Promise((resolve, reject) => {
		let options = {};
		let strict = true;
		let saxStream = require('sax').createStream(strict, options);

		let nodes = []; // LIFO list of nodes so that we know in which node we are in the onText event
		let note = null;
		let noteAttributes = null;
		let noteResource = null;
		let noteResourceAttributes = null;
		let noteResourceRecognition = null;
		let notes = [];

		function currentNodeName() {
			if (!nodes.length) return null;
			return nodes[nodes.length - 1].name;
		}

		function currentNodeAttributes() {
			if (!nodes.length) return {};
			return nodes[nodes.length - 1].attributes;
		}

		function processNotes() {
			let chain = [];
			while (notes.length) {
				let note = notes.shift();
				const contentStream = stringToStream(note.bodyXml);
				chain.push(() => {
					return enexXmlToMd(contentStream, note.resources).then((result) => {
						delete note.bodyXml;

						let mdLines = result.lines;
						let firstAttachment = true;
						for (let i = 0; i < result.resources.length; i++) {
							let r = result.resources[i];
							if (firstAttachment) mdLines.push(NEWLINE);
							mdLines.push(NEWLINE);
							mdLines = addResourceTag(mdLines, r, r.filename);
							firstAttachment = false;
						}

						note.parent_id = parentFolder.id;
						note.body = processMdArrayNewLines(result.lines);
						note.id = uuid.create();

						saveNoteToDisk(parentFolder, note);

						// console.info(noteserialize(note));
						// console.info('=========================================================================================================================');

						//saveNoteToWebApi(note);

						// console.info('======== NOTE ============================================================================');
						// let c = note.content;
						// delete note.content
						// console.info(note);
						// console.info('------------------------------------------------------------------------------------------');
						// console.info(c);

						// if (note.resources.length) {
						// 	console.info('=========================================================');
						// 	console.info(note.content);
						// }
					});
				});
			}

			return promiseChain(chain);
		}

		saxStream.on('error', function(e) {
			reject(e);
		})

		saxStream.on('text', function(text) {
			let n = currentNodeName();

			if (noteAttributes) {
				noteAttributes[n] = text;
			} else if (noteResourceAttributes) {
				noteResourceAttributes[n] = text;				
			} else if (noteResource) {
				if (n == 'data') {
					let attr = currentNodeAttributes();
					noteResource.dataEncoding = attr.encoding;
				}
				noteResource[n] = text;
			} else if (note) {
				if (n == 'title') {
					note.title = text;
				} else if (n == 'created') {
					note.created_time = dateToTimestamp(text);
				} else if (n == 'updated') {
					note.updated_time = dateToTimestamp(text);
				} else if (n == 'tag') {
					note.tags.push(text);
				}
			}
		})

		saxStream.on('opentag', function(node) {
			let n = node.name.toLowerCase();
			nodes.push(node);

			if (n == 'note') {
				note = {
					resources: [],
					tags: [],
				};
			} else if (n == 'resource-attributes') {
				noteResourceAttributes = {};
			} else if (n == 'recognition') {
				if (noteResource) noteResourceRecognition = {};
			} else if (n == 'note-attributes') {
				noteAttributes = {};
			} else if (n == 'resource') {
				noteResource = {};
			}
		});

		saxStream.on('cdata', function(data) {
			let n = currentNodeName();

			if (noteResourceRecognition) {
				noteResourceRecognition.objID = extractRecognitionObjId(data);
			} else if (note) {
				if (n == 'content') {
					note.bodyXml = data;
				}
			}
		});

		saxStream.on('closetag', function(n) {
			nodes.pop();

			if (n == 'note') {
				notes.push(note);
				if (notes.length >= 10) {
					stream.pause();
					processNotes().then(() => {
						stream.resume();
					}).catch((error) => {
						console.info('Error processing note', error);
					});
				}
				note = null;
			} else if (n == 'recognition' && noteResource) {
				noteResource.id = noteResourceRecognition.objID;
				noteResourceRecognition = null;
			} else if (n == 'resource-attributes') {
				noteResource.filename = noteResourceAttributes['file-name'];
				noteResourceAttributes = null;
			} else if (n == 'note-attributes') {
				note.latitude = noteAttributes.latitude;
				note.longitude = noteAttributes.longitude;
				note.altitude = noteAttributes.altitude;
				note.author = noteAttributes.author;
				noteAttributes = null;
			} else if (n == 'resource') {
				let decodedData = null;
				if (noteResource.dataEncoding == 'base64') {
					decodedData = Buffer.from(noteResource.data, 'base64');
				} else {
					reject('Cannot decode resource with encoding: ' + noteResource.dataEncoding);
					return;
				}

				let r = {
					id: noteResource.id,
					data: decodedData,
					mime_type: noteResource.mime,
					title: noteResource.filename,
					filename: noteResource.filename,
				};

				r.data = noteResource.data.substr(0, 20); // TODO: REMOVE REMOVE REMOVE REMOVE REMOVE REMOVE 

				note.resources.push(r);
				noteResource = null;
			}
		});

		saxStream.on('end', function() {
			processNotes().then(() => { resolve(); });
		});

		stream.pipe(saxStream);
	});
}

// TODO: make it persistent and random
const clientId = 'AB78AB78AB78AB78AB78AB78AB78AB78';

const folderTitle = 'Laurent';
//const folderTitle = 'Voiture';

webApi.post('sessions', null, {
	email: 'laurent@cozic.net',
	password: '12345678',
	client_id: clientId,
}).then((session) => {
	webApi.setSession(session.id);
	console.info('Got session: ' + session.id);
	return webApi.get('folders');
}).then((folders) => {
	
	let folder = null;

	for (let i = 0; i < folders.length; i++) {
		if (folders[i].title = folderTitle) {
			folder = folders[i];
			break;
		}
	}

	return folder ? Promise.resolve(folder) : webApi.post('folders', null, { title: folderTitle });
}).then((folder) => {
	return saveFolderToDisk(folder).then(() => {
		return folder;
	});
}).then((folder) => {
	let fileStream = fs.createReadStream('/mnt/c/Users/Laurent/Desktop/' + folderTitle + '.enex');
	//let fileStream = fs.createReadStream('/mnt/c/Users/Laurent/Desktop/afaire.enex');
	//let fileStream = fs.createReadStream('/mnt/c/Users/Laurent/Desktop/testtags.enex');
	importEnex(folder, fileStream).then(() => {
		//console.info('DONE IMPORTING');
	}).catch((error) => {
		console.error('Cannot import', error);
	});
}).catch((error) => {
	console.error(error);
});