const { padLeft } = require('lib/string-utils.js');
const { shim } = require('lib/shim.js');
const sjcl = shim.sjclModule;

class EncryptionService {

	fsDriver() {
		if (!EncryptionService.fsDriver_) throw new Error('EncryptionService.fsDriver_ not set!');
		return EncryptionService.fsDriver_;
	}

	async encrypt(method, key, plainText) {
		if (method === EncryptionService.METHOD_SJCL) {
			// Good demo to understand each parameter: https://bitwiseshiftleft.github.io/sjcl/demo/
			return sjcl.json.encrypt(key, plainText, {
				"v": 1, // version
				"iter":1000, // Defaults to 10000 in sjcl but since we're running this on mobile devices, use a lower value. Maybe review this after some time. https://security.stackexchange.com/questions/3959/recommended-of-iterations-when-using-pkbdf2-sha256
				"ks":128, // Key size - "128 bits should be secure enough"
				"ts":64, // ???
				"mode":"ocb2", //  The cipher mode is a standard for how to use AES and other algorithms to encrypt and authenticate your message. OCB2 mode is slightly faster and has more features, but CCM mode has wider support because it is not patented. 
				//"adata":"", // Associated Data - not needed?
				"cipher":"aes"
			});
		}
	}

	async decrypt(method, key, cipherText) {
		if (method === EncryptionService.METHOD_SJCL) {
			return sjcl.json.decrypt(key, cipherText);
		}
	}

	async encryptFile(method, key, srcPath, destPath) {
		const fsDriver = this.fsDriver();

		let handle = await fsDriver.open(srcPath, 'r');

		const cleanUp = () => {
			if (handle) fsDriver.close(handle);
			handle = null;
		}

		// Note: 1 MB is very slow with Node and probably even worse on mobile. 50 KB seems to work well
		// and doesn't produce too much overhead in terms of headers.
		const chunkSize = 50000;

		try {
			await fsDriver.unlink(destPath);

			// Header
			await fsDriver.appendFile(destPath, '01', 'ascii'); // Version number
			await fsDriver.appendFile(destPath, padLeft(EncryptionService.METHOD_SJCL.toString(16), 2, '0'), 'ascii'); // Encryption method

			while (true) {
				const plainText = await fsDriver.readFileChunk(handle, chunkSize, 'base64');
				if (!plainText) break;

				const cipherText = await this.encrypt(method, key, plainText);

				await fsDriver.appendFile(destPath, padLeft(cipherText.length.toString(16), 6, '0'), 'ascii'); // Data - Length
				await fsDriver.appendFile(destPath, cipherText, 'ascii'); // Data - Data
			}
		} catch (error) {
			cleanUp();
			await fsDriver.unlink(destPath);
			throw error;
		}

		cleanUp();
	}

	async decryptFile(key, srcPath, destPath) {
		const fsDriver = this.fsDriver();

		let handle = await fsDriver.open(srcPath, 'r');

		const cleanUp = () => {
			if (handle) fsDriver.close(handle);
			handle = null;
		}

		try {
			await fsDriver.unlink(destPath);

			const headerHexaBytes = await fsDriver.readFileChunk(handle, 4, 'ascii');
			const header = this.parseFileHeader_(headerHexaBytes);

			while (true) {
				const lengthHex = await fsDriver.readFileChunk(handle, 6, 'ascii');
				if (!lengthHex) break;

				const length = parseInt(lengthHex, 16);

				const cipherText = await fsDriver.readFileChunk(handle, length, 'ascii');
				if (!cipherText) break;

				const plainText = await this.decrypt(header.encryptionMethod, key, cipherText);

				await fsDriver.appendFile(destPath, plainText, 'base64');
			}
		} catch (error) {
			cleanUp();
			await fsDriver.unlink(destPath);
			throw error;
		}

		cleanUp();
	}

	parseFileHeader_(headerHexaBytes) {
		return {
			version: parseInt(headerHexaBytes.substr(0,2), 16),
			encryptionMethod: parseInt(headerHexaBytes.substr(2,2), 16),
		};
	}

}

EncryptionService.METHOD_SJCL = 1;

EncryptionService.fsDriver_ = null;

module.exports = EncryptionService;