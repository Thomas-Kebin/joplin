const { ltrimSlashes } = require('lib/path-utils.js');
const Folder = require('lib/models/Folder');
const Note = require('lib/models/Note');
const Tag = require('lib/models/Tag');
const BaseItem = require('lib/models/BaseItem');
const BaseModel = require('lib/BaseModel');
const Setting = require('lib/models/Setting');
const markdownUtils = require('lib/markdownUtils');
const mimeUtils = require('lib/mime-utils.js').mime;
const { Logger } = require('lib/logger.js');
const md5 = require('md5');
const { shim } = require('lib/shim');
const HtmlToMd = require('lib/HtmlToMd');
const { fileExtension, safeFileExtension, safeFilename, filename } = require('lib/path-utils');
const ApiResponse = require('lib/services/rest/ApiResponse');

class ApiError extends Error {

	constructor(message, httpCode = 400) {
		super(message);
		this.httpCode_ = httpCode;
	}

	get httpCode() {
		return this.httpCode_;
	}

}

class ErrorMethodNotAllowed extends ApiError { constructor(message = 'Method Not Allowed') { super(message, 405); } }
class ErrorNotFound extends ApiError { constructor(message = 'Not Found') { super(message, 404); } }
class ErrorForbidden extends ApiError {	constructor(message = 'Forbidden') { super(message, 403); } }
class ErrorBadRequest extends ApiError { constructor(message = 'Bad Request') { super(message, 400); } }

class Api {

	constructor(token = null) {
		this.token_ = token;
		this.logger_ = new Logger();
	}

	get token() {
		return typeof this.token_ === 'function' ? this.token_() : this.token_;
	}

	parsePath(path) {
		path = ltrimSlashes(path);
		if (!path) return { callName: '', params: [] };

		const pathParts = path.split('/');
		const callSuffix = pathParts.splice(0,1)[0];
		let callName = 'action_' + callSuffix;
		return {
			callName: callName,
			params: pathParts,
		};
	}

	async route(method, path, query = null, body = null, files = null) {
		if (!files) files = [];

		const parsedPath = this.parsePath(path);
		if (!parsedPath.callName) throw new ErrorNotFound(); // Nothing at the root yet
		
		const request = {
			method: method,
			path: ltrimSlashes(path),
			query: query ? query : {},
			body: body,
			bodyJson_: null,
			bodyJson: function(disallowedProperties = null) {
				if (!this.bodyJson_) this.bodyJson_ = JSON.parse(this.body);

				if (disallowedProperties) {
					const filteredBody = Object.assign({}, this.bodyJson_);
					for (let i = 0; i < disallowedProperties.length; i++) {
						const n = disallowedProperties[i];
						delete filteredBody[n];
					}
					return filteredBody;
				}

				return this.bodyJson_;
			},
			files: files,
		}

		let id = null;
		let link = null;
		let params = parsedPath.params;

		if (params.length >= 1) {
			id = params[0];
			params.splice(0, 1);
			if (params.length >= 1) {
				link = params[0];
				params.splice(0, 1);
			}
		}

		request.params = params;

		if (!this[parsedPath.callName]) throw new ErrorNotFound();

		try {
			return this[parsedPath.callName](request, id, link);
		} catch (error) {
			if (!error.httpCode) error.httpCode = 500;
			throw error;
		}
	}

	setLogger(l) {
		this.logger_ = l;
	}

	logger() {
		return this.logger_;
	}

	get readonlyProperties() {
		return ['id', 'created_time', 'updated_time', 'encryption_blob_encrypted', 'encryption_applied', 'encryption_cipher_text'];
	}

	fields_(request, defaultFields) {
		const query = request.query;
		if (!query || !query.fields) return defaultFields;
		const fields = query.fields.split(',').map(f => f.trim()).filter(f => !!f);
		return fields.length ? fields : defaultFields;
	}

