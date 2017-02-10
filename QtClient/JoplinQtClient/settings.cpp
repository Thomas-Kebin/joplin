#include "settings.h"
#include "models/setting.h"

using namespace jop;

Settings::Settings() : QSettings() {}

bool readSqlite(QIODevice &device, QSettings::SettingsMap &map) {
	Q_UNUSED(device);
	map = Setting::settings();
	return true;
}

bool writeSqlite(QIODevice &device, const QSettings::SettingsMap &map) {
	// HACK: QSettings requires a readable/writable file to be present
	// for the custom handler to work. However, we don't need such a
	// file since we write to the db. So to simulate it, we write once
	// to that file. Without this, readSqlite in particular will never
	// get called.
	device.write("X", 1);
	Setting::setSettings(map);
	return true;
}

void Settings::initialize() {
	const QSettings::Format SqliteFormat = QSettings::registerFormat("sqlite", &readSqlite, &writeSqlite);
	QSettings::setDefaultFormat(SqliteFormat);
}

QString Settings::valueString(const QString &name, const QString &defaultValue) {
	return value(name, defaultValue).toString();
}

int Settings::valueInt(const QString &name, int defaultValue) {
	return value(name, defaultValue).toInt();
}

QString Settings::keyValueToFriendlyString(const QString& key) const {
	return QString("%1 = %2").arg(key).arg(value(key).toString());
}