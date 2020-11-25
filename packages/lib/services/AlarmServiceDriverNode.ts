import eventManager from '../eventManager';
import { Notification } from '../models/Alarm';
import shim from '../shim';

const notifier = require('node-notifier');
const bridge = require('electron').remote.require('./bridge').default;

interface Options {
	appName: string;
}

export default class AlarmServiceDriverNode {

	private appName_: string;
	private notifications_: any = {};
	private service_: any = null;

	constructor(options: Options) {
		// Note: appName is required to get the notification to work. It must be the same as the appId defined in package.json
		// https://github.com/mikaelbr/node-notifier/issues/144#issuecomment-319324058
		this.appName_ = options.appName;
	}

	setService(s: any) {
		this.service_ = s;
	}

	logger() {
		return this.service_.logger();
	}

	hasPersistentNotifications() {
		return false;
	}

	notificationIsSet(id: number) {
		return id in this.notifications_;
	}

	clearNotification(id: number) {
		if (!this.notificationIsSet(id)) return;
		shim.clearTimeout(this.notifications_[id].timeoutId);
		delete this.notifications_[id];
	}

	scheduleNotification(notification: Notification) {
		const now = Date.now();
		const interval = notification.date.getTime() - now;
		if (interval < 0) return;

		if (isNaN(interval)) {
			throw new Error(`Trying to create a notification from an invalid object: ${JSON.stringify(notification)}`);
		}

		this.logger().info(`AlarmServiceDriverNode::scheduleNotification: Notification ${notification.id} with interval: ${interval}ms`);

		if (this.notifications_[notification.id]) shim.clearTimeout(this.notifications_[notification.id].timeoutId);

		let timeoutId = null;

		// Note: setTimeout will break for values larger than Number.MAX_VALUE - in which case the timer
		// will fire immediately. So instead, if the interval is greater than a set max, reschedule after
		// that max interval.
		// https://stackoverflow.com/questions/3468607/why-does-settimeout-break-for-large-millisecond-delay-values/3468699

		const maxInterval = 60 * 60 * 1000;
		if (interval >= maxInterval)  {
			this.logger().info(`AlarmServiceDriverNode::scheduleNotification: Notification interval is greater than ${maxInterval}ms - will reschedule in ${maxInterval}ms`);

			timeoutId = shim.setTimeout(() => {
				if (!this.notifications_[notification.id]) {
					this.logger().info(`AlarmServiceDriverNode::scheduleNotification: Notification ${notification.id} has been deleted - not rescheduling it`);
					return;
				}
				this.scheduleNotification(this.notifications_[notification.id]);
			}, maxInterval);
		} else {
			timeoutId = shim.setTimeout(() => {
				const o: any = {
					appID: this.appName_,
					title: notification.title,
					icon: `${bridge().electronApp().buildDir()}/icons/512x512.png`,
				};
				if ('body' in notification) o.message = notification.body;

				// Message is required on Windows 7 however we don't want to repeat the title so
				// make it an empty string.
				// https://github.com/laurent22/joplin/issues/2144
				if (!o.message) o.message = '-';

				this.logger().info('AlarmServiceDriverNode::scheduleNotification: Triggering notification:', o);

				notifier.notify(o, (error: any, response: any) => {
					this.logger().info('AlarmServiceDriverNode::scheduleNotification: node-notifier response:', error, response);
				});

				this.clearNotification(notification.id);

				eventManager.emit('noteAlarmTrigger', { noteId: notification.noteId });
			}, interval);
		}

		this.notifications_[notification.id] = Object.assign({}, notification);
		this.notifications_[notification.id].timeoutId = timeoutId;
	}
}
