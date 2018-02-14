const { Logger } = require('lib/logger.js');
const { shim } = require('lib/shim.js');
const parseXmlString = require('xml2js').parseString;
const JoplinError = require('lib/JoplinError');
const URL = require('url-parse');
const { rtrimSlashes, ltrimSlashes } = require('lib/path-utils.js');
const base64 = require('base-64');

// Note that the d: namespace (the DAV namespace) is specific to Nextcloud. The RFC for example uses "D:" however
// we make all the tags and attributes lowercase so we handle both the Nextcloud style and RFC. Hopefully other
// implementations use the same namespaces. If not, extra processing can be done in `nameProcessor`, for
// example to convert a custom namespace to "d:" so that it can be used by the rest of the code.
// In general, we should only deal with things in "d:", which is the standard DAV namespace.

class WebDavApi {

	constructor(options) {
		this.logger_ = new Logger();
		this.options_ = options;
	}

	setLogger(l) {
		this.logger_ = l;
	}

	logger() {
		return this.logger_;
	}

	authToken() {
		if (!this.options_.username() || !this.options_.password()) return null;
		return base64.encode(this.options_.username() + ':' + this.options_.password());
	}

	baseUrl() {
		return this.options_.baseUrl();
	}

	relativeBaseUrl() {
		const url = new URL(this.baseUrl());
		return url.pathname + url.query;
	}

	async xmlToJson(xml) {
		let davNamespaces = []; // Yes, there can be more than one... xmlns:a="DAV:" xmlns:D="DAV:"

		const nameProcessor = (name) => {
			if (name.indexOf('xmlns:') !== 0) {
				// Check if the current name is within the DAV namespace. If it is, normalise it
				// by moving it to the "d:" namespace, which is what all the functions are using.
				const p = name.split(':');
				if (p.length == 2) {
					const ns = p[0];
					if (davNamespaces.indexOf(ns) >= 0) {
						name = 'd:' + p[1];
					}
				}
			}
			return name.toLowerCase();
		};

		const attrValueProcessor = (value, name) => {
			if (value.toLowerCase() === 'dav:') {
				const p = name.split(':');
				davNamespaces.push(p[p.length - 1]);
			}
		}

		const options = {
			tagNameProcessors: [nameProcessor],
			attrNameProcessors: [nameProcessor],
			attrValueProcessors: [attrValueProcessor]
		}

		return new Promise((resolve, reject) => {
			parseXmlString(xml, options, (error, result) => {
				if (error) {
					resolve(null); // Error handled by caller which will display the XML text (or plain text) if null is returned from this function
					return;
				}
				resolve(result);
			});
		});
	}

	valueFromJson(json, keys, type) {	
		let output = json;

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];

			// console.info(key, typeof key, typeof output, typeof output === 'object' && (key in output), Array.isArray(output));

