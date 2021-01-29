import shim from './shim';
import { _ } from './locale';
const { rtrimSlashes } = require('./path-utils.js');
const JoplinError = require('./JoplinError');
const { stringify } = require('query-string');

interface Options {
	baseUrl(): string;
	username(): string;
	password(): string;
}

enum ExecOptionsResponseFormat {
	Json = 'json',
	Text = 'text',
}

enum ExecOptionsTarget {
	String = 'string',
	File = 'file',
}

interface ExecOptions {
	responseFormat?: ExecOptionsResponseFormat;
	target?: ExecOptionsTarget;
	path?: string;
	source?: string;
}

export default class JoplinServerApi {

	private options_: Options;
	private session_: any;

	public constructor(options: Options) {
		this.options_ = options;
	}

	private baseUrl() {
		return rtrimSlashes(this.options_.baseUrl());
	}

	private async session() {
		// TODO: handle invalid session
		if (this.session_) return this.session_;

		this.session_ = await this.exec('POST', 'api/sessions', null, {
			email: this.options_.username(),
			password: this.options_.password(),
		});

		return this.session_;
	}

	private async sessionId() {
		const session = await this.session();
		return session ? session.id : '';
	}

	public async shareFile(pathOrId: string) {
		return this.exec('POST', 'api/shares', null, {
			file_id: pathOrId,
			type: 1, // ShareType.Link
		});
	}

	public static connectionErrorMessage(error: any) {
		const msg = error && error.message ? error.message : 'Unknown error';
		return _('Could not connect to Joplin Server. Please check the Synchronisation options in the config screen. Full error was:\n\n%s', msg);
	}

	public shareUrl(share: any): string {
		return `${this.baseUrl()}/shares/${share.id}`;
	}

	// private requestToCurl_(url: string, options: any) {
	// 	const output = [];
	// 	output.push('curl');
	// 	output.push('-v');
	// 	if (options.method) output.push(`-X ${options.method}`);
	// 	if (options.headers) {
	// 		for (const n in options.headers) {
	// 			if (!options.headers.hasOwnProperty(n)) continue;
	// 			output.push(`${'-H ' + '"'}${n}: ${options.headers[n]}"`);
	// 		}
	// 	}
	// 	if (options.body) output.push(`${'--data ' + '\''}${JSON.stringify(options.body)}'`);
	// 	output.push(url);

	// 	return output.join(' ');
	// }

	public async exec(method: string, path: string = '', query: Record<string, any> = null, body: any = null, headers: any = null, options: ExecOptions = null) {
		if (headers === null) headers = {};
		if (options === null) options = {};
		if (!options.responseFormat) options.responseFormat = ExecOptionsResponseFormat.Json;
		if (!options.target) options.target = ExecOptionsTarget.String;

		let sessionId = '';
		if (path !== 'api/sessions' && !sessionId) {
			sessionId = await this.sessionId();
		}

		if (sessionId) headers['X-API-AUTH'] = sessionId;

		const fetchOptions: any = {};
		fetchOptions.headers = headers;
		fetchOptions.method = method;
		if (options.path) fetchOptions.path = options.path;

		if (body) {
			if (typeof body === 'object') {
				fetchOptions.body = JSON.stringify(body);
				fetchOptions.headers['Content-Type'] = 'application/json';
			} else {
				fetchOptions.body = body;
			}

			fetchOptions.headers['Content-Length'] = `${shim.stringByteLength(fetchOptions.body)}`;
		}

		let url = `${this.baseUrl()}/${path}`;

		if (query) {
			url += url.indexOf('?') < 0 ? '?' : '&';
			url += stringify(query);
		}

		let response: any = null;

		// console.info('Joplin API Call', `${method} ${url}`, headers, options);
		// console.info(this.requestToCurl_(url, fetchOptions));

		if (options.source == 'file' && (method == 'POST' || method == 'PUT')) {
			if (fetchOptions.path) {
				const fileStat = await shim.fsDriver().stat(fetchOptions.path);
				if (fileStat) fetchOptions.headers['Content-Length'] = `${fileStat.size}`;
			}
			response = await shim.uploadBlob(url, fetchOptions);
		} else if (options.target == 'string') {
			if (typeof body === 'string') fetchOptions.headers['Content-Length'] = `${shim.stringByteLength(body)}`;
			response = await shim.fetch(url, fetchOptions);
		} else {
			// file
			response = await shim.fetchBlob(url, fetchOptions);
		}

		const responseText = await response.text();

		// console.info('Joplin API Response', responseText);

		// Creates an error object with as much data as possible as it will appear in the log, which will make debugging easier
		const newError = (message: string, code: number = 0) => {
			// Gives a shorter response for error messages. Useful for cases where a full HTML page is accidentally loaded instead of
			// JSON. That way the error message will still show there's a problem but without filling up the log or screen.
			const shortResponseText = (`${responseText}`).substr(0, 1024);
			return new JoplinError(`${method} ${path}: ${message} (${code}): ${shortResponseText}`, code);
		};

		let responseJson_: any = null;
		const loadResponseJson = async () => {
			if (!responseText) return null;
			if (responseJson_) return responseJson_;
			responseJson_ = JSON.parse(responseText);
			if (!responseJson_) throw newError('Cannot parse JSON response', response.status);
			return responseJson_;
		};

		if (!response.ok) {
			if (options.target === 'file') throw newError('fetchBlob error', response.status);

			let json = null;
			try {
				json = await loadResponseJson();
			} catch (error) {
				// Just send back the plain text in newErro()
			}

			if (json && json.error) {
				throw newError(`${json.error}`, json.code ? json.code : response.status);
			}

			throw newError('Unknown error', response.status);
		}

		if (options.responseFormat === 'text') return responseText;

		const output = await loadResponseJson();
		return output;
	}
}
