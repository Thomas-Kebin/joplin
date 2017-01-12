#include "note.h"

using namespace jop;

Note::Note() : Item() {}

Table Note::table() const {
	return jop::NotesTable;
}

bool Note::primaryKeyIsUuid() const {
	return true;
}

bool Note::trackChanges() const {
	return true;
}