	checkToken_(request) {
		// For now, whitelist some calls to allow the web clipper to work
		// without an extra auth step
		const whiteList = [
			[ 'GET', 'ping' ],
			[ 'GET', 'tags' ],
			[ 'GET', 'folders' ],
			[ 'POST', 'notes' ],
		];

		for (let i = 0; i < whiteList.length; i++) {
			if (whiteList[i][0] === request.method && whiteList[i][1] === request.path) return;
		}

		if (!this.token) return;
		if (!request.query || !request.query.token) throw new ErrorForbidden('Missing "token" parameter');
		if (request.query.token !== this.token) throw new ErrorForbidden('Invalid "token" parameter');
	}

	async defaultAction_(modelType, request, id = null, link = null) {
		this.checkToken_(request);

		if (link) throw new ErrorNotFound(); // Default action doesn't support links at all for now

		const ModelClass = BaseItem.getClassByItemType(modelType);

		const getOneModel = async () => {
			const model = await ModelClass.load(id);
			if (!model) throw new ErrorNotFound();			
			return model;
		}

		if (request.method === 'GET') {
			if (id) {
				return getOneModel();
			} else {
				const options = {};
				const fields = this.fields_(request, []);
				if (fields.length) options.fields = fields;
				return await ModelClass.all(options);
			}
		}

		if (request.method === 'PUT' && id) {
			const model = await getOneModel();
			let newModel = Object.assign({}, model, request.bodyJson(this.readonlyProperties));
			newModel = await ModelClass.save(newModel, { userSideValidation: true });
			return newModel;
		}

		if (request.method === 'DELETE' && id) {
			const model = await getOneModel();
			await ModelClass.delete(model.id);
			return;
		}

		if (request.method === 'POST') {
			const model = request.bodyJson(this.readonlyProperties);
			const result = await ModelClass.save(model, { userSideValidation: true });
			return result;
		}

		throw new ErrorMethodNotAllowed();
	}

	async action_ping(request, id = null, link = null) {
		if (request.method === 'GET') {
			return 'JoplinClipperServer';
		}

		throw new ErrorMethodNotAllowed();
	}

	async action_folders(request, id = null, link = null) {
		if (request.method === 'GET' && !id) {
			return await Folder.allAsTree({ fields: this.fields_(request, ['id', 'parent_id', 'title']) });
		}

		if (request.method === 'GET' && id) {
			if (link && link === 'notes') {
				const options = this.notePreviewsOptions_(request);
				return Note.previews(id, options);
			} else if (link) {
				throw new ErrorNotFound();
			}
		}

		return this.defaultAction_(BaseModel.TYPE_FOLDER, request, id, link);
	}

	async action_tags(request, id = null, link = null) {
		if (link === 'notes') {
			const tag = await Tag.load(id);
			if (!tag) throw new ErrorNotFound();

			if (request.method === 'POST') {
				const note = request.bodyJson();
				if (!note || !note.id) throw new ErrorBadRequest('Missing note ID');
				return await Tag.addNote(tag.id, note.id);
			}

			if (request.method === 'DELETE') {
				const noteId = request.params.length ? request.params[0] : null;
				if (!noteId) throw new ErrorBadRequest('Missing note ID');
				await Tag.removeNote(tag.id, noteId);
				return;
			}

			if (request.method === 'GET') {
				// Ideally we should get all this in one SQL query but for now that will do
				const noteIds = await Tag.noteIds(tag.id);
				const output = [];
				for (let i = 0; i < noteIds.length; i++) {
					const n = await Note.preview(noteIds[i], this.notePreviewsOptions_(request));
					if (!n) continue;
					output.push(n);
				}
				return output;
			}
		}

		return this.defaultAction_(BaseModel.TYPE_TAG, request, id, link);
	}

	async action_master_keys(request, id = null, link = null) {
		return this.defaultAction_(BaseModel.TYPE_MASTER_KEY, request, id, link);
	}

