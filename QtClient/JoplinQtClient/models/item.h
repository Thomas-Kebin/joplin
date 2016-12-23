#ifndef ITEM_H
#define ITEM_H

#include <stable.h>

namespace jop {

class Item {

public:

	Item();

	QString id() const;
	QString title() const;
	int createdTime() const;
	bool isPartial() const;

	void setId(const QString &v);
	void setTitle(const QString& v);
	void setCreatedTime(int v);
	void setIsPartial(bool v);

	void fromSqlQuery(const QSqlQuery& query);

private:

	QString id_;
	QString title_;
	int createdTime_;
	bool isPartial_;

};

}

#endif // ITEM_H
