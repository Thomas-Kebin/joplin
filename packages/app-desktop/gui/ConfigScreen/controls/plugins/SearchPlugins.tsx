import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import SearchInput, { OnChangeEvent } from '../../../lib/SearchInput/SearchInput';
import styled from 'styled-components';
import RepositoryApi from '@joplin/lib/services/plugins/RepositoryApi';
import AsyncActionQueue from '@joplin/lib/AsyncActionQueue';
import { PluginManifest } from '@joplin/lib/services/plugins/utils/types';
import PluginBox, { InstallState } from './PluginBox';
import Setting from '@joplin/lib/models/Setting';
import { PluginSettings } from '@joplin/lib/services/plugins/PluginService';
import { _ } from '@joplin/lib/locale';
import useOnInstallHandler from './useOnInstallHandler';

const Root = styled.div`
`;

const ResultsRoot = styled.div`
	display: flex;
	flex-wrap: wrap;
`;

interface Props {
	themeId: number;
	searchQuery: string;
	onSearchQueryChange(event: OnChangeEvent): void;
	pluginSettings: PluginSettings;
	onPluginSettingsChange(event: any): void;
	renderDescription: Function;
	maxWidth: number;
}

let repoApi_: RepositoryApi = null;

function repoApi(): RepositoryApi {
	if (repoApi_) return repoApi_;
	repoApi_ = new RepositoryApi('https://github.com/joplin/plugins', Setting.value('tempDir'));
	return repoApi_;
}

export default function(props: Props) {
	const [searchStarted, setSearchStarted] = useState(false);
	const [manifests, setManifests] = useState<PluginManifest[]>([]);
	const asyncSearchQueue = useRef(new AsyncActionQueue(200));
	const [installingPluginsIds, setInstallingPluginIds] = useState<Record<string, boolean>>({});
	const [searchResultCount, setSearchResultCount] = useState(null);

	const onInstall = useOnInstallHandler(setInstallingPluginIds, props.pluginSettings, repoApi, props.onPluginSettingsChange);

	useEffect(() => {
		setSearchResultCount(null);
		asyncSearchQueue.current.push(async () => {
			if (!props.searchQuery) {
				setManifests([]);
				setSearchResultCount(null);
			} else {
				const r = await repoApi().search(props.searchQuery);
				setManifests(r);
				setSearchResultCount(r.length);
			}
		});
	}, [props.searchQuery]);

	const onChange = useCallback((event: OnChangeEvent) => {
		setSearchStarted(true);
		props.onSearchQueryChange(event);
	}, [props.onSearchQueryChange]);

	const onSearchButtonClick = useCallback(() => {
		setSearchStarted(false);
		props.onSearchQueryChange({ value: '' });
	}, []);

	function installState(pluginId: string): InstallState {
		const settings = props.pluginSettings[pluginId];
		if (settings && !settings.deleted) return InstallState.Installed;
		if (installingPluginsIds[pluginId]) return InstallState.Installing;
		return InstallState.NotInstalled;
	}

	function renderResults(query: string, manifests: PluginManifest[]) {
		if (query && !manifests.length) {
			if (searchResultCount === null) return ''; // Search in progress
			return props.renderDescription(props.themeId, _('No results'));
		} else {
			const output = [];

			for (const manifest of manifests) {
				output.push(<PluginBox
					key={manifest.id}
					manifest={manifest}
					themeId={props.themeId}
					onInstall={onInstall}
					installState={installState(manifest.id)}
				/>);
			}

			return output;
		}
	}

	return (
		<Root>
			<div style={{ marginBottom: 10, width: props.maxWidth }}>
				<SearchInput
					inputRef={null}
					value={props.searchQuery}
					onChange={onChange}
					onSearchButtonClick={onSearchButtonClick}
					searchStarted={searchStarted}
				/>
			</div>

			<ResultsRoot>
				{renderResults(props.searchQuery, manifests)}
			</ResultsRoot>
		</Root>
	);
}
