#include "basemodel.h"

#include "dispatcher.h"
#include "models/change.h"
#include "database.h"
#include "uuid.h"

using namespace jop;

QMap<int, QVector<BaseModel::Field>> BaseModel::tableFields_;
QHash<QString, QVariant> BaseModel::cache_;

BaseModel::BaseModel() : table_(jop::UndefinedTable), isNew_(-1) {}

QStringList BaseModel::changedFields() const {
	QStringList output;
	for (QHash<QString, bool>::const_iterator it = changedFields_.begin(); it != changedFields_.end(); ++it) {
		output.push_back(it.key());
	}
	return output;
}

int BaseModel::count(Table table, const QString &parentId) {
	QString t = BaseModel::tableName(table);
	QString k = QString("%1:count").arg(t);
	QVariant r = BaseModel::cacheGet(k);
	if (r.isValid()) return r.toInt();

	QSqlQuery q = jop::db().prepare("SELECT count(*) AS row_count FROM " + t + " WHERE parent_id = :parent_id");
	q.bindValue(":parent_id", parentId);
	jop::db().execQuery(q);
	q.next();
	if (!jop::db().errorCheck(q)) return 0;
	int output = q.value(0).toInt();
	BaseModel::cacheSet(k, QVariant(output));
	return output;
}

bool BaseModel::load(const QString &id) {
	QSqlQuery q(jop::db().database());
	q.prepare("SELECT " + BaseModel::tableFieldNames(table()).join(",") + " FROM " + BaseModel::tableName(table()) + " WHERE id = :id");
	q.bindValue(":id", id);
	jop::db().execQuery(q);
	q.next();
	if (!jop::db().errorCheck(q)) return false;
	if (!q.isValid()) return false;

	loadSqlQuery(q);
	return true;
}

bool BaseModel::loadByField(const QString& parentId, const QString& field, const QString& fieldValue) {
	QSqlQuery q(jop::db().database());
	QString sql = QString("SELECT %1 FROM %2 WHERE `%3` = :field_value AND parent_id = :parent_id LIMIT 1")
	                     .arg(BaseModel::tableFieldNames(table()).join(","))
	                     .arg(BaseModel::tableName(table()))
	                     .arg(field);
	q.prepare(sql);
	q.bindValue(":parent_id", parentId);
	q.bindValue(":field_value", fieldValue);
	jop::db().execQuery(q);
	q.next();
	if (!jop::db().errorCheck(q)) return false;
	if (!q.isValid()) return false;

	loadSqlQuery(q);
	return true;
}

bool BaseModel::save(bool trackChanges) {
	bool isNew = this->isNew();

	if (!changedFields_.size() && !isNew) return true;

	QStringList fields = changedFields();

	QMap<QString, QVariant> values;

	foreach (QString field, fields) {
		values[field] = value(field).toQVariant();
	}

	// If it's a new entry and the ID is a UUID, we need to create this
	// ID now. If the ID is an INT, it will be automatically set by
	// SQLite.
	if (isNew && primaryKeyIsUuid() && !valueIsSet(primaryKey())) {
		values[primaryKey()] = uuid::createUuid();
	}

	// Update created_time and updated_time if needed. If updated_time
	// has already been updated (maybe manually by the user), don't
	// automatically update it.
	if (isNew) {
		if (BaseModel::hasField(table(), "created_time")) {
			values["created_time"] = (int)(QDateTime::currentMSecsSinceEpoch() / 1000);
		}
	} else {
		if (!values.contains("updated_time")) {
			if (BaseModel::hasField(table(), "updated_time")) {
				values["updated_time"] = (int)(QDateTime::currentMSecsSinceEpoch() / 1000);
			}
		}
	}

	changedFields_.clear();

	const QString& tableName = BaseModel::tableName(table());

	if (isNew) {
		cacheDelete(QString("%1:count").arg(tableName));
	}

	bool isSaved = false;

	jop::db().transaction();

	if (isNew) {
		QSqlQuery q = jop::db().buildSqlQuery(Database::Insert, tableName, values);
		jop::db().execQuery(q);
		isSaved = jop::db().errorCheck(q);
		if (isSaved) setValue("id", values["id"]);
	} else {
		QSqlQuery q = jop::db().buildSqlQuery(Database::Update, tableName, values, QString("%1 = '%2'").arg(primaryKey()).arg(value("id").toString()));
		jop::db().execQuery(q);
		isSaved = jop::db().errorCheck(q);
	}

	if (isSaved && this->trackChanges() && trackChanges) {
		if (isNew) {
			Change change;
			change.setValue("item_id", id());
			change.setValue("item_type", table());
			change.setValue("type", Change::Create);
			change.save();
		} else {
			for (QMap<QString, QVariant>::const_iterator it = values.begin(); it != values.end(); ++it) {
				Change change;
				change.setValue("item_id", id());
				change.setValue("item_type", table());
				change.setValue("type", Change::Update);
				change.setValue("item_field", it.key());
				change.save();
			}
		}
	}

	jop::db().commit();

	if (isSaved) {
		if (table() == jop::FoldersTable) {
			if (isNew) {
				dispatcher().emitFolderCreated(idString());
			} else {
				dispatcher().emitFolderUpdated(idString());
			}
		}
		if (table() == jop::NotesTable) {
			if (isNew) {
				dispatcher().emitNoteCreated(idString());
			} else {
				dispatcher().emitNoteUpdated(idString());
			}
		}
	}

	isNew_ = -1;

	return isSaved;
}

