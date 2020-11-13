import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import TinyMCE from './NoteBody/TinyMCE/TinyMCE';
import CodeMirror  from './NoteBody/CodeMirror/CodeMirror';
import { connect } from 'react-redux';
import MultiNoteActions from '../MultiNoteActions';
import { htmlToMarkdown, formNoteToNote } from './utils';
import useSearchMarkers from './utils/useSearchMarkers';
import useNoteSearchBar from './utils/useNoteSearchBar';
import useMessageHandler from './utils/useMessageHandler';
import useWindowCommandHandler from './utils/useWindowCommandHandler';
import useDropHandler from './utils/useDropHandler';
import useMarkupToHtml from './utils/useMarkupToHtml';
import useFormNote, { OnLoadEvent } from './utils/useFormNote';
import useFolder from './utils/useFolder';
import styles_ from './styles';
import { NoteEditorProps, FormNote, ScrollOptions, ScrollOptionTypes, OnChangeEvent, NoteBodyEditorProps } from './utils/types';
import ResourceEditWatcher from '@joplin/lib/services/ResourceEditWatcher/index';
import CommandService from '@joplin/lib/services/CommandService';
import ToolbarButton from '../ToolbarButton/ToolbarButton';
import Button, { ButtonLevel } from '../Button/Button';
import eventManager from '@joplin/lib/eventManager';
import { AppState } from '../../app';
import ToolbarButtonUtils from '@joplin/lib/services/commands/ToolbarButtonUtils';
import { _ } from '@joplin/lib/locale';
import stateToWhenClauseContext from '@joplin/lib/services/commands/stateToWhenClauseContext';
import TagList from '../TagList';
import NoteTitleBar from './NoteTitle/NoteTitleBar';
import markupLanguageUtils from '@joplin/lib/markupLanguageUtils';
import usePrevious from '../hooks/usePrevious';
import Setting from '@joplin/lib/models/Setting';

const { themeStyle } = require('@joplin/lib/theme');
const { substrWithEllipsis } = require('@joplin/lib/string-utils');
const NoteSearchBar = require('../NoteSearchBar.min.js');
const { reg } = require('@joplin/lib/registry.js');
const Note = require('@joplin/lib/models/Note.js');
const bridge = require('electron').remote.require('./bridge').default;
const ExternalEditWatcher = require('@joplin/lib/services/ExternalEditWatcher');
const NoteRevisionViewer = require('../NoteRevisionViewer.min');

const commands = [
	require('./commands/showRevisions'),
];

const toolbarButtonUtils = new ToolbarButtonUtils(CommandService.instance());

