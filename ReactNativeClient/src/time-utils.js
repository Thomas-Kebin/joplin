let time = {

	unix() {
		return Math.floor((new Date()).getTime() / 1000);
	},

	unixMs() {
		return (new Date()).getTime();
	},

	unixMsToS(ms) {
		return Math.floor(ms / 1000);
	}

}

export { time };