bool BaseModel::dispose() {
	const QString& tableName = BaseModel::tableName(table());
	QSqlQuery q(jop::db().database());
	q.prepare("DELETE FROM " + tableName + " WHERE " + primaryKey() + " = :id");
	q.bindValue(":id", id().toString());
	jop::db().execQuery(q);

	bool isDeleted = jop::db().errorCheck(q);

	if (isDeleted) cacheDelete(QString("%1:count").arg(tableName));

	if (isDeleted && trackChanges()) {
		Change change;
		change.setValue("item_id", id());
		change.setValue("item_type", table());
		change.setValue("type", Change::Delete);
		change.save();
	}

	if (isDeleted) {
		if (table() == jop::FoldersTable) dispatcher().emitFolderDeleted(idString());
		if (table() == jop::NotesTable) dispatcher().emitNoteDeleted(idString());
	}

	return isDeleted;
}

Table BaseModel::table() const {
	return table_;
}

QString BaseModel::primaryKey() const {
	return "id";
}

bool BaseModel::primaryKeyIsUuid() const {
	return false;
}

bool BaseModel::trackChanges() const {
	return false;
}

QString BaseModel::displayTitle() const {
	return value("title").toString();
}

bool BaseModel::isNew() const {
	if (isNew_ == 0) return false;
	if (isNew_ == 1) return true;
	return !valueIsSet(primaryKey());
}

BaseModel::Field createField(const QString& name, QMetaType::Type type) {
	BaseModel::Field c;
	c.name = name;
	c.type = type;
	return c;
}

QVector<BaseModel::Field> BaseModel::tableFields(jop::Table table) {
	if (BaseModel::tableFields_.contains(table)) return BaseModel::tableFields_[table];

	QVector<BaseModel::Field> output;

	// TODO: ideally that should be auto-generated based on schema.sql

	if (table == jop::FoldersTable) {
		output.push_back(createField("id", QMetaType::QString ));
		output.push_back(createField("title", QMetaType::QString ));
		output.push_back(createField("created_time", QMetaType::Int ));
		output.push_back(createField("updated_time", QMetaType::Int ));
	} else if (table == jop::NotesTable) {
		output.push_back(createField("id", QMetaType::QString ));
		output.push_back(createField("title", QMetaType::QString ));
		output.push_back(createField("body", QMetaType::QString ));
		output.push_back(createField("parent_id", QMetaType::QString ));
		output.push_back(createField("created_time", QMetaType::Int ));
		output.push_back(createField("updated_time", QMetaType::Int ));
		output.push_back(createField("latitude", QMetaType::QString ));
		output.push_back(createField("longitude", QMetaType::QString ));
		output.push_back(createField("altitude", QMetaType::QString ));
		output.push_back(createField("source", QMetaType::QString ));
		output.push_back(createField("author", QMetaType::QString ));
		output.push_back(createField("source_url", QMetaType::QString ));
		output.push_back(createField("is_todo", QMetaType::Int ));
		output.push_back(createField("todo_due", QMetaType::Int ));
		output.push_back(createField("todo_completed", QMetaType::Int ));
		output.push_back(createField("source_application", QMetaType::QString ));
		output.push_back(createField("application_data", QMetaType::QString ));
		output.push_back(createField("order", QMetaType::Int ));
	} else if (table == jop::ChangesTable) {
		output.push_back(createField("id", QMetaType::Int ));
		output.push_back(createField("type", QMetaType::Int ));
		output.push_back(createField("item_id", QMetaType::QString ));
		output.push_back(createField("item_type", QMetaType::Int ));
		output.push_back(createField("item_field", QMetaType::QString ));
	} else {
		qFatal("Field not defined for table %d", table);
	}

	BaseModel::tableFields_[table] = output;
	return output;
}

