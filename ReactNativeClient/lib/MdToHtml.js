const MarkdownIt = require('markdown-it');
const Entities = require('html-entities').AllHtmlEntities;
const htmlentities = (new Entities()).encode;
const { Resource } = require('lib/models/resource.js');
const { shim } = require('lib/shim.js');
const md5 = require('md5');

class MdToHtml {

	constructor() {
		this.loadedResources_ = {};
		this.cachedContent_ = null;
		this.cachedContentKey_ = null;
	}

	makeContentKey(resources, body, style, options) {
		let k = [];
		for (let n in resources) {
			if (!resources.hasOwnProperty(n)) continue;
			const r = resources[n];
			k.push(r.id);
		}
		k.push(md5(body));
		k.push(md5(JSON.stringify(style)));
		k.push(md5(JSON.stringify(options)));
		return k.join('_');
	}

	renderAttrs_(attrs) {
		if (!attrs) return '';

		let output = [];
		for (let i = 0; i < attrs.length; i++) {
			const n = attrs[i][0];
			const v = attrs[i].length >= 2 ? attrs[i][1] : null;

			if (n === 'alt' && !v) {
				continue;
			} else if (n === 'src') {
				output.push('src="' + htmlentities(v) + '"');
			} else {
				output.push(n + '="' + (v ? htmlentities(v) : '') + '"');
			}
		}
		return output.join(' ');
	}

	getAttr_(attrs, name) {
		for (let i = 0; i < attrs.length; i++) {
			if (attrs[i][0] === name) return attrs[i].length > 1 ? attrs[i][1] : null;
		}
		return null;
	}

	setAttr_(attrs, name, value) {
		for (let i = 0; i < attrs.length; i++) {
			if (attrs[i][0] === name) {
				attrs[i][1] = value;
				return attrs;
			}
		}
		attrs.push([name, value]);
		return attrs;
	}

	renderImage_(attrs, options) {
		const loadResource = async (id) => {
			console.info('Loading resource: ' + id);

			// Initially set to to an empty object to make
			// it clear that it is being loaded. Otherwise
			// it sometimes results in multiple calls to
			// loadResource() for the same resource.
			this.loadedResources_[id] = {};

			const resource = await Resource.load(id);
			resource.base64 = await shim.readLocalFileBase64(Resource.fullPath(resource));

			let newResources = Object.assign({}, this.loadedResources_);
			newResources[id] = resource;
			this.loadedResources_ = newResources;

			console.info('Resource loaded: ', resource.title);

			if (options.onResourceLoaded) options.onResourceLoaded();
		}

		const title = this.getAttr_(attrs, 'title');
		const href = this.getAttr_(attrs, 'src');

		if (!Resource.isResourceUrl(href)) {
			return '<span>' + href + '</span><img title="' + htmlentities(title) + '" src="' + href + '"/>';
		}

		const resourceId = Resource.urlToId(href);
		if (!this.loadedResources_[resourceId]) {
			loadResource(resourceId);
			return '';
		}

		const r = this.loadedResources_[resourceId];
		if (!r.base64) return '';

		const mime = r.mime.toLowerCase();
		if (mime == 'image/png' || mime == 'image/jpg' || mime == 'image/jpeg' || mime == 'image/gif') {
			const src = 'data:' + r.mime + ';base64,' + r.base64;
			let output = '<img title="' + htmlentities(title) + '" src="' + src + '"/>';
			return output;
		}
		
		return '[Image: ' + htmlentities(r.title) + ' (' + htmlentities(mime) + ')]';
	}

	renderOpenLink_(attrs, options) {
		const href = this.getAttr_(attrs, 'href');
		const title = this.getAttr_(attrs, 'title');
		const text = this.getAttr_(attrs, 'text');

		if (Resource.isResourceUrl(href)) {
			// In mobile, links to local resources, such as PDF, etc. currently aren't supported.
			// Ideally they should be opened in the user's browser.
			return '[Resource not yet supported: ' + htmlentities(text) + ']';
		} else {
			const js = options.postMessageSyntax + "(" + JSON.stringify(href) + "); return false;";
			let output = "<a title='" + htmlentities(title) + "' href='#' onclick='" + js + "'>";
			return output;
		}
	}

	renderCloseLink_(attrs, options) {
		const href = this.getAttr_(attrs, 'href');

		if (Resource.isResourceUrl(href)) {
			return '';
		} else {
			return '</a>';
		}
	}

	renderTokens_(tokens, options) {
		let output = [];
		for (let i = 0; i < tokens.length; i++) {
			const t = tokens[i];

			let tag = t.tag;
			let openTag = null;
			let closeTag = null;
			let attrs = t.attrs ? t.attrs : [];
			const isCodeBlock = tag === 'code' && t.block;

			if (t.map) attrs.push(['data-map', t.map.join(':')]);

			if (tag && t.type.indexOf('_open') >= 0) {
				openTag = tag;
			} else if (tag && t.type.indexOf('_close') >= 0) {
				closeTag = tag;
			} else if (tag && t.type.indexOf('inline') >= 0) {
				openTag = tag;
			} else if (t.type === 'link_open') {
				openTag = 'a';
			} else if (isCodeBlock) {
				openTag = 'pre';
			}

			if (openTag) {
				if (openTag === 'a') {
					output.push(this.renderOpenLink_(attrs, options));
				} else {
					const attrsHtml = this.renderAttrs_(attrs);
					output.push('<' + openTag + (attrsHtml ? ' ' + attrsHtml : '') + '>');
				}
			}

			if (isCodeBlock) {
				const codeAttrs = ['code'];
				if (t.info) codeAttrs.push(t.info); // t.info contains the language when the token is a codeblock
				output.push('<code class="' + codeAttrs.join(' ') + '">');
			}

			if (t.type === 'image') {
				if (t.content) attrs.push(['title', t.content]);
				output.push(this.renderImage_(attrs, options));
			} else {
				if (t.children) {
					const parsedChildren = this.renderTokens_(t.children, options);
					output = output.concat(parsedChildren);
				} else {
					if (t.content) {
						output.push(htmlentities(t.content));
					}
				}
			}
 
			if (t.type === 'link_close') {
				closeTag = 'a';
			} else if (tag && t.type.indexOf('inline') >= 0) {
				closeTag = openTag;
			} else if (isCodeBlock) {
				closeTag = openTag;
			}

			if (isCodeBlock) output.push('</code>');

			if (closeTag) {
				if (closeTag === 'a') {
					output.push(this.renderCloseLink_(attrs, options));
				} else {
					output.push('</' + closeTag + '>');
				}
			}			
		}
		return output.join('');
	}

