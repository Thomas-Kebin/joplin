require('app-module-path').addPath(__dirname);

const { time } = require('lib/time-utils.js');
const { fileContentEqual, setupDatabase, setupDatabaseAndSynchronizer, db, synchronizer, fileApi, sleep, clearDatabase, switchClient, syncTargetId, objectsEqual, checkThrowAsync } = require('test-utils.js');
const ArrayUtils = require('lib/ArrayUtils.js');

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

describe('Encryption', function() {

	beforeEach(async (done) => {
		done();
	});

	it('should remove array elements', async (done) => {
		let a = ['un', 'deux', 'trois'];
		a = ArrayUtils.removeElement(a, 'deux');

		expect(a[0]).toBe('un');
		expect(a[1]).toBe('trois');
		expect(a.length).toBe(2);

		a = ['un', 'deux', 'trois'];
		a = ArrayUtils.removeElement(a, 'not in there');
		expect(a.length).toBe(3);

		done();
	});

	it('should find items using binary search', async (done) => {
		let items = ['aaa', 'ccc', 'bbb'];
		expect(ArrayUtils.binarySearch(items, 'bbb')).toBe(-1); // Array not sorted!
		items.sort();
		expect(ArrayUtils.binarySearch(items, 'bbb')).toBe(1);
		expect(ArrayUtils.binarySearch(items, 'ccc')).toBe(2);
		expect(ArrayUtils.binarySearch(items, 'oops')).toBe(-1);
		expect(ArrayUtils.binarySearch(items, 'aaa')).toBe(0);

		items = [];
		expect(ArrayUtils.binarySearch(items, 'aaa')).toBe(-1);

		done();
	});

});