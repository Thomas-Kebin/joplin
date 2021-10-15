import Dialog from '../Dialog';
import DialogButtonRow, { ClickEvent, ButtonSpec } from '../DialogButtonRow';
import DialogTitle from '../DialogTitle';
import { _ } from '@joplin/lib/locale';
import { useEffect, useState } from 'react';
import { FolderEntity } from '@joplin/lib/services/database/types';
import Folder from '@joplin/lib/models/Folder';
import ShareService from '@joplin/lib/services/share/ShareService';
import styled from 'styled-components';
import StyledFormLabel from '../style/StyledFormLabel';
import StyledInput from '../style/StyledInput';
import Button from '../Button/Button';
import Logger from '@joplin/lib/Logger';
import StyledMessage from '../style/StyledMessage';
import { ShareUserStatus, StateShare, StateShareUser } from '@joplin/lib/services/share/reducer';
import { State } from '@joplin/lib/reducer';
import { connect } from 'react-redux';
import { reg } from '@joplin/lib/registry';
import useAsyncEffect, { AsyncEffectEvent } from '@joplin/lib/hooks/useAsyncEffect';

const logger = Logger.create('ShareFolderDialog');

const StyledRoot = styled.div`
	min-width: 500px;
`;

const StyledFolder = styled.div`
	border: 1px solid ${(props) => props.theme.dividerColor};
	padding: 0.5em;
	margin-bottom: 1em;
	display: flex;
	align-items: center;
`;

const StyledRecipientControls = styled.div`
	display: flex;
	flex-direction: row;
`;

const StyledRecipientInput = styled(StyledInput)`
	width: 100%;
	margin-right: 10px;
`;

const StyledAddRecipient = styled.div`
	margin-bottom: 1em;
`;

const StyledRecipient = styled(StyledMessage)`
	display: flex;
	flex-direction: row;
	padding: .6em 1em;
	background-color: ${props => props.index % 2 === 0 ? props.theme.backgroundColor : props.theme.oddBackgroundColor};
	align-items: center;
`;

const StyledRecipientName = styled.div`
	display: flex;
	flex: 1;
`;

const StyledRecipientStatusIcon = styled.i`
	margin-right: .6em;
`;

const StyledRecipients = styled.div`
	margin-bottom: 10px;
`;

const StyledRecipientList = styled.div`
	border: 1px solid ${(props: any) => props.theme.dividerColor};
	border-radius: 3px;
	height: 300px;
	overflow-x: hidden;
	overflow-y: scroll;
`;

const StyledError = styled(StyledMessage)`
	word-break: break-all;
	margin-bottom: 1em;
`;

const StyledShareState = styled(StyledMessage)`
	word-break: break-all;
	margin-bottom: 1em;
`;

const StyledIcon = styled.i`
	margin-right: 8px;
`;

interface Props {
	themeId: number;
	folderId: string;
	onClose(): void;
	shares: StateShare[];
	shareUsers: Record<string, StateShareUser[]>;
}

interface RecipientDeleteEvent {
	shareUserId: string;
}

enum ShareState {
	Idle = 0,
	Synchronizing = 1,
	Creating = 2,
}

