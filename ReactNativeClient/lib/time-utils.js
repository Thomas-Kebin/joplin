import moment from 'moment';

let time = {

	unix() {
		return Math.floor((new Date()).getTime() / 1000);
	},

	unixMs() {
		return (new Date()).getTime();
	},

	unixMsToS(ms) {
		return Math.floor(ms / 1000);
	},

	unixMsToIso(ms) {
		return moment.unix(ms / 1000).utc().format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z';
	},

	unixMsToIsoSec(ms) {
		return moment.unix(ms / 1000).utc().format('YYYY-MM-DDTHH:mm:ss') + 'Z';
	},

	unixMsToLocalDateTime(ms) {
		return moment.unix(ms / 1000).format('DD/MM/YYYY HH:mm');
	},

	msleep(ms) {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, ms);
		});
	},

	sleep(seconds) {
		return this.msleep(seconds * 1000);
	},

}

export { time };