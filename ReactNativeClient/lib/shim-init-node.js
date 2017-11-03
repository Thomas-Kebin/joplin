const fs = require('fs-extra');
const { shim } = require('lib/shim.js');
const { GeolocationNode } = require('lib/geolocation-node.js');
const { FileApiDriverLocal } = require('lib/file-api-driver-local.js');
const { time } = require('lib/time-utils.js');

function fetchRequestCanBeRetried(error) {
	if (!error) return false;

	// Unfortunately the error 'Network request failed' doesn't have a type
	// or error code, so hopefully that message won't change and is not localized
	if (error.message == 'Network request failed') return true;

	// request to https://public-ch3302....1fab24cb1bd5f.md failed, reason: socket hang up"
	if (error.code == 'ECONNRESET') return true;

	// OneDrive (or Node?) sometimes sends back a "not found" error for resources
	// that definitely exist and in this case repeating the request works.
	// Error is:
	// request to https://graph.microsoft.com/v1.0/drive/special/approot failed, reason: getaddrinfo ENOTFOUND graph.microsoft.com graph.microsoft.com:443		
	if (error.code == 'ENOTFOUND') return true;

	// network timeout at: https://public-ch3302...859f9b0e3ab.md
	if (error.message && error.message.indexOf('network timeout') === 0) return true;

	// name: 'FetchError',
	// message: 'request to https://api.ipify.org/?format=json failed, reason: getaddrinfo EAI_AGAIN api.ipify.org:443',
	// type: 'system',
	// errno: 'EAI_AGAIN',
	// code: 'EAI_AGAIN' } } reason: { FetchError: request to https://api.ipify.org/?format=json failed, reason: getaddrinfo EAI_AGAIN api.ipify.org:443
	//
	// It's a Microsoft error: "A temporary failure in name resolution occurred."
	if (error.code == 'EAI_AGAIN') return true;

	return false;
}

function shimInit() {
	shim.fs = fs;
	shim.FileApiDriverLocal = FileApiDriverLocal;
	shim.Geolocation = GeolocationNode;
	shim.FormData = require('form-data');

	const nodeFetch = require('node-fetch');

	shim.fetch = async function(url, options = null) {
		if (!options) options = {};
		if (!options.timeout) options.timeout = 1000 * 120; // ms
		if (!('maxRetry' in options)) options.maxRetry = 5;

		let retryCount = 0;
		while (true) {
			try {
				const response = await nodeFetch(url, options);
				return response;
			} catch (error) {
				if (fetchRequestCanBeRetried(error)) {
					retryCount++;
					if (retryCount > options.maxRetry) throw error;
					await time.sleep(retryCount * 3);
				} else {
					throw error;
				}
			}
		}
	}
	
	shim.fetchBlob = async function(url, options) {
		if (!options || !options.path) throw new Error('fetchBlob: target file path is missing');
		if (!options.method) options.method = 'GET';
		if (!('maxRetry' in options)) options.maxRetry = 5;

		const urlParse = require('url').parse;

		url = urlParse(url.trim());
		const http = url.protocol.toLowerCase() == 'http:' ? require('follow-redirects').http : require('follow-redirects').https;
		const headers = options.headers ? options.headers : {};
		const method = options.method ? options.method : 'GET';
		if (method != 'GET') throw new Error('Only GET is supported');
		const filePath = options.path;

		function makeResponse(response) {
			return {
				ok: response.statusCode < 400,
				path: filePath,
				text: () => { return response.statusMessage; },
				json: () => { return { message: response.statusCode + ': ' + response.statusMessage }; },
				status: response.statusCode,
				headers: response.headers,
			};
		}

		const requestOptions = {
			protocol: url.protocol,
			host: url.host,
			port: url.port,
			method: method,
			path: url.path + (url.query ? '?' + url.query : ''),
			headers: headers,
		};

		const doFetchOperation = async () => {
			return new Promise((resolve, reject) => {
				try {
					// Note: relative paths aren't supported
					const file = fs.createWriteStream(filePath);

					const request = http.get(requestOptions, function(response) {
						response.pipe(file);

						file.on('finish', function() {
							file.close(() => {
								resolve(makeResponse(response));
							});
						});
					})

					request.on('error', function(error) {
						fs.unlink(filePath);
						reject(error);
					});
				} catch(error) {
					fs.unlink(filePath);
					reject(error);
				}
			});
		};

		let retryCount = 0;
		while (true) {
			try {
				const response = await doFetchOperation();
				return response;
			} catch (error) {
				if (fetchRequestCanBeRetried(error)) {
					retryCount++;
					if (retryCount > options.maxRetry) throw error;
					await time.sleep(retryCount * 3);
				} else {
					throw error;
				}
			}
		}
	}
}

module.exports = { shimInit };