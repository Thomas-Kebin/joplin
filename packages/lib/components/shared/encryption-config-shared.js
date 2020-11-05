const EncryptionService = require('../../services/EncryptionService');
const { _ } = require('../../locale');
const BaseItem = require('../../models/BaseItem.js');
const Setting = require('../../models/Setting').default;
const MasterKey = require('../../models/MasterKey.js');
const { reg } = require('../../registry.js');
const shim = require('../../shim').default;

const shared = {};

shared.constructor = function(comp, props) {
	comp.state = {
		passwordChecks: {},
		stats: {
			encrypted: null,
			total: null,
		},
		passwords: Object.assign({}, props.passwords),
	};
	comp.isMounted_ = false;

	shared.refreshStatsIID_ = null;
};

shared.refreshStats = async function(comp) {
	const stats = await BaseItem.encryptedItemsStats();
	comp.setState({
		stats: stats,
	});
};

shared.reencryptData = async function() {
	const ok = confirm(_('Please confirm that you would like to re-encrypt your complete database.'));
	if (!ok) return;

	await BaseItem.forceSyncAll();
	reg.waitForSyncFinishedThenSync();
	Setting.setValue('encryption.shouldReencrypt', Setting.SHOULD_REENCRYPT_NO);
	alert(_('Your data is going to be re-encrypted and synced again.'));
};

shared.dontReencryptData = function() {
	Setting.setValue('encryption.shouldReencrypt', Setting.SHOULD_REENCRYPT_NO);
};

shared.upgradeMasterKey = async function(comp, masterKey) {
	const passwordCheck = comp.state.passwordChecks[masterKey.id];
	if (!passwordCheck) {
		alert(_('Please enter your password in the master key list below before upgrading the key.'));
		return;
	}

	try {
		const password = comp.state.passwords[masterKey.id];
		const newMasterKey = await EncryptionService.instance().upgradeMasterKey(masterKey, password);
		await MasterKey.save(newMasterKey);
		reg.waitForSyncFinishedThenSync();
		alert(_('The master key has been upgraded successfully!'));
	} catch (error) {
		alert(_('Could not upgrade master key: %s', error.message));
	}
};

shared.componentDidMount = async function(comp) {
	shared.componentDidUpdate(comp);

	shared.refreshStats(comp);

	if (shared.refreshStatsIID_) {
		shim.clearInterval(shared.refreshStatsIID_);
		shared.refreshStatsIID_ = null;
	}

	shared.refreshStatsIID_ = shim.setInterval(() => {
		if (!comp.isMounted_) {
			shim.clearInterval(shared.refreshStatsIID_);
			shared.refreshStatsIID_ = null;
			return;
		}
		shared.refreshStats(comp);
	}, 3000);
};

shared.componentDidUpdate = async function(comp, prevProps = null) {
	if (prevProps && comp.props.passwords !== prevProps.passwords) {
		comp.setState({ passwords: Object.assign({}, comp.props.passwords) });
	}

	if (!prevProps || comp.props.masterKeys !== prevProps.masterKeys || comp.props.passwords !== prevProps.passwords) {
		comp.checkPasswords();
	}
};

shared.componentWillUnmount = function() {
	if (shared.refreshStatsIID_) {
		shim.clearInterval(shared.refreshStatsIID_);
		shared.refreshStatsIID_ = null;
	}
};

shared.checkPasswords = async function(comp) {
	const passwordChecks = Object.assign({}, comp.state.passwordChecks);
	for (let i = 0; i < comp.props.masterKeys.length; i++) {
		const mk = comp.props.masterKeys[i];
		const password = comp.state.passwords[mk.id];
		const ok = password ? await EncryptionService.instance().checkMasterKeyPassword(mk, password) : false;
		passwordChecks[mk.id] = ok;
	}
	comp.setState({ passwordChecks: passwordChecks });
};

shared.decryptedStatText = function(comp) {
	const stats = comp.state.stats;
	const doneCount = stats.encrypted !== null ? stats.total - stats.encrypted : '-';
	const totalCount = stats.total !== null ? stats.total : '-';
	return _('Decrypted items: %s / %s', doneCount, totalCount);
};

shared.onSavePasswordClick = function(comp, mk) {
	const password = comp.state.passwords[mk.id];
	if (!password) {
		Setting.deleteObjectValue('encryption.passwordCache', mk.id);
	} else {
		Setting.setObjectValue('encryption.passwordCache', mk.id, password);
	}

	comp.checkPasswords();
};

shared.onPasswordChange = function(comp, mk, password) {
	const passwords = Object.assign({}, comp.state.passwords);
	passwords[mk.id] = password;
	comp.setState({ passwords: passwords });
};

module.exports = shared;
