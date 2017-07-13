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

function enexXmlToMdArray(stream, resources) {
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

		// Section: {
		// 	type: "block/table/tr/td",
		// 	lines: []
		// }


		// [
		// 	{
		// 		type: "text",
		// 		lines: [],
		// 	},
		// 	{
		// 		type: "table",
		// 		trs: [
		// 			{
		// 				tds: [
		// 					{
		// 						lines: [],
		// 					}
		// 				],
		// 			}
		// 		],
		// ]

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

				if (output.length < 1) throw new Error('Invalid anchor tag closing'); // Sanity check, but normally not possible

				// When closing the anchor tag, check if there's is any text content. If not
				// put the URL as is (don't wrap it in [](url)). The markdown parser, using
				// GitHub flavour, will turn this URL into a link. This is to generate slightly
				// cleaner markdown.
				let previous = output[output.length - 1];
				if (previous == '[') {
					output.pop();
					output.push(url);
				} else if (!previous || previous == url) {
					output.pop();
					output.pop();
					output.push(url);
				} else {
					output.push('](' + url + ')');
				}
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

async function enexXmlToMd(stream, resources) {
	let result = await enexXmlToMdArray(stream, resources);

	let mdLines = result.lines;
	let firstAttachment = true;
	for (let i = 0; i < result.resources.length; i++) {
		let r = result.resources[i];
		if (firstAttachment) mdLines.push(NEWLINE);
		mdLines.push(NEWLINE);
		mdLines = addResourceTag(mdLines, r, r.filename);
		firstAttachment = false;
	}

	//console.info(mdLines);

	return processMdArrayNewLines(mdLines);
}

export { enexXmlToMd, processMdArrayNewLines, NEWLINE, addResourceTag };