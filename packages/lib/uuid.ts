const createUuidV4 = require('uuid/v4');
const { customAlphabet } = require('nanoid/non-secure');

// https://zelark.github.io/nano-id-cc/
// https://security.stackexchange.com/a/41749/1873
// > On the other hand, 128 bits (between 21 and 22 characters
// > alphanumeric) is beyond the reach of brute-force attacks pretty much
// > indefinitely
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 22);

export default {
	create: function() {
		return createUuidV4().replace(/-/g, '');
	},
	createNano: function() {
		return nanoid();
	},
};
