const BaseModel = require('../BaseModel').default;

const migrationScripts = {
	20: require('../migrations/20.js'),
	27: require('../migrations/27.js'),
	33: require('../migrations/33.js'),
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
		if (!migrationScripts[number]) throw new Error('Migration script has not been added to "migrationScripts" array');
		return migrationScripts[number];
	}
}

module.exports = Migration;
