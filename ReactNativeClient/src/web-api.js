import { Log } from 'src/log.js';
import { isNode } from 'src/env.js';
import { stringify } from 'query-string';

if (isNode()) {
	// Needs to be in a variable otherwise ReactNative will try to load this module (and fails due to
	// missing node modules), even if isNode() is false.
	let modulePath = 'src/shim.js';
	var { fetch, FormData } = require(modulePath);
}

class WebApiError extends Error {

	constructor(msg) {
		let type = 'WebApiError';
		// Create a regular JS Error object from a web api error response { error: "something", type: "NotFoundException" }
		if (typeof msg === 'object' && msg !== null) {
			if (msg.type) type = msg.type;
			msg = msg.error ? msg.error : 'error';
		}
		super(msg);
		this.type = type;
	}

}

class WebApi {

	constructor(baseUrl) {
		this.baseUrl_ = baseUrl;
		this.session_ = null;
	}

	setSession(v) {
		this.session_ = v;
	}

	session() {
		return this.session_;
	}

	// "form-data" node library doesn't like undefined or null values
	// so make sure we only either return an empty string or a string
	formatFormDataValue(v) {
		if (v === undefined || v === null) return '';
		return v.toString();
	}

	makeRequest(method, path, query, data) {
		let url = this.baseUrl_;
		if (path) url += '/' + path;
		if (query) url += '?' + stringify(query);
		let options = {};
		options.method = method.toUpperCase();
		if (data) {
			let formData = null;
			if (method == 'POST') {
				formData = new FormData();
				for (var key in data) {
					if (!data.hasOwnProperty(key)) continue;
					formData.append(key, this.formatFormDataValue(data[key]));
				}
			} else {
				options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
				formData = stringify(data);
			}

			options.body = formData;
		}

		return {
			url: url,
			options: options
		};
	}

	static toCurl(r, data) {
		let o = r.options;
		let cmd = [];
		cmd.push('curl');
		if (o.method == 'PUT') cmd.push('-X PUT');
		if (o.method == 'PATCH') cmd.push('-X PATCH');
		if (o.method == 'DELETE') cmd.push('-X DELETE');
		if (o.method != 'GET' && o.method != 'DELETE') {
			cmd.push("--data '" + stringify(data) + "'");
		}
		cmd.push("'" + r.url + "'");
		return cmd.join(' ');
	}

	exec(method, path, query, data) {
		return new Promise((resolve, reject) => {
			if (this.session_) {
				query = query ? Object.assign({}, query) : {};
				if (!query.session) query.session = this.session_;
			}

			let r = this.makeRequest(method, path, query, data);

			//Log.debug(WebApi.toCurl(r, data));
			//console.info(WebApi.toCurl(r, data));

			fetch(r.url, r.options).then(function(response) {
				let responseClone = response.clone();

				if (!response.ok) {
					return responseClone.text().then(function(text) {
						reject(new WebApiError('HTTP ' + response.status + ': ' + response.statusText + ': ' + text));
					});
				}

				return response.json().then(function(data) {
					if (data && data.error) {
						reject(new WebApiError(data));
					} else {
						resolve(data);
					}
				}).catch(function(error) {
					responseClone.text().then(function(text) {
						reject(new WebApiError('Cannot parse JSON: ' + text));
					});
				});
			}).then(function(data) {
				resolve(data);
			}).catch(function(error) {
				reject(error);
			});
		});
	}

	get(path, query) {
		return this.exec('GET', path, query);
	}

	post(path, query, data) {
		return this.exec('POST', path, query, data);
	}

	put(path, query, data) {
		return this.exec('PUT', path, query, data);
	}

	patch(path, query, data) {
		return this.exec('PATCH', path, query, data);
	}

	delete(path, query) {
		return this.exec('DELETE', path, query);
	}

}

export { WebApi };