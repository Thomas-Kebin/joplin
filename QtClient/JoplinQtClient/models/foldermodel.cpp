#include "foldermodel.h"
#include "uuid.h"
#include "dispatcher.h"

using namespace jop;

FolderModel::FolderModel(Database &database) : QAbstractListModel(), db_(database), orderBy_("title") {
	virtualItemShown_ = false;

	connect(&dispatcher(), SIGNAL(folderCreated(QString)), this, SLOT(dispatcher_folderCreated(QString)));
	connect(&dispatcher(), SIGNAL(folderUpdated(QString)), this, SLOT(dispatcher_folderUpdated(QString)));
	connect(&dispatcher(), SIGNAL(folderDeleted(QString)), this, SLOT(dispatcher_folderDeleted(QString)));
	connect(&dispatcher(), SIGNAL(allFoldersDeleted()), this, SLOT(dispatcher_allFoldersDeleted()));
}

int FolderModel::rowCount(const QModelIndex & parent) const { Q_UNUSED(parent);
	return Folder::count() + (virtualItemShown_ ? 1 : 0);
}

// NOTE: to lazy load - send back "Loading..." if item not currently loaded
// queue the item for loading.
// Then batch load them a bit later.
QVariant FolderModel::data(const QModelIndex & index, int role) const {
	Folder folder;

	if (virtualItemShown_ && index.row() == rowCount() - 1) {
		folder.setValue("title", BaseModel::Value(QString("Untitled")));
	} else {
		folder = atIndex(index.row());
	}

	if (role == Qt::DisplayRole) {
		return folder.value("title").toQVariant();
	}

	if (role == IdRole) {
		return folder.id().toQVariant();
	}

	return QVariant();
}

bool FolderModel::setData(const QModelIndex &index, const QVariant &value, int role) {
	Folder folder = atIndex(index.row());

	if (role == Qt::EditRole) {
		folder.setValue("title", value);
		if (!folder.save()) return false;
		cache_.clear();

//		QVector<int> roles;
//		roles << Qt::DisplayRole;
//		emit dataChanged(this->index(0), this->index(rowCount() - 1), roles);
		return true;
	}

	qWarning() << "Unsupported role" << role;
	return false;
}

Folder FolderModel::atIndex(int index) const {
	if (cache_.size()) {
		if (index < 0 || index >= cache_.size()) {
			qWarning() << "Invalid folder index:" << index;
			return Folder();
		}

		return cache_[index];
	}

	cache_.clear();

	cache_ = Folder::all(orderBy_);

	if (!cache_.size()) {
		qWarning() << "Invalid folder index:" << index;
		return Folder();
	} else {
		return atIndex(index);
	}
}

Folder FolderModel::atIndex(const QModelIndex &index) const {
	return atIndex(index.row());
}

void FolderModel::showVirtualItem() {
	virtualItemShown_ = true;
	beginInsertRows(QModelIndex(), this->rowCount() - 1, this->rowCount() - 1);
	endInsertRows();
}

void FolderModel::hideVirtualItem() {
	beginRemoveRows(QModelIndex(), this->rowCount() - 1, this->rowCount() - 1);
	virtualItemShown_ = false;
	endRemoveRows();
}

QString FolderModel::indexToId(int index) const {
	return data(this->index(index), IdRole).toString();
}

int FolderModel::idToIndex(const QString &id) const {
	int count = this->rowCount();
	for (int i = 0; i < count; i++) {
		Folder folder = atIndex(i);
		if (folder.value("id").toString() == id) return i;
	}
	return -1;
}

QString FolderModel::lastInsertId() const {
	return lastInsertId_;
}

bool FolderModel::virtualItemShown() const {
	return virtualItemShown_;
}

bool FolderModel::setData(int index, const QVariant &value, int role) {
	return setData(this->index(index), value, role);
}

QHash<int, QByteArray> FolderModel::roleNames() const {
	QHash<int, QByteArray> roles = QAbstractItemModel::roleNames();
	roles[TitleRole] = "title";
	roles[IdRole] = "uuid";
	roles[RawRole] = "raw";
	return roles;
}

void FolderModel::addData(const QString &title) {
	Folder folder;
	folder.setValue("title", title);
	if (!folder.save()) return;

	//cache_.clear();

	lastInsertId_ = folder.id().toString();

//	QVector<int> roles;
//	roles << Qt::DisplayRole;

//	int from = 0;
//	int to = rowCount() - 1;

//	// Necessary to make sure a new item is added to the view, even
//	// though it might not be positioned there due to sorting
//	beginInsertRows(QModelIndex(), to, to);
//	endInsertRows();

//	emit dataChanged(this->index(from), this->index(to), roles);
}

void FolderModel::deleteData(const int index) {
	Folder folder = atIndex(index);
	if (!folder.dispose()) return;

//	cache_.clear();

//	beginRemoveRows(QModelIndex(), index, index);
//	endRemoveRows();

//	QVector<int> roles;
//	roles << Qt::DisplayRole;
//	emit dataChanged(this->index(0), this->index(rowCount() - 1), roles);
}

// TODO: instead of clearing the whole cache every time, the individual items
// could be created/updated/deleted

void FolderModel::dispatcher_folderCreated(const QString &folderId) {
	qDebug() << "FolderModel Folder created" << folderId;

	cache_.clear();

	int from = 0;
	int to = rowCount() - 1;

	QVector<int> roles;
	roles << Qt::DisplayRole;

	// Necessary to make sure a new item is added to the view, even
	// though it might not be positioned there due to sorting
	beginInsertRows(QModelIndex(), to, to);
	endInsertRows();

	emit dataChanged(this->index(from), this->index(to), roles);
}

void FolderModel::dispatcher_folderUpdated(const QString &folderId) {
	qDebug() << "FolderModel Folder udpated" << folderId;

	cache_.clear();

	QVector<int> roles;
	roles << Qt::DisplayRole;
	emit dataChanged(this->index(0), this->index(rowCount() - 1), roles);
}

void FolderModel::dispatcher_folderDeleted(const QString &folderId) {
	qDebug() << "FolderModel Folder deleted" << folderId;

	int index = idToIndex(folderId);
	if (index < 0) return;

	cache_.clear();

	beginRemoveRows(QModelIndex(), index, index);
	endRemoveRows();
}

void FolderModel::dispatcher_allFoldersDeleted() {
	qDebug() << "FolderModel All folders deleted";
	cache_.clear();
	beginResetModel();
	endResetModel();
}