function NoteEditor(props: NoteEditorProps) {
	const [showRevisions, setShowRevisions] = useState(false);
	const [titleHasBeenManuallyChanged, setTitleHasBeenManuallyChanged] = useState(false);
	const [scrollWhenReady, setScrollWhenReady] = useState<ScrollOptions>(null);

	const editorRef = useRef<any>();
	const titleInputRef = useRef<any>();
	const isMountedRef = useRef(true);
	const noteSearchBarRef = useRef(null);

	const formNote_beforeLoad = useCallback(async (event: OnLoadEvent) => {
		await saveNoteIfWillChange(event.formNote);
		setShowRevisions(false);
	}, []);

	const formNote_afterLoad = useCallback(async () => {
		setTitleHasBeenManuallyChanged(false);
	}, []);

	const { formNote, setFormNote, isNewNote, resourceInfos } = useFormNote({
		syncStarted: props.syncStarted,
		noteId: props.noteId,
		isProvisional: props.isProvisional,
		titleInputRef: titleInputRef,
		editorRef: editorRef,
		onBeforeLoad: formNote_beforeLoad,
		onAfterLoad: formNote_afterLoad,
	});

	const formNoteRef = useRef<FormNote>();
	formNoteRef.current = { ...formNote };

	const formNoteFolder = useFolder({ folderId: formNote.parent_id });

	const {
		localSearch,
		onChange: localSearch_change,
		onNext: localSearch_next,
		onPrevious: localSearch_previous,
		onClose: localSearch_close,
		setResultCount: setLocalSearchResultCount,
		showLocalSearch,
		setShowLocalSearch,
		searchMarkers: localSearchMarkerOptions,
	} = useNoteSearchBar();

	// If the note has been modified in another editor, wait for it to be saved
	// before loading it in this editor.
	// const waitingToSaveNote = props.noteId && formNote.id !== props.noteId && props.editorNoteStatuses[props.noteId] === 'saving';

	const styles = styles_(props);

	function scheduleSaveNote(formNote: FormNote) {
		if (!formNote.saveActionQueue) throw new Error('saveActionQueue is not set!!'); // Sanity check

		// reg.logger().debug('Scheduling...', formNote);

		const makeAction = (formNote: FormNote) => {
			return async function() {
				const note = await formNoteToNote(formNote);
				reg.logger().debug('Saving note...', note);
				const savedNote: any = await Note.save(note);

				setFormNote((prev: FormNote) => {
					return { ...prev, user_updated_time: savedNote.user_updated_time };
				});

				ExternalEditWatcher.instance().updateNoteFile(savedNote);

				props.dispatch({
					type: 'EDITOR_NOTE_STATUS_REMOVE',
					id: formNote.id,
				});

				eventManager.emit('noteContentChange', { note: savedNote });
			};
		};

		formNote.saveActionQueue.push(makeAction(formNote));
	}

	async function saveNoteIfWillChange(formNote: FormNote) {
		if (!formNote.id || !formNote.bodyWillChangeId) return;

		const body = await editorRef.current.content();

		scheduleSaveNote({
			...formNote,
			body: body,
			bodyWillChangeId: 0,
			bodyChangeId: 0,
		});
	}

	async function saveNoteAndWait(formNote: FormNote) {
		saveNoteIfWillChange(formNote);
		return formNote.saveActionQueue.waitForAllDone();
	}

	const markupToHtml = useMarkupToHtml({
		themeId: props.themeId,
		customCss: props.customCss,
		plugins: props.plugins,
	});

	const allAssets = useCallback(async (markupLanguage: number): Promise<any[]> => {
		const theme = themeStyle(props.themeId);

		const markupToHtml = markupLanguageUtils.newMarkupToHtml({
			resourceBaseUrl: `file://${Setting.value('resourceDir')}/`,
		});

		return markupToHtml.allAssets(markupLanguage, theme);
	}, [props.themeId]);

	const handleProvisionalFlag = useCallback(() => {
		if (props.isProvisional) {
			props.dispatch({
				type: 'NOTE_PROVISIONAL_FLAG_CLEAR',
				id: formNote.id,
			});
		}
	}, [props.isProvisional, formNote.id]);

	const previousNoteId = usePrevious(formNote.id);

	useEffect(() => {
		if (formNote.id === previousNoteId) return;

		if (editorRef.current) {
			editorRef.current.resetScroll();
		}

		setScrollWhenReady({
			type: props.selectedNoteHash ? ScrollOptionTypes.Hash : ScrollOptionTypes.Percent,
			value: props.selectedNoteHash ? props.selectedNoteHash : props.lastEditorScrollPercents[props.noteId] || 0,
		});

		ResourceEditWatcher.instance().stopWatchingAll();
	}, [formNote.id, previousNoteId]);

	const onFieldChange = useCallback((field: string, value: any, changeId = 0) => {
		if (!isMountedRef.current) {
			// When the component is unmounted, various actions can happen which can
			// trigger onChange events, for example the textarea might be cleared.
			// We need to ignore these events, otherwise the note is going to be saved
			// with an invalid body.
			reg.logger().debug('Skipping change event because the component is unmounted');
			return;
		}

		handleProvisionalFlag();

		const change = field === 'body' ? {
			body: value,
		} : {
			title: value,
		};

		const newNote = {
			...formNote,
			...change,
			bodyWillChangeId: 0,
			bodyChangeId: 0,
			hasChanged: true,
		};

		if (field === 'title') {
			setTitleHasBeenManuallyChanged(true);
		}

		if (isNewNote && !titleHasBeenManuallyChanged && field === 'body') {
			// TODO: Handle HTML/Markdown format
			newNote.title = Note.defaultTitle(value);
		}

		if (changeId !== null && field === 'body' && formNote.bodyWillChangeId !== changeId) {
			// Note was changed, but another note was loaded before save - skipping
			// The previously loaded note, that was modified, will be saved via saveNoteIfWillChange()
		} else {
			setFormNote(newNote);
			scheduleSaveNote(newNote);
		}
	}, [handleProvisionalFlag, formNote, isNewNote, titleHasBeenManuallyChanged]);

	useWindowCommandHandler({
		dispatch: props.dispatch,
		formNote,
		setShowLocalSearch,
		noteSearchBarRef,
		editorRef,
		titleInputRef,
		saveNoteAndWait,
		setFormNote,
	});

	const onDrop = useDropHandler({ editorRef });

	const onBodyChange = useCallback((event: OnChangeEvent) => onFieldChange('body', event.content, event.changeId), [onFieldChange]);

	const onTitleChange = useCallback((event: any) => onFieldChange('title', event.target.value), [onFieldChange]);

	// const onTitleKeydown = useCallback((event:any) => {
	// 	const keyCode = event.keyCode;

	// 	if (keyCode === 9) {
	// 		// TAB
	// 		event.preventDefault();

	// 		if (event.shiftKey) {
	// 			CommandService.instance().execute('focusElement', 'noteList');
	// 		} else {
	// 			CommandService.instance().execute('focusElement', 'noteBody');
	// 		}
	// 	}
	// }, [props.dispatch]);

	const onBodyWillChange = useCallback((event: any) => {
		handleProvisionalFlag();

		setFormNote(prev => {
			return {
				...prev,
				bodyWillChangeId: event.changeId,
				hasChanged: true,
			};
		});

		props.dispatch({
			type: 'EDITOR_NOTE_STATUS_SET',
			id: formNote.id,
			status: 'saving',
		});
	}, [formNote, handleProvisionalFlag]);

	const onMessage = useMessageHandler(scrollWhenReady, setScrollWhenReady, editorRef, setLocalSearchResultCount, props.dispatch, formNote);

	const introductionPostLinkClick = useCallback(() => {
		bridge().openExternal('https://www.patreon.com/posts/34246624');
	}, []);

	const externalEditWatcher_noteChange = useCallback((event) => {
		if (event.id === formNote.id) {
			const newFormNote = {
				...formNote,
				title: event.note.title,
				body: event.note.body,
			};

			setFormNote(newFormNote);
		}
	}, [formNote]);

	const onNotePropertyChange = useCallback((event) => {
		setFormNote(formNote => {
			if (formNote.id !== event.note.id) return formNote;

			const newFormNote: FormNote = { ...formNote };

			for (const key in event.note) {
				if (key === 'id') continue;
				(newFormNote as any)[key] = event.note[key];
			}

			return newFormNote;
		});
	}, []);

	useEffect(() => {
		eventManager.on('alarmChange', onNotePropertyChange);
		ExternalEditWatcher.instance().on('noteChange', externalEditWatcher_noteChange);

		return () => {
			eventManager.off('alarmChange', onNotePropertyChange);
			ExternalEditWatcher.instance().off('noteChange', externalEditWatcher_noteChange);
		};
	}, [externalEditWatcher_noteChange, onNotePropertyChange]);

	useEffect(() => {
		const dependencies = {
			setShowRevisions,
		};

		CommandService.instance().componentRegisterCommands(dependencies, commands);

		return () => {
			CommandService.instance().componentUnregisterCommands(commands);
		};
	}, [setShowRevisions]);

	const onScroll = useCallback((event: any) => {
		props.dispatch({
			type: 'EDITOR_SCROLL_PERCENT_SET',
			noteId: formNote.id,
			percent: event.percent,
		});
	}, [props.dispatch, formNote]);

	function renderNoNotes(rootStyle: any) {
		const emptyDivStyle = Object.assign(
			{
				backgroundColor: 'black',
				opacity: 0.1,
			},
			rootStyle
		);
		return <div style={emptyDivStyle}></div>;
	}

	function renderTagButton() {
		return <ToolbarButton
			themeId={props.themeId}
			toolbarButtonInfo={props.setTagsToolbarButtonInfo}
		/>;
	}

	function renderTagBar() {
		const theme = themeStyle(props.themeId);
		const noteIds = [formNote.id];
		const instructions = <span onClick={() => { CommandService.instance().execute('setTags', noteIds); }} style={{ ...theme.clickableTextStyle, whiteSpace: 'nowrap' }}>Click to add tags...</span>;
		const tagList = props.selectedNoteTags.length ? <TagList items={props.selectedNoteTags} /> : null;

		return (
			<div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>{tagList}{instructions}</div>
		);
	}

	const searchMarkers = useSearchMarkers(showLocalSearch, localSearchMarkerOptions, props.searches, props.selectedSearchId, props.highlightedWords);

	const editorProps: NoteBodyEditorProps = {
		ref: editorRef,
		contentKey: formNote.id,
		style: styles.tinyMCE,
		onChange: onBodyChange,
		onWillChange: onBodyWillChange,
		onMessage: onMessage,
		content: formNote.body,
		contentMarkupLanguage: formNote.markup_language,
		contentOriginalCss: formNote.originalCss,
		resourceInfos: resourceInfos,
		htmlToMarkdown: htmlToMarkdown,
		markupToHtml: markupToHtml,
		allAssets: allAssets,
		disabled: false,
		themeId: props.themeId,
		dispatch: props.dispatch,
		noteToolbar: null,
		onScroll: onScroll,
		setLocalSearchResultCount: setLocalSearchResultCount,
		searchMarkers: searchMarkers,
		visiblePanes: props.noteVisiblePanes || ['editor', 'viewer'],
		keyboardMode: Setting.value('editor.keyboardMode'),
		locale: Setting.value('locale'),
		onDrop: onDrop,
		noteToolbarButtonInfos: props.toolbarButtonInfos,
		plugins: props.plugins,
	};

	let editor = null;

	if (props.bodyEditor === 'TinyMCE') {
		editor = <TinyMCE {...editorProps}/>;
	} else if (props.bodyEditor === 'CodeMirror') {
		editor = <CodeMirror {...editorProps}/>;
	} else {
		throw new Error(`Invalid editor: ${props.bodyEditor}`);
	}

	const wysiwygBanner = props.bodyEditor !== 'TinyMCE' ? null : (
		<div style={{ ...styles.warningBanner }}>
			This is an experimental Rich Text editor for evaluation only. Please do not use with important notes as you may lose some data! See the <a style={styles.urlColor} onClick={introductionPostLinkClick} href="#">introduction post</a> for more information. To switch to the Markdown Editor please press the "Toggle editors" in the top right-hand corner.
		</div>
	);

	const noteRevisionViewer_onBack = useCallback(() => {
		setShowRevisions(false);
	}, []);

	if (showRevisions) {
		const theme = themeStyle(props.themeId);

		const revStyle: any = {
			// ...props.style,
			display: 'inline-flex',
			padding: theme.margin,
			verticalAlign: 'top',
			boxSizing: 'border-box',
		};

		return (
			<div style={revStyle}>
				<NoteRevisionViewer customCss={props.customCss} noteId={formNote.id} onBack={noteRevisionViewer_onBack} />
			</div>
		);
	}

	if (props.selectedNoteIds.length > 1) {
		return <MultiNoteActions
			themeId={props.themeId}
			selectedNoteIds={props.selectedNoteIds}
			notes={props.notes}
			dispatch={props.dispatch}
			watchedNoteFiles={props.watchedNoteFiles}
			plugins={props.plugins}
		/>;
	}

	function renderSearchBar() {
		if (!showLocalSearch) return false;

		const theme = themeStyle(props.themeId);

		return (
			<NoteSearchBar
				ref={noteSearchBarRef}
				style={{
					display: 'flex',
					height: 35,
					borderTop: `1px solid ${theme.dividerColor}`,
				}}
				query={localSearch.query}
				searching={localSearch.searching}
				resultCount={localSearch.resultCount}
				selectedIndex={localSearch.selectedIndex}
				onChange={localSearch_change}
				onNext={localSearch_next}
				onPrevious={localSearch_previous}
				onClose={localSearch_close}
				visiblePanes={props.noteVisiblePanes}
			/>
		);
	}

	function renderResourceWatchingNotification() {
		if (!Object.keys(props.watchedResources).length) return null;
		const resourceTitles = Object.keys(props.watchedResources).map(id => props.watchedResources[id].title);
		return (
			<div style={styles.resourceWatchBanner}>
				<p style={styles.resourceWatchBannerLine}>{_('The following attachments are being watched for changes:')} <strong>{resourceTitles.join(', ')}</strong></p>
				<p style={{ ...styles.resourceWatchBannerLine, marginBottom: 0 }}>{_('The attachments will no longer be watched when you switch to a different note.')}</p>
			</div>
		);
	}

	function renderSearchInfo() {
		if (formNoteFolder && ['Search', 'Tag', 'SmartFilter'].includes(props.notesParentType)) {
			return (
				<div style={{ paddingTop: 10, paddingBottom: 10 }}>
					<Button
						iconName="icon-notebooks"
						level={ButtonLevel.Primary}
						title={_('In: %s', substrWithEllipsis(formNoteFolder.title, 0, 100))}
						onClick={() => {
							props.dispatch({
								type: 'FOLDER_AND_NOTE_SELECT',
								folderId: formNoteFolder.id,
								noteId: formNote.id,
							});
						}}
					/>
					<div style={{ flex: 1 }}></div>
				</div>
			);
		} else {
			return null;
		}
	}

	if (formNote.encryption_applied || !formNote.id || !props.noteId) {
		return renderNoNotes(styles.root);
	}

	return (
		<div style={styles.root} onDrop={onDrop}>
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				{renderResourceWatchingNotification()}
				<NoteTitleBar
					titleInputRef={titleInputRef}
					themeId={props.themeId}
					isProvisional={props.isProvisional}
					noteIsTodo={formNote.is_todo}
					noteTitle={formNote.title}
					noteUserUpdatedTime={formNote.user_updated_time}
					onTitleChange={onTitleChange}
				/>
				{renderSearchInfo()}
				<div style={{ display: 'flex', flex: 1 }}>
					{editor}
				</div>
				<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
					{renderSearchBar()}
				</div>
				<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', height: 40 }}>
					{renderTagButton()}
					{renderTagBar()}
				</div>
				{wysiwygBanner}
			</div>
		</div>
	);
}

