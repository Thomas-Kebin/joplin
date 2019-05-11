const BaseModel = require('lib/BaseModel.js');

const migrationScripts = {
	20: require('lib/migrations/20.js'),
};

class Migration extends BaseModel {

	static tableName() {
		return 'migrations';
	}

	static modelType() {
		return BaseModel.TYPE_MIGRATION;
	}

	static migrationsToDo() {
		return this.modelSelectAll('SELECT * FROM migrations ORDER BY number ASC');
	}

	static script(number) {
		return migrationScripts[number];
	}

}

module.exports = Migration;