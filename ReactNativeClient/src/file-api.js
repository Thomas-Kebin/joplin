import { isHidden } from 'src/path-utils.js';
import { Logger } from 'src/logger.js';

class FileApi {

	constructor(baseDir, driver) {
		this.baseDir_ = baseDir;
		this.driver_ = driver;
		this.logger_ = new Logger();
	}

	setLogger(l) {
		this.logger_ = l;
	}

	logger() {
		return this.logger_;
	}

	fullPath_(path) {
		let output = this.baseDir_;
		if (path != '') output += '/' + path;
		return output;
	}

	list(path = '', options = null) {
		if (!options) options = {};
		if (!('includeHidden' in options)) options.includeHidden = false;

		this.logger().debug('list');
		return this.driver_.list(this.baseDir_).then((items) => {
			if (!options.includeHidden) {
				let temp = [];
				for (let i = 0; i < items.length; i++) {
					if (!isHidden(items[i].path)) temp.push(items[i]);
				}
				items = temp;
			}
			return items;
		});
	}

	setTimestamp(path, timestamp) {
		this.logger().debug('setTimestamp ' + path);
		return this.driver_.setTimestamp(this.fullPath_(path), timestamp);
	}

	mkdir(path) {
		this.logger().debug('mkdir ' + path);
		return this.driver_.mkdir(this.fullPath_(path));
	}

	stat(path) {
		this.logger().debug('stat ' + path);
		return this.driver_.stat(this.fullPath_(path)).then((output) => {
			if (!output) return output;
			output.path = path;
			return output;
		});
	}

	get(path) {
		this.logger().debug('get ' + path);
		return this.driver_.get(this.fullPath_(path));
	}

	put(path, content) {
		this.logger().debug('put ' + path);
		return this.driver_.put(this.fullPath_(path), content);
	}

	delete(path) {
		this.logger().debug('delete ' + path);
		return this.driver_.delete(this.fullPath_(path));
	}

	move(oldPath, newPath) {
		this.logger().debug('move ' + oldPath + ' => ' + newPath);
		return this.driver_.move(this.fullPath_(oldPath), this.fullPath_(newPath));
	}

	format() {
		return this.driver_.format();
	}

}

export { FileApi };