function ShareFolderDialog(props: Props) {
	const [folder, setFolder] = useState<FolderEntity>(null);
	const [recipientEmail, setRecipientEmail] = useState<string>('');
	const [latestError, setLatestError] = useState<Error>(null);
	const [share, setShare] = useState<StateShare>(null);
	const [shareUsers, setShareUsers] = useState<StateShareUser[]>([]);
	const [shareState, setShareState] = useState<ShareState>(ShareState.Idle);
	const [customButtons, setCustomButtons] = useState<ButtonSpec[]>([]);

	async function synchronize(event: AsyncEffectEvent = null) {
		setShareState(ShareState.Synchronizing);
		await reg.waitForSyncFinishedThenSync();
		if (event && event.cancelled) return;
		setShareState(ShareState.Idle);
	}

	useAsyncEffect(async (event: AsyncEffectEvent) => {
		const f = await Folder.load(props.folderId);
		if (event.cancelled) return;
		setFolder(f);
	}, [props.folderId]);

	useEffect(() => {
		void ShareService.instance().refreshShares();
	}, []);

	useAsyncEffect(async (event: AsyncEffectEvent) => {
		await synchronize(event);
	}, []);

	useEffect(() => {
		const s = props.shares.find(s => s.folder_id === props.folderId);
		setShare(s);
	}, [props.shares]);

	useEffect(() => {
		if (!share) return;
		void ShareService.instance().refreshShareUsers(share.id);
	}, [share]);

	useEffect(() => {
		setCustomButtons(share ? [{
			name: 'unshare',
			label: _('Unshare'),
		}] : []);
	}, [share]);

	useEffect(() => {
		if (!share) return;
		const sus = props.shareUsers[share.id];
		if (!sus) return;
		setShareUsers(sus);
	}, [share, props.shareUsers]);

	useEffect(() => {
		void ShareService.instance().refreshShares();
	}, [props.folderId]);

	async function shareRecipient_click() {
		setShareState(ShareState.Creating);

		try {
			setLatestError(null);
			const share = await ShareService.instance().shareFolder(props.folderId);
			await ShareService.instance().addShareRecipient(share.id, recipientEmail);
			await Promise.all([
				ShareService.instance().refreshShares(),
				ShareService.instance().refreshShareUsers(share.id),
			]);
			setRecipientEmail('');

			await synchronize();
		} catch (error) {
			logger.error(error);
			setLatestError(error);
		} finally {
			setShareState(ShareState.Idle);
		}
	}

	function recipientEmail_change(event: any) {
		setRecipientEmail(event.target.value);
	}

	async function recipient_delete(event: RecipientDeleteEvent) {
		if (!confirm(_('Delete this invitation? The recipient will no longer have access to this shared notebook.'))) return;

		try {
			await ShareService.instance().deleteShareRecipient(event.shareUserId);
		} catch (error) {
			logger.error(error);
			alert(_('The recipient could not be removed from the list. Please try again.\n\nThe error was: "%s"', error.message));
		}

		await ShareService.instance().refreshShareUsers(share.id);
	}

	function renderFolder() {
		return (
			<StyledFolder>
				<StyledIcon className="icon-notebooks"/>{folder ? folder.title : '...'}
			</StyledFolder>
		);
	}

	function renderAddRecipient() {
		const disabled = shareState !== ShareState.Idle;
		return (
			<StyledAddRecipient>
				<StyledFormLabel>{_('Add recipient:')}</StyledFormLabel>
				<StyledRecipientControls>
					<StyledRecipientInput disabled={disabled} type="email" placeholder="example@domain.com" value={recipientEmail} onChange={recipientEmail_change} />
					<Button disabled={disabled} title={_('Share')} onClick={shareRecipient_click}></Button>
				</StyledRecipientControls>
			</StyledAddRecipient>
		);
	}

	function renderRecipient(index: number, shareUser: StateShareUser) {
		const statusToIcon = {
			[ShareUserStatus.Waiting]: 'fas fa-question',
			[ShareUserStatus.Rejected]: 'fas fa-times',
			[ShareUserStatus.Accepted]: 'fas fa-check',
		};

		const statusToMessage = {
			[ShareUserStatus.Waiting]: _('Recipient has not yet accepted the invitation'),
			[ShareUserStatus.Rejected]: _('Recipient has rejected the invitation'),
			[ShareUserStatus.Accepted]: _('Recipient has accepted the invitation'),
		};

		return (
			<StyledRecipient key={shareUser.user.email} index={index}>
				<StyledRecipientName>{shareUser.user.email}</StyledRecipientName>
				<StyledRecipientStatusIcon title={statusToMessage[shareUser.status]} className={statusToIcon[shareUser.status]}></StyledRecipientStatusIcon>
				<Button iconName="far fa-times-circle" onClick={() => recipient_delete({ shareUserId: shareUser.id })}/>
			</StyledRecipient>
		);
	}

	function renderRecipients() {
		const listItems = shareUsers.map((su: StateShareUser, index: number) => renderRecipient(index, su));

		return (
			<StyledRecipients>
				<StyledFormLabel>{_('Recipients:')}</StyledFormLabel>
				<StyledRecipientList>
					{listItems}
				</StyledRecipientList>
			</StyledRecipients>
		);
	}

	function renderError() {
		if (!latestError) return null;

		return (
			<StyledError type="error">
				{latestError.message}
			</StyledError>
		);
	}

	function renderShareState() {
		if (shareState === ShareState.Idle) return null;

		const messages = {
			[ShareState.Synchronizing]: _('Synchronizing...'),
			[ShareState.Creating]: _('Sharing notebook...'),
		};

		const message = messages[shareState];
		if (!message) throw new Error(`Unsupported state: ${shareState}`);

		return (
			<StyledShareState>
				{message}
			</StyledShareState>
		);
	}

	const renderInfo = () => {
		return (
			<p className="info-text -small">
				{_('Please note that if it is a large notebook, it may take a few minutes for all the notes to show up on the recipient\'s device.')}
			</p>
		);
	};

	async function buttonRow_click(event: ClickEvent) {
		if (event.buttonName === 'unshare') {
			if (!confirm(_('Unshare this notebook? The recipients will no longer have access to its content.'))) return;
			await ShareService.instance().unshareFolder(props.folderId);
			void synchronize();
		}

		props.onClose();
	}

	function renderContent() {
		return (
			<StyledRoot>
				<DialogTitle title={_('Share Notebook')}/>
				{renderFolder()}
				{renderAddRecipient()}
				{renderShareState()}
				{renderError()}
				{renderRecipients()}
				{renderInfo()}
				<DialogButtonRow
					themeId={props.themeId}
					onClick={buttonRow_click}
					okButtonShow={false}
					cancelButtonLabel={_('Close')}
					customButtons={customButtons}
				/>
			</StyledRoot>
		);
	}

	return (
		<Dialog renderContent={renderContent}/>
	);
}

const mapStateToProps = (state: State) => {
	return {
		shares: state.shareService.shares,
		shareUsers: state.shareService.shareUsers,
	};
};

export default connect(mapStateToProps)(ShareFolderDialog as any);