bool BaseModel::hasField(jop::Table table, const QString &name) {
	QVector<BaseModel::Field> fields = tableFields(table);
	foreach (Field field, fields) {
		if (field.name == name) return true;
	}
	return false;
}

QStringList BaseModel::tableFieldNames(Table table) {
	QVector<BaseModel::Field> fields = BaseModel::tableFields(table);
	QStringList output;
	foreach (BaseModel::Field field, fields) {
		output.push_back(field.name);
	}
	return output;
}

QString BaseModel::sqlTableFields(Table table) {
	QString output = "";
	QStringList fields = BaseModel::tableFieldNames(table);
	for (int i = 0; i < fields.size(); i++) {
		if (output != "") output += ",";
		output += QString("`%1`").arg(fields[i]);
	}
	return output;
}

bool BaseModel::isValidFieldName(Table table, const QString &name) {
	QVector<BaseModel::Field> fields = BaseModel::tableFields(table);
	foreach (BaseModel::Field col, fields) {
		if (col.name == name) return true;
	}
	return false;
}

void BaseModel::deleteAll(Table table) {
	QString tableName = BaseModel::tableName(table);
	jop::db().execQuery("DELETE FROM " + tableName);
	BaseModel::cache_.clear();

	if (table == jop::FoldersTable) {
		dispatcher().emitAllFoldersDeleted();
	}
}

// When loading a QSqlQuery, all the values are cleared and replaced by those
// from the QSqlQuery. All the fields are marked as NOT changed as it's assumed
// the object is already in the database (since loaded from there).
void BaseModel::loadSqlQuery(const QSqlQuery &query) {
	values_.clear();
	QSqlRecord record = query.record();
	QVector<BaseModel::Field> fields = BaseModel::tableFields(table());

	foreach (BaseModel::Field field, fields) {
		int idx = record.indexOf(field.name);
		if (idx < 0) {
			qCritical() << "Cannot find field" << field.name;
			continue;
		}

		if (field.type == QMetaType::QString) {
			setValue(field.name, query.value(idx).toString());
		} else if (field.type == QMetaType::Int) {
			setValue(field.name, query.value(idx).toInt());
		} else {
			qCritical() << "Unsupported value type" << field.name;
		}
	}

	isNew_ = -1;

	changedFields_.clear();
}

// When loading a QJsonObject, all the values are cleared and replaced by those
// from the QJsonObject. All the fields are marked as changed since it's
// assumed that the object comes from the web service.
void BaseModel::loadJsonObject(const QJsonObject &jsonObject) {
	values_.clear();
	changedFields_.clear();

	QVector<BaseModel::Field> fields = BaseModel::tableFields(table());

	foreach (BaseModel::Field field, fields) {
		setValue(field.name, jsonObject[field.name], field.type);
	}

	isNew_ = 1;
}

void BaseModel::patchJsonObject(const QJsonObject &jsonObject) {
	QVector<BaseModel::Field> fields = BaseModel::tableFields(table());

	foreach (BaseModel::Field field, fields) {
		if (!jsonObject.contains(field.name)) continue;
		setValue(field.name, jsonObject[field.name], field.type);
	}
}

QHash<QString, BaseModel::Value> BaseModel::values() const {
	return values_;
}

BaseModel::Value BaseModel::value(const QString &name) const {
	if (!valueIsSet(name)) {
		qCritical() << "Value does not exist" << name;
		return Value();
	}
	return values_[name];
}

