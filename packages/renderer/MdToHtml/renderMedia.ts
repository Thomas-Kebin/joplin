import { Link } from '../MdToHtml';
import { toForwardSlashes } from '../pathUtils';
const Entities = require('html-entities').AllHtmlEntities;
const htmlentities = new Entities().encode;

export interface Options {
	audioPlayerEnabled: boolean;
	videoPlayerEnabled: boolean;
	pdfViewerEnabled: boolean;
}

export default function(link: Link, options: Options) {
	const resource = link.resource;

	if (!link.resourceReady || !resource || !resource.mime) return '';

	const escapedResourcePath = htmlentities(`file://${toForwardSlashes(link.resourceFullPath)}`);
	const escapedMime = htmlentities(resource.mime);

	if (options.videoPlayerEnabled && resource.mime.indexOf('video/') === 0) {
		return `
			<video class="media-player media-video" controls>
				<source src="${escapedResourcePath}" type="${escapedMime}">
			</video>
		`;
	}

	if (options.audioPlayerEnabled && resource.mime.indexOf('audio/') === 0) {
		return `
			<audio class="media-player media-audio" controls>
				<source src="${escapedResourcePath}" type="${escapedMime}">
			</audio>
		`;
	}

	if (options.pdfViewerEnabled && resource.mime === 'application/pdf') {
		return `<object data="${escapedResourcePath}" class="media-player media-pdf" type="${escapedMime}"></object>`;
	}

	return '';
}
