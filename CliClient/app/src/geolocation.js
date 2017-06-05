class Geolocation {

	static currentPosition_testResponse() {
		return {
			mocked: false,
			timestamp: (new Date()).getTime(),
			coords: {
				speed: 0,
				heading: 0,
				accuracy: 20,
				longitude: -3.4596633911132812,
				altitude: 0,
				latitude: 48.73219093634444
			}
		}
	}

	static currentPosition(options = null) {
		if (!options) options = {};
		if (!('enableHighAccuracy' in options)) options.enableHighAccuracy = true;
		if (!('timeout' in options)) options.timeout = 10000;

		return new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition((data) => {
				resolve(data);
			}, (error) => {
				rejec(error);
			}, options);
		});
	}

}

export { Geolocation };