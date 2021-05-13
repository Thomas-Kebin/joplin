import { useCallback } from 'react';
import { FormNote } from './types';
import contextMenu, { openItemById } from './contextMenu';
import { _ } from '@joplin/lib/locale';
import CommandService from '@joplin/lib/services/CommandService';
import PostMessageService from '@joplin/lib/services/PostMessageService';
const bridge = require('electron').remote.require('./bridge').default;
const { urlDecode } = require('@joplin/lib/string-utils');
const urlUtils = require('@joplin/lib/urlUtils');
import ResourceFetcher from '@joplin/lib/services/ResourceFetcher';
import { reg } from '@joplin/lib/registry';

export default function useMessageHandler(scrollWhenReady: any, setScrollWhenReady: Function, editorRef: any, setLocalSearchResultCount: Function, dispatch: Function, formNote: FormNote) {
	return useCallback(async (event: any) => {
		const msg = event.channel ? event.channel : '';
		const args = event.args;
		const arg0 = args && args.length >= 1 ? args[0] : null;

		// if (msg !== 'percentScroll') console.info(`Got ipc-message: ${msg}`, arg0);

		if (msg.indexOf('error:') === 0) {
			const s = msg.split(':');
			s.splice(0, 1);
			reg.logger().error(s.join(':'));
		} else if (msg === 'noteRenderComplete') {
			if (scrollWhenReady) {
				const options = { ...scrollWhenReady };
				setScrollWhenReady(null);
				editorRef.current.scrollTo(options);
			}
		} else if (msg === 'setMarkerCount') {
			setLocalSearchResultCount(arg0);
		} else if (msg.indexOf('markForDownload:') === 0) {
			const s = msg.split(':');
			if (s.length < 2) throw new Error(`Invalid message: ${msg}`);
			void ResourceFetcher.instance().markForDownload(s[1]);
		} else if (msg === 'contextMenu') {
			const menu = await contextMenu({
				itemType: arg0 && arg0.type,
				resourceId: arg0.resourceId,
				textToCopy: arg0.textToCopy,
				linkToCopy: arg0.linkToCopy || null,
				htmlToCopy: '',
				insertContent: () => { console.warn('insertContent() not implemented'); },
			}, dispatch);

			menu.popup(bridge().window());
		} else if (msg.indexOf('joplin://') === 0) {
			const { itemId, hash } = urlUtils.parseResourceUrl(msg);
			await openItemById(itemId, dispatch, hash);

		} else if (urlUtils.urlProtocol(msg)) {
			if (msg.indexOf('file://') === 0) {
				// When using the file:// protocol, openPath doesn't work (does nothing) with URL-encoded paths
				require('electron').shell.openPath(urlDecode(msg));
			} else {
				require('electron').shell.openExternal(msg);
			}
		} else if (msg.indexOf('#') === 0) {
			// This is an internal anchor, which is handled by the WebView so skip this case
		} else if (msg === 'contentScriptExecuteCommand') {
			const commandName = arg0.name;
			const commandArgs = arg0.args || [];
			void CommandService.instance().execute(commandName, ...commandArgs);
		} else if (msg === 'postMessageService.message') {
			void PostMessageService.instance().postMessage(arg0);
		} else {
			bridge().showErrorMessageBox(_('Unsupported link or message: %s', msg));
		}
	}, [dispatch, setLocalSearchResultCount, scrollWhenReady, formNote]);
}
