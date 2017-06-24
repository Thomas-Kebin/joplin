const fetch = require('node-fetch');
const tcpPortUsed = require('tcp-port-used');
const http = require("http");
const urlParser = require("url");
const FormData = require('form-data');
const enableServerDestroy = require('server-destroy');
import { stringify } from 'query-string';

class OneDriveApi {

	constructor(clientId, clientSecret) {
		this.clientId_ = clientId;
		this.clientSecret_ = clientSecret;
		this.auth_ = null;
		this.listeners_ = {
			'authRefreshed': [],
		};
	}

	dispatch(eventName, param) {
		let ls = this.listeners_[eventName];
		for (let i = 0; i < ls.length; i++) {
			ls[i](param);
		}
	}

	on(eventName, callback) {
		this.listeners_[eventName].push(callback);
	}

	tokenBaseUrl() {
		return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
	}

	setAuth(auth) {
		this.auth_ = auth;
	}

	token() {
		return this.auth_ ? this.auth_.access_token : null;
	}

	clientId() {
		return this.clientId_;
	}

	clientSecret() {
		return this.clientSecret_;
	}

	possibleOAuthDancePorts() {
		return [1917, 9917, 8917];
	}

	async appDirectory() {
		let r = await this.execJson('GET', '/drive/special/approot');
		return r.parentReference.path + '/' + r.name;
	}

	authCodeUrl(redirectUri) {
		let query = {
			client_id: this.clientId_,
			scope: 'files.readwrite offline_access',
			response_type: 'code',
			redirect_uri: redirectUri,
		};
		return 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + stringify(query);
	}

	async exec(method, path, query = null, data = null, options = null) {
		method = method.toUpperCase();

		if (!options) options = {};
		if (!options.headers) options.headers = {};

		if (method != 'GET') {
			options.method = method;
		}

		if (method == 'PATCH' || method == 'POST') {
			options.headers['Content-Type'] = 'application/json';
			if (data) data = JSON.stringify(data);
		}

		let url = 'https://graph.microsoft.com/v1.0' + path;

		if (query) url += '?' + stringify(query);

		if (data) options.body = data;

		// console.info(method + ' ' + url);
		// console.info(data);

		for (let i = 0; i < 5; i++) {
			options.headers['Authorization'] = 'bearer ' + this.token();

			let response = await fetch(url, options);
			if (!response.ok) {
				let error = await response.json();

				if (error && error.error && error.error.code == 'InvalidAuthenticationToken') {
					await this.refreshAccessToken();
					continue;
				} else {
					throw error;
				}
			}

			return response;
		}

		throw new Error('Could not execute request after multiple attempts: ' + method + ' ' + url);
	}

	async execJson(method, path, query, data) {
		let response = await this.exec(method, path, query, data);
		let output = await response.json();
		return output;
	}

	async execText(method, path, query, data) {
		let response = await this.exec(method, path, query, data);
		let output = await response.text();
		return output;
	}

	async refreshAccessToken() {
		if (!this.auth_) throw new Error('Cannot refresh token: authentication data is missing');

		let body = new FormData();
		body.append('client_id', this.clientId());
		body.append('client_secret', this.clientSecret());
		body.append('refresh_token', this.auth_.refresh_token);
		body.append('redirect_uri', 'http://localhost:1917');
		body.append('grant_type', 'refresh_token');

		let options = {
			method: 'POST',
			body: body,
		};

		this.auth_ = null;

		let response = await fetch(this.tokenBaseUrl(), options);
		if (!response.ok) {
			let msg = await response.text();
			throw new Error(msg);
		}

		this.auth_ = await response.json();

		this.dispatch('authRefreshed', this.auth_);
	}

	async oauthDance() {
		this.auth_ = null;

		let ports = this.possibleOAuthDancePorts();
		let port = null;
		for (let i = 0; i < ports.length; i++) {
			let inUse = await tcpPortUsed.check(ports[i]);
			if (!inUse) {
				port = ports[i];
				break;
			}
		}

		if (!port) throw new Error('All potential ports are in use - please report the issue at https://github.com/laurent22/joplin');

		let authCodeUrl = this.authCodeUrl('http://localhost:' + port);

		return new Promise((resolve, reject) => {			
			let server = http.createServer();
			let errorMessage = null;

			server.on('request', (request, response) => {
				const query = urlParser.parse(request.url, true).query;

				function writeResponse(code, message) {
					response.writeHead(code, {"Content-Type": "text/html"});
					response.write(message);
					response.end();
				}

				if (!query.code) return writeResponse(400, '"code" query parameter is missing');

				let body = new FormData();
				body.append('client_id', this.clientId());
				body.append('client_secret', this.clientSecret());
				body.append('code', query.code ? query.code : '');
				body.append('redirect_uri', 'http://localhost:' + port.toString());
				body.append('grant_type', 'authorization_code');

				let options = {
					method: 'POST',
					body: body,
				};

				fetch(this.tokenBaseUrl(), options).then((r) => {
					if (!r.ok) {
						errorMessage = 'Could not retrieve auth code: ' + r.status + ': ' + r.statusText;
						writeResponse(400, errorMessage);
						server.destroy();
						return;
					}

					return r.json().then((json) => {
						this.auth_ = json;
						writeResponse(200, 'The application has been authorised - you may now close this browser tab.');
						server.destroy();
					});
				});
			});

			server.on('close', () => {
				if (errorMessage) {
					reject(new Error(errorMessage));
				} else {
					resolve(this.auth_);
				}
			});

			server.listen(port);

			enableServerDestroy(server);

			console.info('Please open this URL in your browser to authentify the application: ' + authCodeUrl);
		});
	}

}

export { OneDriveApi };