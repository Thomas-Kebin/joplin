import shim from '@joplin/lib/shim';
import Setting from '@joplin/lib/models/Setting';
import Note from '@joplin/lib/models/Note';
import BaseModel from '@joplin/lib/BaseModel';
import Resource from '@joplin/lib/models/Resource';
const bridge = require('electron').remote.require('./bridge').default;
import ResourceFetcher from '@joplin/lib/services/ResourceFetcher';
import htmlUtils from '@joplin/lib/htmlUtils';
import Logger from '@joplin/lib/Logger';
const joplinRendererUtils = require('@joplin/renderer').utils;
const { clipboard } = require('electron');
const mimeUtils = require('@joplin/lib/mime-utils.js').mime;
const md5 = require('md5');
const path = require('path');
const uri2path = require('file-uri-to-path');

const logger = Logger.create('resourceHandling');

export async function handleResourceDownloadMode(noteBody: string) {
	if (noteBody && Setting.value('sync.resourceDownloadMode') === 'auto') {
		const resourceIds = await Note.linkedResourceIds(noteBody);
		await ResourceFetcher.instance().markForDownload(resourceIds);
	}
}

let resourceCache_: any = {};

export function clearResourceCache() {
	resourceCache_ = {};
}

export async function attachedResources(noteBody: string): Promise<any> {
	if (!noteBody) return {};
	const resourceIds = await Note.linkedItemIdsByType(BaseModel.TYPE_RESOURCE, noteBody);

	const output: any = {};
	for (let i = 0; i < resourceIds.length; i++) {
		const id = resourceIds[i];

		if (resourceCache_[id]) {
			output[id] = resourceCache_[id];
		} else {
			const resource = await Resource.load(id);
			const localState = await Resource.localState(resource);

			const o = {
				item: resource,
				localState: localState,
			};

			// eslint-disable-next-line require-atomic-updates
			resourceCache_[id] = o;
			output[id] = o;
		}
	}

	return output;
}

export async function commandAttachFileToBody(body: string, filePaths: string[] = null, options: any = null) {
	options = {
		createFileURL: false,
		position: 0,
		...options,
	};

	if (!filePaths) {
		filePaths = bridge().showOpenDialog({
			properties: ['openFile', 'createDirectory', 'multiSelections'],
		});
		if (!filePaths || !filePaths.length) return null;
	}

	for (let i = 0; i < filePaths.length; i++) {
		const filePath = filePaths[i];
		try {
			logger.info(`Attaching ${filePath}`);
			const newBody = await shim.attachFileToNoteBody(body, filePath, options.position, {
				createFileURL: options.createFileURL,
				resizeLargeImages: 'ask',
			});

			if (!newBody) {
				logger.info('File attachment was cancelled');
				return null;
			}

			body = newBody;
			logger.info('File was attached.');
		} catch (error) {
			logger.error(error);
			bridge().showErrorMessageBox(error.message);
		}
	}

	return body;
}

export function resourcesStatus(resourceInfos: any) {
	let lowestIndex = joplinRendererUtils.resourceStatusIndex('ready');
	for (const id in resourceInfos) {
		const s = joplinRendererUtils.resourceStatus(Resource, resourceInfos[id]);
		const idx = joplinRendererUtils.resourceStatusIndex(s);
		if (idx < lowestIndex) lowestIndex = idx;
	}
	return joplinRendererUtils.resourceStatusName(lowestIndex);
}

export async function handlePasteEvent(event: any) {
	const output = [];
	const formats = clipboard.availableFormats();
	for (let i = 0; i < formats.length; i++) {
		const format = formats[i].toLowerCase();
		const formatType = format.split('/')[0];

		if (formatType === 'image') {
			if (event) event.preventDefault();

			const image = clipboard.readImage();

			const fileExt = mimeUtils.toFileExtension(format);
			const filePath = `${Setting.value('tempDir')}/${md5(Date.now())}.${fileExt}`;

			await shim.writeImageToFile(image, format, filePath);
			const md = await commandAttachFileToBody('', [filePath]);
			await shim.fsDriver().remove(filePath);

			if (md) output.push(md);
		}
	}
	return output;
}

export async function processPastedHtml(html: string) {
	const allImageUrls: string[] = [];
	const mappedResources: Record<string, string> = {};

	htmlUtils.replaceImageUrls(html, (src: string) => {
		allImageUrls.push(src);
	});

	for (const imageSrc of allImageUrls) {
		if (!mappedResources[imageSrc]) {
			try {
				if (imageSrc.startsWith('file')) {
					const imageFilePath = path.normalize(uri2path(imageSrc));
					const resourceDirPath = path.normalize(Setting.value('resourceDir'));

					if (imageFilePath.startsWith(resourceDirPath)) {
						mappedResources[imageSrc] = imageSrc;
					} else {
						const createdResource = await shim.createResourceFromPath(imageFilePath);
						mappedResources[imageSrc] = `file://${encodeURI(Resource.fullPath(createdResource))}`;
					}
				} else {
					const filePath = `${Setting.value('tempDir')}/${md5(Date.now() + Math.random())}`;
					await shim.fetchBlob(imageSrc, { path: filePath });
					const createdResource = await shim.createResourceFromPath(filePath);
					await shim.fsDriver().remove(filePath);
					mappedResources[imageSrc] = `file://${encodeURI(Resource.fullPath(createdResource))}`;
				}
			} catch (error) {
				logger.warn(`Error creating a resource for ${imageSrc}.`, error);
				mappedResources[imageSrc] = imageSrc;
			}
		}
	}

	return htmlUtils.replaceImageUrls(html, (src: string) => {
		return mappedResources[src];
	});
}
