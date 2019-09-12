const { rtrimSlashes } = require('lib/path-utils');
const { urlDecode } = require('lib/string-utils');

const urlUtils = {};

urlUtils.hash = function(url) {
	const s = url.split('#');
	if (s.length <= 1) return '';
	return s[s.length - 1];
};

urlUtils.urlWithoutPath = function(url) {
	const parsed = require('url').parse(url, true);
	return parsed.protocol + '//' + parsed.host;
};

urlUtils.urlProtocol = function(url) {
	if (!url) return '';
	const parsed = require('url').parse(url, true);
	return parsed.protocol;
};

urlUtils.prependBaseUrl = function(url, baseUrl) {
	baseUrl = rtrimSlashes(baseUrl).trim(); // All the code below assumes that the baseUrl does not end up with a slash
	url = url.trim();

	if (!url) url = '';
	if (!baseUrl) return url;
	if (url.indexOf('#') === 0) return url; // Don't prepend if it's a local anchor
	if (urlUtils.urlProtocol(url)) return url; // Don't prepend the base URL if the URL already has a scheme

	if (url.length >= 2 && url.indexOf('//') === 0) {
		// If it starts with // it's a protcol-relative URL
		return urlUtils.urlProtocol(baseUrl) + url;
	} else if (url && url[0] === '/') {
		// If it starts with a slash, it's an absolute URL so it should be relative to the domain (and not to the full baseUrl)
		return urlUtils.urlWithoutPath(baseUrl) + url;
	} else {
		return baseUrl + (url ? '/' + url : '');
	}
};

urlUtils.isResourceUrl = function(url) {
	return !!url.match(/^(joplin:\/\/|:\/)[0-9a-zA-Z]{32}(|#.*)$/);
};

urlUtils.parseResourceUrl = function(url) {
	if (!urlUtils.isResourceUrl(url)) return null;

	const filename = url.split('/').pop();
	const splitted = filename.split('#');

	const output = {
		itemId: '',
		hash: '',
	};

	if (splitted.length) output.itemId = splitted[0];

	// In general we want the hash to be decoded so that non-alphabetical languages
	// appear as-is without being encoded with %.
	// Fixes https://github.com/laurent22/joplin/issues/1870
	if (splitted.length >= 2) output.hash = urlDecode(splitted[1]);

	return output;
};

module.exports = urlUtils;
