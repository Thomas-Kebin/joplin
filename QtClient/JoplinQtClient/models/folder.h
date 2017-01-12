#ifndef FOLDER_H
#define FOLDER_H

#include <stable.h>
#include "models/item.h"
#include "models/note.h"

namespace jop {

class Folder : public Item {

public:

	Folder();

	static int count();
	static QVector<Folder> all(const QString& orderBy);

	Table table() const;
	bool primaryKeyIsUuid() const;
	bool trackChanges() const;
	int noteCount() const;
	QVector<Note> notes(const QString& orderBy, int limit, int offset) const;
	int noteIndexById(const QString& orderBy, const QString &id) const;

};

}

#endif // FOLDER_H