export {
	NoteEditor as NoteEditorComponent,
};

const mapStateToProps = (state: AppState) => {
	const noteId = state.selectedNoteIds.length === 1 ? state.selectedNoteIds[0] : null;
	const whenClauseContext = stateToWhenClauseContext(state);

	return {
		noteId: noteId,
		notes: state.notes,
		folders: state.folders,
		selectedNoteIds: state.selectedNoteIds,
		isProvisional: state.provisionalNoteIds.includes(noteId),
		editorNoteStatuses: state.editorNoteStatuses,
		syncStarted: state.syncStarted,
		themeId: state.settings.theme,
		watchedNoteFiles: state.watchedNoteFiles,
		notesParentType: state.notesParentType,
		selectedNoteTags: state.selectedNoteTags,
		lastEditorScrollPercents: state.lastEditorScrollPercents,
		selectedNoteHash: state.selectedNoteHash,
		searches: state.searches,
		selectedSearchId: state.selectedSearchId,
		customCss: state.customCss,
		noteVisiblePanes: state.noteVisiblePanes,
		watchedResources: state.watchedResources,
		highlightedWords: state.highlightedWords,
		plugins: state.pluginService.plugins,
		toolbarButtonInfos: toolbarButtonUtils.commandsToToolbarButtons([
			'historyBackward',
			'historyForward',
			'toggleEditors',
			'toggleExternalEditing',
		], whenClauseContext),
		setTagsToolbarButtonInfo: toolbarButtonUtils.commandsToToolbarButtons([
			'setTags',
		], whenClauseContext)[0],
	};
};

export default connect(mapStateToProps)(NoteEditor);
