const BaseModel = require("lib/BaseModel.js");
const BaseItem = require("lib/models/BaseItem.js");

class MasterKey extends BaseItem {
	static tableName() {
		return "master_keys";
	}

	static modelType() {
		return BaseModel.TYPE_MASTER_KEY;
	}

	static encryptionSupported() {
		return false;
	}

	static latest() {
		return this.modelSelectOne("SELECT * FROM master_keys WHERE created_time >= (SELECT max(created_time) FROM master_keys)");
	}

	static async serialize(item, type = null, shownKeys = null) {
		let fieldNames = this.fieldNames();
		fieldNames.push("type_");
		return super.serialize(item, "master_key", fieldNames);
	}

	static async save(o, options = null) {
		return super.save(o, options).then(item => {
			this.dispatch({
				type: "MASTERKEY_UPDATE_ONE",
				item: item,
			});
			return item;
		});
	}
}

module.exports = MasterKey;