	async action_resources(request, id = null, link = null) {
		// fieldName: "data"
		// headers: Object
		// originalFilename: "test.jpg"
		// path: "C:\Users\Laurent\AppData\Local\Temp\BW77wkpP23iIGUstd0kDuXXC.jpg"
		// size: 164394

		if (request.method === 'GET') {
			if (link !== 'file') throw new ErrorNotFound();

			const resource = await Resource.load(id);
			if (!resource) throw new ErrorNotFound();

			const filePath = Resource.fullPath(resource);
			const buffer = await shim.fsDriver().readFile(filePath, 'Buffer');
			
			const response = new ApiResponse();
			response.type = 'attachment';
			response.body = buffer;
			response.contentType = resource.mime;
			response.attachmentFilename = Resource.friendlyFilename(resource);
			return response;
		}

		if (request.method === 'POST') {
			if (!request.files.length) throw new ErrorBadRequest('Resource cannot be created without a file');
			const filePath = request.files[0].path;
			const resource = await shim.createResourceFromPath(filePath);
			const newResource = Object.assign({}, resource, request.bodyJson(this.readonlyProperties));
			return await Resource.save(newResource);
		}

		return this.defaultAction_(BaseModel.TYPE_RESOURCE, request, id, link);
	}

	notePreviewsOptions_(request) {
		const fields = this.fields_(request, []); // previews() already returns default fields
		const options = {};
		if (fields.length) options.fields = fields;
		return options;
	}

	async action_notes(request, id = null, link = null) {
		this.checkToken_(request);
		
		if (request.method === 'GET') {
			
			if (link && link === 'tags') {
				return Tag.tagsByNoteId(id);
			} else if (link) {
				throw new ErrorNotFound();
			}

			const options = this.notePreviewsOptions_(request);
			if (id) {
				return await Note.preview(id, options);
			} else {
				return await Note.previews(null, options);
			}
		}

		if (request.method === 'POST') {
			const requestId = Date.now();
			const requestNote = JSON.parse(request.body);
			let note = await this.requestNoteToNote(requestNote);

			const imageUrls = markdownUtils.extractImageUrls(note.body);

			this.logger().info('Request (' + requestId + '): Downloading images: ' + imageUrls.length);

			let result = await this.downloadImages_(imageUrls);

			this.logger().info('Request (' + requestId + '): Creating resources from paths: ' + Object.getOwnPropertyNames(result).length);

			result = await this.createResourcesFromPaths_(result);
			await this.removeTempFiles_(result);
			note.body = this.replaceImageUrlsByResources_(note.body, result);

			this.logger().info('Request (' + requestId + '): Saving note...');

			note = await Note.save(note);

			if (requestNote.tags) {
				const tagTitles = requestNote.tags.split(',');
				await Tag.setNoteTagsByTitles(note.id, tagTitles);
			}

			if (requestNote.image_data_url) {
				note = await this.attachImageFromDataUrl_(note, requestNote.image_data_url, requestNote.crop_rect);
			}

			this.logger().info('Request (' + requestId + '): Created note ' + note.id);

			return note;
		}

		return this.defaultAction_(BaseModel.TYPE_NOTE, request, id, link);
	}





	// ========================================================================================================================
	// UTILIY FUNCTIONS
	// ========================================================================================================================

	htmlToMdParser() {
		if (this.htmlToMdParser_) return this.htmlToMdParser_;
		this.htmlToMdParser_ = new HtmlToMd();
		return this.htmlToMdParser_;
	}

	async requestNoteToNote(requestNote) {
		const output = {
			title: requestNote.title ? requestNote.title : '',
			body: requestNote.body ? requestNote.body : '',
		};

		if (requestNote.body_html) {
			// Parsing will not work if the HTML is not wrapped in a top level tag, which is not guaranteed
			// when getting the content from elsewhere. So here wrap it - it won't change anything to the final
			// rendering but it makes sure everything will be parsed.
			output.body = await this.htmlToMdParser().parse('<div>' + requestNote.body_html + '</div>', {
				baseUrl: requestNote.base_url ? requestNote.base_url : '',
			});
		}

		if (requestNote.parent_id) {
			output.parent_id = requestNote.parent_id;
		} else {
			const folder = await Folder.defaultFolder();
			if (!folder) throw new Error('Cannot find folder for note');
			output.parent_id = folder.id;
		}

		if (requestNote.source_url) output.source_url = requestNote.source_url;
		if (requestNote.author) output.author = requestNote.author;

		return output;
	}

