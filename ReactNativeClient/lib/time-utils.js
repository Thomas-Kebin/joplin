const moment = require('moment');

class Time {
	constructor() {
		this.dateFormat_ = 'DD/MM/YYYY';
		this.timeFormat_ = 'HH:mm';
	}

	dateFormat() {
		return this.dateFormat_;
	}

	setDateFormat(v) {
		this.dateFormat_ = v;
	}

	timeFormat() {
		return this.timeFormat_;
	}

	setTimeFormat(v) {
		this.timeFormat_ = v;
	}

	dateTimeFormat() {
		return this.dateFormat() + ' ' + this.timeFormat();
	}

	unix() {
		return Math.floor(Date.now() / 1000);
	}

	unixMs() {
		return Date.now();
	}

	unixMsToObject(ms) {
		return new Date(ms);
	}

	unixMsToS(ms) {
		return Math.floor(ms / 1000);
	}

	unixMsToIso(ms) {
		return (
			moment
				.unix(ms / 1000)
				.utc()
				.format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z'
		);
	}

	unixMsToIsoSec(ms) {
		return (
			moment
				.unix(ms / 1000)
				.utc()
				.format('YYYY-MM-DDTHH:mm:ss') + 'Z'
		);
	}

	unixMsToLocalDateTime(ms) {
		return moment.unix(ms / 1000).format('DD/MM/YYYY HH:mm');
	}

	formatMsToLocal(ms, format = null) {
		if (format === null) format = this.dateTimeFormat();
		return moment(ms).format(format);
	}

	formatLocalToMs(localDateTime, format = null) {
		if (format === null) format = this.dateTimeFormat();
		const m = moment(localDateTime, format);
		if (m.isValid()) return m.toDate().getTime();
		throw new Error('Invalid input for formatLocalToMs: ' + localDateTime);
	}

	// Mostly used as a utility function for the DateTime Electron component
	anythingToDateTime(o, defaultValue = null) {
		if (o && o.toDate) return o.toDate();
		if (!o) return defaultValue;
		let m = moment(o, time.dateTimeFormat());
		if (m.isValid()) return m.toDate();
		m = moment(o, time.dateFormat());
		return m.isValid() ? m.toDate() : defaultValue;
	}

	msleep(ms) {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, ms);
		});
	}

	sleep(seconds) {
		return this.msleep(seconds * 1000);
	}
}

const time = new Time();

module.exports = { time };
