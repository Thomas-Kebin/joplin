const { netUtils } = require('lib/net-utils');
const urlParser = require("url");
const Setting = require('lib/models/Setting');
const { Logger } = require('lib/logger.js');
const randomClipperPort = require('lib/randomClipperPort');
const enableServerDestroy = require('server-destroy');
const Api = require('lib/services/rest/Api');
const ApiResponse = require('lib/services/rest/ApiResponse');
const multiparty = require('multiparty');

class ClipperServer {

	constructor() {
		this.logger_ = new Logger();
		this.startState_ = 'idle';
		this.server_ = null;
		this.port_ = null;
		this.api_ = new Api(() => {
			return Setting.value('api.token');
		});
	}

	static instance() {
		if (this.instance_) return this.instance_;
		this.instance_ = new ClipperServer();
		return this.instance_;
	}

	setLogger(l) {
		this.logger_ = l;
		this.api_.setLogger(l);
	}

	logger() {
		return this.logger_;
	}

	setDispatch(d) {
		this.dispatch_ = d;
	}

	dispatch(action) {
		if (!this.dispatch_) throw new Error('dispatch not set!');
		this.dispatch_(action);
	}

	setStartState(v) {
		if (this.startState_ === v) return;
		this.startState_ = v;
		this.dispatch({
			type: 'CLIPPER_SERVER_SET',
			startState: v,
		});
	}

	setPort(v) {
		if (this.port_ === v) return;
		this.port_ = v;
		this.dispatch({
			type: 'CLIPPER_SERVER_SET',
			port: v,
		});
	}

	async findAvailablePort() {
		const tcpPortUsed = require('tcp-port-used');

		let state = null;
		for (let i = 0; i < 10000; i++) {
			state = randomClipperPort(state, Setting.value('env'));
			const inUse = await tcpPortUsed.check(state.port);
			if (!inUse) return state.port;
		}

		throw new Error('All potential ports are in use or not available.')
	}

	async start() {
		this.setPort(null);

		this.setStartState('starting');

		try {
			const p = await this.findAvailablePort();
			this.setPort(p);
		} catch (error) {
			this.setStartState('idle');
			this.logger().error(error);
			return;
		}

		this.server_ = require('http').createServer();

		this.server_.on('request', async (request, response) => {

			const writeCorsHeaders = (code, contentType = "application/json", additionalHeaders = null) => {
				const headers = Object.assign({}, {
					"Content-Type": contentType,
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
					'Access-Control-Allow-Headers': 'X-Requested-With,content-type',
				}, additionalHeaders ? additionalHeaders : {});
				response.writeHead(code, headers);
			}

			const writeResponseJson = (code, object) => {
				writeCorsHeaders(code);
				response.write(JSON.stringify(object));
				response.end();
			}

			const writeResponseText = (code, text) => {
				writeCorsHeaders(code, 'text/plain');
				response.write(text);
				response.end();
			}

			const writeResponseInstance = (code, instance) => {
    			if (instance.type === 'attachment') {
    				const filename = instance.attachmentFilename ? instance.attachmentFilename : 'file';
    				writeCorsHeaders(code, instance.contentType ? instance.contentType : 'application/octet-stream', {
    					'Content-disposition': 'attachment; filename=' + filename,
    					'Content-Length': instance.body.length,
    				});
    				response.end(instance.body);
    			} else {
    				throw new Error('Not implemented');
    			}
			}

			const writeResponse = (code, response) => {
				if (response instanceof ApiResponse) {
        			writeResponseInstance(code, response);
				} else if (typeof response === 'string') {
					writeResponseText(code, response);
				} else {
					writeResponseJson(code, response);
				}
			}

			this.logger().info('Request: ' + request.method + ' ' + request.url);

			const url = urlParser.parse(request.url, true);

			const execRequest = async (request, body = '', files = []) => {
				try {
					const response = await this.api_.route(request.method, url.pathname, url.query, body, files);
					writeResponse(200, response);
				} catch (error) {
					this.logger().error(error);
					writeResponse(error.httpCode ? error.httpCode : 500, error.message);
				}
			}

			const contentType = request.headers['content-type'] ? request.headers['content-type'] : '';

			if (request.method === 'OPTIONS') {
				writeCorsHeaders(200);
				response.end();
			} else {
				if (contentType.indexOf('multipart/form-data') === 0) {
				    const form = new multiparty.Form();

				    form.parse(request, function(error, fields, files) {
				    	if (error) {
							writeResponse(error.httpCode ? error.httpCode : 500, error.message);
							return;
						} else {
							execRequest(
								request,
								fields && fields.props && fields.props.length ? fields.props[0] : '',
								files && files.data ? files.data : []
							);
						}
				    });
				} else {
					if (request.method === 'POST' || request.method === 'PUT') {
						let body = '';

						request.on('data', (data) => {
							body += data;
						});

						request.on('end', async () => {
							execRequest(request, body);
						});
					} else {
						execRequest(request);
					}
				}
			}
		});

		enableServerDestroy(this.server_);

		this.logger().info('Starting Clipper server on port ' + this.port_);

		this.server_.listen(this.port_, '127.0.0.1');

		this.setStartState('started');
	}

	async stop() {
		this.server_.destroy();
		this.server_ = null;
		this.setStartState('idle');
		this.setPort(null);
	}

}

module.exports = ClipperServer;