	// Note must have been saved first
	async attachImageFromDataUrl_(note, imageDataUrl, cropRect) {
		const tempDir = Setting.value('tempDir');
		const mime = mimeUtils.fromDataUrl(imageDataUrl);
		let ext = mimeUtils.toFileExtension(mime) || '';
		if (ext) ext = '.' + ext;
		const tempFilePath = tempDir + '/' + md5(Math.random() + '_' + Date.now()) + ext;
		const imageConvOptions = {};
		if (cropRect) imageConvOptions.cropRect = cropRect;
		await shim.imageFromDataUrl(imageDataUrl, tempFilePath, imageConvOptions);
		return await shim.attachFileToNote(note, tempFilePath);
	}

	async downloadImage_(url) {
		const tempDir = Setting.value('tempDir');

		const isDataUrl = url && url.toLowerCase().indexOf('data:') === 0;

		const name = isDataUrl ? md5(Math.random() + '_' + Date.now()) : filename(url);
		let fileExt = isDataUrl ? mimeUtils.toFileExtension(mimeUtils.fromDataUrl(url)) : safeFileExtension(fileExtension(url).toLowerCase());
		if (fileExt) fileExt = '.' + fileExt;
		let imagePath = tempDir + '/' + safeFilename(name) + fileExt;
		if (await shim.fsDriver().exists(imagePath)) imagePath = tempDir + '/' + safeFilename(name) + '_' + md5(Math.random() + '_' + Date.now()).substr(0,10) + fileExt;

		try {
			if (isDataUrl) {
				await shim.imageFromDataUrl(url, imagePath);
			} else {
				await shim.fetchBlob(url, { path: imagePath });
			}
			return imagePath;
		} catch (error) {
			this.logger().warn('Cannot download image at ' + url, error);
			return '';
		}
	}

	async downloadImages_(urls) {
		const PromisePool = require('es6-promise-pool')

		const output = {};

		let urlIndex = 0;
		const promiseProducer = () => {
			if (urlIndex >= urls.length) return null;

			const url = urls[urlIndex++];

			return new Promise(async (resolve, reject) => {
				const imagePath = await this.downloadImage_(url);
				if (imagePath) output[url] = { path: imagePath };
				resolve();
			});
		}

		const concurrency = 3
		const pool = new PromisePool(promiseProducer, concurrency)
		await pool.start()

		return output;
	}

	async createResourcesFromPaths_(urls) {
		for (let url in urls) {
			if (!urls.hasOwnProperty(url)) continue;
			const urlInfo = urls[url];
			try {
				const resource = await shim.createResourceFromPath(urlInfo.path);
				urlInfo.resource = resource;
			} catch (error) {
				this.logger().warn('Cannot create resource for ' + url, error);
			}
		}
		return urls;
	}

	async removeTempFiles_(urls) {
		for (let url in urls) {
			if (!urls.hasOwnProperty(url)) continue;
			const urlInfo = urls[url];
			try {
				await shim.fsDriver().remove(urlInfo.path);
			} catch (error) {
				this.logger().warn('Cannot remove ' + urlInfo.path, error);
			}
		}
	}

	replaceImageUrlsByResources_(md, urls) {
		let output = md.replace(/(!\[.*?\]\()([^\s\)]+)(.*?\))/g, (match, before, imageUrl, after) => {
			const urlInfo = urls[imageUrl];
			if (!urlInfo || !urlInfo.resource) return before + imageUrl + after;
			const resourceUrl = Resource.internalUrl(urlInfo.resource);
			return before + resourceUrl + after;
		});

		return output;
	}


}

module.exports = Api;