	render(body, style, options = null) {
		if (!options) options = {};
		if (!options.postMessageSyntax) options.postMessageSyntax = 'postMessage';

		const cacheKey = this.makeContentKey(this.loadedResources_, body, style, options);
		if (this.cachedContentKey_ === cacheKey) return this.cachedContent_;

		const md = new MarkdownIt();
		const env = {};

		// Hack to make checkboxes clickable. Ideally, checkboxes should be parsed properly in
		// renderTokens_(), but for now this hack works. Marking it with HORRIBLE_HACK so
		// that it can be removed and replaced later on.
		const HORRIBLE_HACK = true;

		if (HORRIBLE_HACK) {
			let counter = -1;
			while (body.indexOf('- [ ]') >= 0 || body.indexOf('- [X]') >= 0) {
				body = body.replace(/- \[(X| )\]/, function(v, p1) {
					let s = p1 == ' ' ? 'NOTICK' : 'TICK';
					counter++;
					return '- mJOPmCHECKBOXm' + s + 'm' + counter + 'm';
				});
			}
		}

		const tokens = md.parse(body, env);

		// console.info(body);
		// console.info(tokens);

		let renderedBody = this.renderTokens_(tokens, options);

		if (HORRIBLE_HACK) {
			let loopCount = 0;
			while (renderedBody.indexOf('mJOPm') >= 0) {
				renderedBody = renderedBody.replace(/mJOPmCHECKBOXm([A-Z]+)m(\d+)m/, function(v, type, index) {
					const js = options.postMessageSyntax + "('checkboxclick:" + type + ':' + index + "'); this.textContent = this.textContent == '☐' ? '☑' : '☐'; return false;";
					return '<a href="#" onclick="' + js + '" class="checkbox">' + (type == 'NOTICK' ? '☐' : '☑') + '</a>';
				});
				if (loopCount++ >= 9999) break;
			}
		}

		// https://necolas.github.io/normalize.css/
		const normalizeCss = `
			html{line-height:1.15;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}
			article,aside,footer,header,nav,section{display:block}h1{font-size:2em;margin:.67em 0}hr{box-sizing:content-box;height:0;overflow:visible}
			pre{font-family:monospace,monospace;font-size:1em}a{background-color:transparent;-webkit-text-decoration-skip:objects}
			b,strong{font-weight:bolder}small{font-size:80%}img{border-style:none}
		`;

		const css = `
			body {
				font-size: ` + style.htmlFontSize + `;
				color: ` + style.htmlColor + `;
				line-height: ` + style.htmlLineHeight + `;
				background-color: ` + style.htmlBackgroundColor + `;
				font-family: sans-serif;
			}
			p, h1, h2, h3, h4, ul {
				margin-top: 14px;
				margin-bottom: 14px;
			}
			h1 {
				font-size: 1.2em;
				font-weight: bold;
			}
			h2 {
				font-size: 1em;
				font-weight: bold;
			}
			a {
				color: ` + style.htmlLinkColor + `
			}
			ul {
				padding-left: 1em;
			}
			a.checkbox {
				font-size: 1.6em;
				position: relative;
				top: 0.1em;
				text-decoration: none;
				color: ` + style.htmlColor + `;
			}
			table {
				border-collapse: collapse;
			}
			td, th {
				border: 1px solid silver;
				padding: .5em 1em .5em 1em;
			}
			hr {
				border: 1px solid ` + style.htmlDividerColor + `;
			}
			img {
				width: 100%;
			}
		`;

		const styleHtml = '<style>' + normalizeCss + "\n" + css + '</style>';

		const output = styleHtml + renderedBody;

		this.cachedContent_ = output;
		this.cachedContentKey_ = cacheKey;
		return this.cachedContent_;
	}

	toggleTickAt(body, index) {
		let counter = -1;
		while (body.indexOf('- [ ]') >= 0 || body.indexOf('- [X]') >= 0) {
			counter++;

			body = body.replace(/- \[(X| )\]/, function(v, p1) {
				let s = p1 == ' ' ? 'NOTICK' : 'TICK';
				if (index == counter) {
					s = s == 'NOTICK' ? 'TICK' : 'NOTICK';
				}
				return '°°JOP°CHECKBOX°' + s + '°°';
			});
		}

		body = body.replace(/°°JOP°CHECKBOX°NOTICK°°/g, '- [ ]'); 
		body = body.replace(/°°JOP°CHECKBOX°TICK°°/g, '- [X]'); 

		return body;
	}

	handleCheckboxClick(msg, noteBody) {
		msg = msg.split(':');
		let index = Number(msg[msg.length - 1]);
		let currentState = msg[msg.length - 2]; // Not really needed but keep it anyway
		return this.toggleTickAt(noteBody, index);		
	}

}

module.exports = MdToHtml;