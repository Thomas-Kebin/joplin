import * as React from 'react';
import { _ } from '@joplin/lib/locale';
import CommandService from '@joplin/lib/services/CommandService';
import { ChangeEvent, useCallback } from 'react';
import NoteToolbar from '../../NoteToolbar/NoteToolbar';
import { buildStyle } from '@joplin/lib/theme';
import time from '@joplin/lib/time';
import styled from 'styled-components';

const StyledRoot = styled.div`
	display: flex;
	flex-direction: row;
	align-items: center;

	@media (max-width: 800px) {
		flex-direction: column;
		align-items: flex-start;
	}
`;

const InfoGroup = styled.div`
	display: flex;
	flex-direction: row;
	align-items: center;

	@media (max-width: 800px) {
		border-top: 1px solid ${props => props.theme.dividerColor};
		width: 100%;
	}
`;

interface Props {
	themeId: number;
	noteUserUpdatedTime: number;
	noteTitle: string;
	noteIsTodo: number;
	isProvisional: boolean;
	titleInputRef: any;
	onTitleChange(event: ChangeEvent<HTMLInputElement>): void;
}

function styles_(props: Props) {
	return buildStyle(['NoteEditorTitleBar'], props.themeId, (theme: any) => {
		return {
			titleInput: {
				flex: 1,
				display: 'inline-block',
				paddingTop: 5,
				minHeight: 38,
				boxSizing: 'border-box',
				fontWeight: 'bold',
				paddingBottom: 5,
				paddingLeft: 0,
				paddingRight: 8,
				marginLeft: 5,
				color: theme.textStyle.color,
				fontSize: Math.round(theme.textStyle.fontSize * 1.5),
				backgroundColor: theme.backgroundColor,
				border: 'none',
			},

			titleDate: {
				...theme.textStyle,
				color: theme.colorFaded,
				paddingLeft: 8,
				whiteSpace: 'nowrap',
			},
			toolbarStyle: {
				marginBottom: 0,
			},
		};
	});
}

export default function NoteTitleBar(props: Props) {
	const styles = styles_(props);

	const onTitleKeydown = useCallback((event: any) => {
		const keyCode = event.keyCode;

		if (keyCode === 9) { // TAB
			event.preventDefault();

			if (event.shiftKey) {
				CommandService.instance().execute('focusElement', 'noteList');
			} else {
				CommandService.instance().execute('focusElement', 'noteBody');
			}
		}
	}, []);

	function renderTitleBarDate() {
		return <span style={styles.titleDate}>{time.formatMsToLocal(props.noteUserUpdatedTime)}</span>;
	}

	function renderNoteToolbar() {
		return <NoteToolbar
			themeId={props.themeId}
			style={styles.toolbarStyle}
		/>;
	}

	return (
		<StyledRoot>
			<input
				type="text"
				ref={props.titleInputRef}
				placeholder={props.isProvisional ? _('Creating new %s...', props.noteIsTodo ? _('to-do') : _('note')) : ''}
				style={styles.titleInput}
				onChange={props.onTitleChange}
				onKeyDown={onTitleKeydown}
				value={props.noteTitle}
			/>
			<InfoGroup>
				{renderTitleBarDate()}
				{renderNoteToolbar()}
			</InfoGroup>
		</StyledRoot>
	);
}