bool BaseModel::valueIsSet(const QString &name) const {
	return values_.contains(name);
}

void BaseModel::setValue(const QString &name, const BaseModel::Value &value) {
	if (!values_.contains(name)) {
		values_.insert(name, value);
		changedFields_.insert(name, true);
	} else {
		Value& v = values_[name];
		if (v.isEqual(value)) return;
		values_.insert(name, value);
		changedFields_.insert(name, true);
	}
}

void BaseModel::setValue(const QString &name, int value) {
	setValue(name, Value(value));
}

void BaseModel::setValue(const QString &name, const QJsonValue &value, QMetaType::Type type) {
	if (type == QMetaType::QString) {
		setValue(name, value.toString());
	} else if (type == QMetaType::Int) {
		setValue(name, value.toInt());
	} else {
		qFatal("Unsupported value type %s %d", name.toStdString(), type);
	}
}

//void BaseModel::setValues(const QHash<QString, BaseModel::Value> values) {
//	values_ = values;
//}

BaseModel::Value BaseModel::id() const {
	if (!valueIsSet(primaryKey())) return QVariant();
	return value(primaryKey());
}

QString BaseModel::idString() const {
	return id().toString();
}

QString BaseModel::valuesToString() const {
	QString s;
	for (QHash<QString, Value>::const_iterator it = values_.begin(); it != values_.end(); ++it) {
		if (s != "") s += "\n";
		s += it.key() + " = " + it.value().toString();
	}
	return s;
}

void BaseModel::clone(const BaseModel &baseModel) {
	values_ = baseModel.values_;
	changedFields_.clear();
	isNew_ = false;
	table_ = baseModel.table_;
}

QString BaseModel::tableName(Table t) {
	if (t == jop::FoldersTable) return "folders";
	if (t == jop::NotesTable) return "notes";
	if (t == jop::ChangesTable) return "changes";
	qFatal("Unknown table %d", t);
}

QVariant BaseModel::cacheGet(const QString &key) {
	if (!BaseModel::cache_.contains(key)) return QVariant();
	return cache_[key];
}

void BaseModel::cacheSet(const QString &key, const QVariant &value) {
	BaseModel::cache_[key] = value;
}

void BaseModel::cacheDelete(const QString &key) {
	BaseModel::cache_.remove(key);
}

QString BaseModel::title() const {
	return value("title").toString();
}

void BaseModel::setValue(const QString &name, const QString &value) {
	setValue(name, Value(value));
}

void BaseModel::setValue(const QString& name, const QVariant& value) {
	setValue(name, Value(value));
}

BaseModel::Value::Value() {}

BaseModel::Value::Value(const QString &v) {
	type_ = QMetaType::QString;
	stringValue_ = v;
}

BaseModel::Value::Value(int v) {
	type_ = QMetaType::Int;
	intValue_ = v;
}

BaseModel::Value::Value(const QVariant &v) {
	type_ = (QMetaType::Type)v.type();
	if (type_ == QMetaType::QString) {
		stringValue_ = v.toString();
	} else if (type_ == QMetaType::Int) {
		intValue_ = v.toInt();
	} else {
		// Creates an invalid Value, which is what we want
	}
}

int BaseModel::Value::toInt() const {
	return intValue_;
}

QString BaseModel::Value::toString() const {
	if (type_ == QMetaType::QString) return stringValue_;
	if (type_ == QMetaType::Int) return QString::number(intValue_);
	return QString("");
}

QVariant BaseModel::Value::toQVariant() const {
	QMetaType::Type t = type();
	if (t == QMetaType::QString) return QVariant(toString());
	if (t == QMetaType::Int) return QVariant(toInt());
	return QVariant();
}

QMetaType::Type BaseModel::Value::type() const {
	return type_;
}

bool BaseModel::Value::isValid() const {
	return type_ > 0;
}

bool BaseModel::Value::isEqual(const BaseModel::Value &v) const {
	QMetaType::Type type = v.type();
	if (this->type() != type) return false;
	if (type == QMetaType::QString) return toString() == v.toString();
	if (type == QMetaType::Int) return toInt() == v.toInt();

	qCritical() << "Unreachable";
	return false;
}
