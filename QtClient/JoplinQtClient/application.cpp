#include "application.h"

#include "models/folder.h"
#include "database.h"
#include "models/foldermodel.h"
#include "services/folderservice.h"
#include "settings.h"

using namespace jop;

Application::Application(int &argc, char **argv) :
    QGuiApplication(argc, argv),
    db_("D:/Web/www/joplin/QtClient/data/notes.sqlite"),
    api_("http://joplin.local"),
    synchronizer_(api_, db_),
    folderCollection_(db_, 0, "title ASC"),
    folderModel_(db_)

    {

	// This is linked to where the QSettings will be saved. In other words,
	// if these values are changed, the settings will be reset and saved
	// somewhere else.
	QCoreApplication::setOrganizationName("Cozic");
	QCoreApplication::setOrganizationDomain("cozic.net");
	QCoreApplication::setApplicationName("Joplin");

	Settings settings;

	//folderCollection_ = FolderCollection(db_, 0, "title ASC");

	folderService_ = FolderService(db_);
	//folderModel_.setService(folderService_);
	//folderModel_.setCollection(folderCollection_);

	noteService_ = NoteService(db_);
	noteModel_.setService(noteService_);

	view_.setResizeMode(QQuickView::SizeRootObjectToView);
	QQmlContext *ctxt = view_.rootContext();
	ctxt->setContextProperty("folderListModel", &folderModel_);
	ctxt->setContextProperty("noteListModel", &noteModel_);
	ctxt->setContextProperty("noteModel", &selectedQmlNote_);

	view_.setSource(QUrl("qrc:/main.qml"));

	QObject* rootObject = (QObject*)view_.rootObject();

	connect(rootObject, SIGNAL(currentFolderChanged()), this, SLOT(view_currentFolderChanged()));
	connect(rootObject, SIGNAL(currentNoteChanged()), this, SLOT(view_currentNoteChanged()));

	view_.show();

	connect(&api_, SIGNAL(requestDone(const QJsonObject&, const QString&)), this, SLOT(api_requestDone(const QJsonObject&, const QString&)));

	QString sessionId = settings.value("sessionId").toString();
	if (sessionId == "") {
		QUrlQuery postData;
		postData.addQueryItem("email", "laurent@cozic.net");
		postData.addQueryItem("password", "12345678");
		postData.addQueryItem("client_id", "B6E12222B6E12222");
		api_.post("sessions", QUrlQuery(), postData, "getSession");
	} else {
		afterSessionInitialization();
	}
}

void Application::api_requestDone(const QJsonObject& response, const QString& tag) {
	// TODO: handle errors

	if (tag == "getSession") {
		QString sessionId = response.value("id").toString();
		Settings settings;
		settings.setValue("sessionId", sessionId);
		afterSessionInitialization();
		return;
	}
}

QString Application::selectedFolderId() const {
	QObject* rootObject = (QObject*)view_.rootObject();

	int index = rootObject->property("currentFolderIndex").toInt();
	QModelIndex modelIndex = folderModel_.index(index);
	return folderModel_.data(modelIndex, FolderModel::IdRole).toString();
}

QString Application::selectedNoteId() const {
	QObject* rootObject = (QObject*)view_.rootObject();

	int index = rootObject->property("currentNoteIndex").toInt();
	QModelIndex modelIndex = noteModel_.index(index);
	return noteModel_.data(modelIndex, NoteModel::IdRole).toString();
}

void Application::afterSessionInitialization() {
	// TODO: rather than saving the session id, save the username/password and
	// request a new session everytime on startup.

	Settings settings;
	QString sessionId = settings.value("sessionId").toString();
	qDebug() << "Session:" << sessionId;
	api_.setSessionId(sessionId);
	//synchronizer_.start();
}

void Application::view_currentFolderChanged() {
	QString folderId = selectedFolderId();
	noteCollection_ = NoteCollection(db_, folderId, "title ASC");
	noteModel_.setCollection(noteCollection_);
}

void Application::view_currentNoteChanged() {
	QString noteId = selectedNoteId();
	Note note = noteCollection_.byId(noteId);
	selectedQmlNote_.setNote(note);
}

void Application::view_addNoteButtonClicked() {
	qDebug() << "ici";
}

void Application::view_addFolderButtonClicked() {

}
