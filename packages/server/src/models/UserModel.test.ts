import { createUserAndSession, beforeAllDb, afterAllTests, beforeEachDb, models, checkThrowAsync, createItem } from '../utils/testing/testUtils';
import { EmailSender, User, UserFlagType } from '../services/database/types';
import { ErrorUnprocessableEntity } from '../utils/errors';
import { betaUserDateRange, stripeConfig } from '../utils/stripe';
import { accountByType, AccountType } from './UserModel';
import { failedPaymentFinalAccount, failedPaymentWarningInterval } from './SubscriptionModel';
import { stripePortalUrl } from '../utils/urlUtils';

describe('UserModel', function() {

	beforeAll(async () => {
		await beforeAllDb('UserModel');
	});

	afterAll(async () => {
		await afterAllTests();
	});

	beforeEach(async () => {
		await beforeEachDb();
	});

	test('should validate user objects', async function() {
		const { user: user1 } = await createUserAndSession(2, false);
		const { user: user2 } = await createUserAndSession(3, false);

		let error = null;

		// Email must be set
		error = await checkThrowAsync(async () => await models().user().save({ email: '', password: '1234546' }));
		expect(error instanceof ErrorUnprocessableEntity).toBe(true);

		// Password must be set
		error = await checkThrowAsync(async () => await models().user().save({ email: 'newone@example.com', password: '' }));
		expect(error instanceof ErrorUnprocessableEntity).toBe(true);

		// email must be set
		error = await checkThrowAsync(async () => await models().user().save({ id: user1.id, email: '' }));
		expect(error instanceof ErrorUnprocessableEntity).toBe(true);

		// password must be set
		error = await checkThrowAsync(async () => await models().user().save({ id: user1.id, password: '' }));
		expect(error instanceof ErrorUnprocessableEntity).toBe(true);

		// there is already a user with this email
		error = await checkThrowAsync(async () => await models().user().save({ id: user1.id, email: user2.email }));
		expect(error instanceof ErrorUnprocessableEntity).toBe(true);

		// check that the email is valid
		error = await checkThrowAsync(async () => await models().user().save({ id: user1.id, email: 'ohno' }));
		expect(error instanceof ErrorUnprocessableEntity).toBe(true);
	});

	test('should delete a user', async function() {
		const { session: session1, user: user1 } = await createUserAndSession(2, false);

		const userModel = models().user();

		const allUsers: User[] = await userModel.all();
		const beforeCount: number = allUsers.length;

		await createItem(session1.id, 'root:/test.txt:', 'testing');

		// Admin can delete any user
		expect(!!(await models().session().load(session1.id))).toBe(true);
		expect((await models().item().all()).length).toBe(1);
		expect((await models().userItem().all()).length).toBe(1);
		await models().user().delete(user1.id);
		expect((await userModel.all()).length).toBe(beforeCount - 1);
		expect(!!(await models().session().load(session1.id))).toBe(false);
		expect((await models().item().all()).length).toBe(0);
		expect((await models().userItem().all()).length).toBe(0);
	});

	test('should push an email when creating a new user', async function() {
		const { user: user1 } = await createUserAndSession(1);
		const { user: user2 } = await createUserAndSession(2);

		const emails = await models().email().all();
		expect(emails.length).toBe(2);
		expect(emails.find(e => e.recipient_email === user1.email)).toBeTruthy();
		expect(emails.find(e => e.recipient_email === user2.email)).toBeTruthy();

		const email = emails[0];
		expect(email.subject.trim()).toBeTruthy();
		expect(email.body.includes('/confirm?token=')).toBeTruthy();
		expect(email.sender_id).toBe(EmailSender.NoReply);
		expect(email.sent_success).toBe(0);
		expect(email.sent_time).toBe(0);
		expect(email.error).toBe('');
	});

	test('should send a beta reminder email', async function() {
		stripeConfig().enabled = true;
		const { user: user1 } = await createUserAndSession(1, false, { email: 'toto@example.com' });
		const range = betaUserDateRange();

		await models().user().save({
			id: user1.id,
			created_time: range[0],
			account_type: AccountType.Pro,
		});

		Date.now = jest.fn(() => range[0] + 6912000 * 1000); // 80 days later

		await models().user().handleBetaUserEmails();

		expect((await models().email().all()).length).toBe(2);

		{
			const email = (await models().email().all()).pop();
			expect(email.recipient_email).toBe('toto@example.com');
			expect(email.subject.indexOf('10 days') > 0).toBe(true);
			expect(email.body.indexOf('10 days') > 0).toBe(true);
			expect(email.body.indexOf('toto%40example.com') > 0).toBe(true);
			expect(email.body.indexOf('account_type=2') > 0).toBe(true);
		}

		await models().user().handleBetaUserEmails();

		// It should not send a second email
		expect((await models().email().all()).length).toBe(2);

		Date.now = jest.fn(() => range[0] + 7603200 * 1000); // 88 days later

		await models().user().handleBetaUserEmails();

		expect((await models().email().all()).length).toBe(3);

		{
			const email = (await models().email().all()).pop();
			expect(email.subject.indexOf('2 days') > 0).toBe(true);
			expect(email.body.indexOf('2 days') > 0).toBe(true);
		}

		await models().user().handleBetaUserEmails();

		expect((await models().email().all()).length).toBe(3);

		stripeConfig().enabled = false;
	});

	test('should disable beta account once expired', async function() {
		stripeConfig().enabled = true;
		const { user: user1 } = await createUserAndSession(1, false, { email: 'toto@example.com' });
		const range = betaUserDateRange();
		await models().user().save({
			id: user1.id,
			created_time: range[0],
			account_type: AccountType.Pro,
		});

		Date.now = jest.fn(() => range[0] + 8640000 * 1000); // 100 days later

		await models().user().handleBetaUserEmails();

		expect((await models().email().all()).length).toBe(4);
		const email = (await models().email().all()).pop();
		expect(email.subject.indexOf('beta account is expired') > 0).toBe(true);

		const reloadedUser = await models().user().load(user1.id);
		expect(reloadedUser.can_upload).toBe(0);

		const userFlag = await models().userFlag().byUserId(user1.id, UserFlagType.AccountWithoutSubscription);
		expect(userFlag).toBeTruthy();
		stripeConfig().enabled = false;
	});

	test('should disable upload and send an email if payment failed recently', async function() {
		stripeConfig().enabled = true;

		const { user: user1 } = await models().subscription().saveUserAndSubscription('toto@example.com', 'Toto', AccountType.Basic, 'usr_111', 'sub_111');
		await models().subscription().saveUserAndSubscription('tutu@example.com', 'Tutu', AccountType.Basic, 'usr_222', 'sub_222');

		const sub = await models().subscription().byUserId(user1.id);

		const now = Date.now();
		const paymentFailedTime = now - failedPaymentWarningInterval - 10;
		await models().subscription().save({
			id: sub.id,
			last_payment_time: now - failedPaymentWarningInterval * 2,
			last_payment_failed_time: paymentFailedTime,
		});

		await models().user().handleFailedPaymentSubscriptions();

		{
			const user1 = await models().user().loadByEmail('toto@example.com');
			expect(user1.can_upload).toBe(0);

			const email = (await models().email().all()).pop();
			expect(email.key).toBe(`payment_failed_upload_disabled_${paymentFailedTime}`);
			expect(email.body).toContain(stripePortalUrl());
			expect(email.body).toContain('14 days');
		}

		const beforeEmailCount = (await models().email().all()).length;
		await models().user().handleFailedPaymentSubscriptions();
		const afterEmailCount = (await models().email().all()).length;
		expect(beforeEmailCount).toBe(afterEmailCount);

		{
			const user2 = await models().user().loadByEmail('tutu@example.com');
			expect(user2.can_upload).toBe(1);
		}

		stripeConfig().enabled = false;
	});

	test('should disable disable the account and send an email if payment failed for good', async function() {
		stripeConfig().enabled = true;

		const { user: user1 } = await models().subscription().saveUserAndSubscription('toto@example.com', 'Toto', AccountType.Basic, 'usr_111', 'sub_111');

		const sub = await models().subscription().byUserId(user1.id);

		const now = Date.now();
		const paymentFailedTime = now - failedPaymentFinalAccount - 10;
		await models().subscription().save({
			id: sub.id,
			last_payment_time: now - failedPaymentFinalAccount * 2,
			last_payment_failed_time: paymentFailedTime,
		});

		await models().user().handleFailedPaymentSubscriptions();

		{
			const user1 = await models().user().loadByEmail('toto@example.com');
			expect(user1.enabled).toBe(0);

			const email = (await models().email().all()).pop();
			expect(email.key).toBe(`payment_failed_account_disabled_${paymentFailedTime}`);
			expect(email.body).toContain(stripePortalUrl());
		}

		stripeConfig().enabled = false;
	});

	test('should send emails when the account is over the size limit', async function() {
		const { user: user1 } = await createUserAndSession(1);
		const { user: user2 } = await createUserAndSession(2);

		await models().user().save({
			id: user1.id,
			account_type: AccountType.Basic,
			total_item_size: Math.round(accountByType(AccountType.Basic).max_total_item_size * 0.85),
		});

		await models().user().save({
			id: user2.id,
			account_type: AccountType.Pro,
			total_item_size: Math.round(accountByType(AccountType.Pro).max_total_item_size * 0.2),
		});

		const emailBeforeCount = (await models().email().all()).length;

		await models().user().handleOversizedAccounts();

		const emailAfterCount = (await models().email().all()).length;

		expect(emailAfterCount).toBe(emailBeforeCount + 1);

		const email = (await models().email().all()).pop();
		expect(email.recipient_id).toBe(user1.id);
		expect(email.subject).toContain('80%');

		{
			// Running it again should not send a second email
			await models().user().handleOversizedAccounts();
			expect((await models().email().all()).length).toBe(emailBeforeCount + 1);
		}

		{
			// Now check that the 100% email is sent too

			await models().user().save({
				id: user2.id,
				total_item_size: Math.round(accountByType(AccountType.Pro).max_total_item_size * 1.1),
			});

			// User upload should be enabled at this point
			expect((await models().user().load(user2.id)).can_upload).toBe(1);

			const emailBeforeCount = (await models().email().all()).length;
			await models().user().handleOversizedAccounts();
			const emailAfterCount = (await models().email().all()).length;

			// User upload should be disabled
			expect((await models().user().load(user2.id)).can_upload).toBe(0);

			expect(emailAfterCount).toBe(emailBeforeCount + 1);
			const email = (await models().email().all()).pop();

			expect(email.recipient_id).toBe(user2.id);
			expect(email.subject).toContain('100%');

			// Running it again should not send a second email
			await models().user().handleOversizedAccounts();
			expect((await models().email().all()).length).toBe(emailBeforeCount + 1);
		}
	});

});