			if (typeof key === 'number' && !Array.isArray(output)) return null;
			if (typeof key === 'string' && (typeof output !== 'object' || !(key in output))) return null;
			output = output[key];
		}

		if (type === 'string') {
			// If the XML has not attribute the value is directly a string
			// If the XML node has attributes, the value is under "_".
			// Eg for this XML, the string will be under {"_":"Thu, 01 Feb 2018 17:24:05 GMT"}:
			// <a:getlastmodified b:dt="dateTime.rfc1123">Thu, 01 Feb 2018 17:24:05 GMT</a:getlastmodified>
			// For this XML, the value will be "Thu, 01 Feb 2018 17:24:05 GMT"
			// <a:getlastmodified>Thu, 01 Feb 2018 17:24:05 GMT</a:getlastmodified>

			if (typeof output === 'object' && '_' in output) output = output['_'];
			if (typeof output !== 'string') return null;
			return output;
		}

		if (type === 'object') {
			if (!Array.isArray(output) && typeof output === 'object') return output;
			return null;
		}

		if (type === 'array') {
			return Array.isArray(output) ? output : null;
		}

		return null;
	}

	stringFromJson(json, keys) {
		return this.valueFromJson(json, keys, 'string');
	}

	objectFromJson(json, keys) {
		return this.valueFromJson(json, keys, 'object');
	}

	arrayFromJson(json, keys) {
		return this.valueFromJson(json, keys, 'array');
	}

	resourcePropByName(resource, outputType, propName) {
		const propStats = resource['d:propstat'];
		let output = null;
		if (!Array.isArray(propStats)) throw new Error('Missing d:propstat property');
		for (let i = 0; i < propStats.length; i++) {
			const props = propStats[i]['d:prop'];
			if (!Array.isArray(props) || !props.length) continue;
			const prop = props[0];
			if (Array.isArray(prop[propName])) {
				output = prop[propName];
				break;
			}
		}

		if (outputType === 'string') {
			// If the XML has not attribute the value is directly a string
			// If the XML node has attributes, the value is under "_".
			// Eg for this XML, the string will be under {"_":"Thu, 01 Feb 2018 17:24:05 GMT"}:
			// <a:getlastmodified b:dt="dateTime.rfc1123">Thu, 01 Feb 2018 17:24:05 GMT</a:getlastmodified>
			// For this XML, the value will be "Thu, 01 Feb 2018 17:24:05 GMT"
			// <a:getlastmodified>Thu, 01 Feb 2018 17:24:05 GMT</a:getlastmodified>

			output = output[0];

			if (typeof output === 'object' && '_' in output) output = output['_'];
			if (typeof output !== 'string') return null;
			return output;
		}

		if (outputType === 'array') {
			return output;
		}

		throw new Error('Invalid output type: ' + outputType);
	}

	async execPropFind(path, depth, fields = null, options = null) {
		if (fields === null) fields = ['d:getlastmodified'];

		let fieldsXml = '';
		for (let i = 0; i < fields.length; i++) {
			fieldsXml += '<' + fields[i] + '/>';
		}

		// To find all available properties:
		//
		// const body=`<?xml version="1.0" encoding="utf-8" ?>
		// 	<propfind xmlns="DAV:">
		// 	<propname/>
		// </propfind>`;

		const body = `<?xml version="1.0" encoding="UTF-8"?>
			<d:propfind xmlns:d="DAV:">
				<d:prop xmlns:oc="http://owncloud.org/ns">
					` + fieldsXml + `
				</d:prop>
			</d:propfind>`;

		return this.exec('PROPFIND', path, body, { 'Depth': depth }, options);
	}

	requestToCurl_(url, options) {
		let output = [];
		output.push('curl');
		if (options.method) output.push('-X ' + options.method);
		if (options.headers) {
			for (let n in options.headers) {
				if (!options.headers.hasOwnProperty(n)) continue;
				output.push('-H ' + '"' + n + ': ' + options.headers[n] + '"');
			}
		}
		if (options.body) output.push('--data ' + "'" + options.body + "'");
		output.push(url);

		return output.join(' ');		
	}	

	// curl -u admin:123456 'http://nextcloud.local/remote.php/dav/files/admin/' -X PROPFIND --data '<?xml version="1.0" encoding="UTF-8"?>
	//  <d:propfind xmlns:d="DAV:">
	//    <d:prop xmlns:oc="http://owncloud.org/ns">
	//      <d:getlastmodified/>
	//    </d:prop>
	//  </d:propfind>'

	async exec(method, path = '', body = null, headers = null, options = null) {
		if (headers === null) headers = {};
		if (options === null) options = {};
		if (!options.responseFormat) options.responseFormat = 'json';
		if (!options.target) options.target = 'string';

		const authToken = this.authToken();

		if (authToken) headers['Authorization'] = 'Basic ' + authToken;

		// /!\ Doesn't work with UTF-8 strings as it results in truncated content. Content-Length
		// /!\ should not be needed anyway, but was required by one service. If re-implementing this
		// /!\ test with various content, including binary blobs.
		// if (typeof body === 'string') headers['Content-Length'] = body.length;

		const fetchOptions = {};
		fetchOptions.headers = headers;
		fetchOptions.method = method;
		if (options.path) fetchOptions.path = options.path;
		if (body) fetchOptions.body = body;

		const url = this.baseUrl() + '/' + path;

		let response = null;

		// console.info('WebDAV Call', method + ' ' + url, headers, options);
		// console.info(this.requestToCurl_(url, fetchOptions));

		if (options.source == 'file' && (method == 'POST' || method == 'PUT')) {
			response = await shim.uploadBlob(url, fetchOptions);
		} else if (options.target == 'string') {
			response = await shim.fetch(url, fetchOptions);
		} else { // file
			response = await shim.fetchBlob(url, fetchOptions);
		}

		const responseText = await response.text();

		// console.info('WebDAV Response', responseText);

		// Gives a shorter response for error messages. Useful for cases where a full HTML page is accidentally loaded instead of
		// JSON. That way the error message will still show there's a problem but without filling up the log or screen.
		const shortResponseText = () => {
			return (responseText + '').substr(0, 1024);
		}

		let responseJson_ = null;
		const loadResponseJson = async () => {
			if (!responseText) return null;
			if (responseJson_) return responseJson_;
			responseJson_ = await this.xmlToJson(responseText);
			if (!responseJson_) throw new JoplinError('Cannot parse JSON response: ' + shortResponseText(), response.status);
			return responseJson_;
		}

		if (!response.ok) {
			// When using fetchBlob we only get a string (not xml or json) back
			if (options.target === 'file') throw new JoplinError(shortResponseText(), response.status);

			const json = await loadResponseJson();

			if (json && json['d:error']) {
				const code = json['d:error']['s:exception'] ? json['d:error']['s:exception'].join(' ') : response.status;
				const message = json['d:error']['s:message'] ? json['d:error']['s:message'].join("\n") : shortResponseText();
				throw new JoplinError(method + ' ' + path + ': ' + message + ' (' + code + ')', response.status);
			}

			throw new JoplinError(method + ' ' + path + ': ' + shortResponseText(), response.status);
		}
		
		if (options.responseFormat === 'text') return responseText;

		const output = await loadResponseJson();

		// Check that we didn't get for example an HTML page (as an error) instead of the JSON response
		// null responses are possible, for example for DELETE calls
		if (output !== null && typeof output === 'object' && !('d:multistatus' in output)) throw new Error('Not a valid JSON response: ' + shortResponseText());

		return output;
	}

}

module.exports = WebDavApi;