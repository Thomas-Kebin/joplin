# Joplin

Joplin is a free, open source note taking and to-do application, which can handle a large number of notes organised into notebooks. The notes are searchable, can be copied, tagged and modified with your own text editor.

Notes exported from Evernote via .enex files [can be imported](https://joplin.cozic.net/#importing) into Joplin, including the formatted content (which is converted to Markdown), resources (images, attachments, etc.) and complete metadata (geolocation, updated time, created time, etc.). Plain Markdown files can also be imported.

The notes can be [synchronised](#synchronisation) with various targets including the file system (for example with a network directory) or with Microsoft OneDrive. When synchronising the notes, notebooks, tags and other metadata are saved to plain text files which can be easily inspected, backed up and moved around.

<img src="https://joplin.cozic.net/images/ScreenshotTerminal.png" style="max-width: 60%">

# Installation

On macOS:

	brew install joplin

On Linux or Windows (via [WSL](https://msdn.microsoft.com/en-us/commandline/wsl/faq?f=255&MSPPError=-2147217396)):

**Important:** First, [install Node 8+](https://nodejs.org/en/download/package-manager/). Node 8 is LTS but not yet available everywhere so you might need to manually install it.

	NPM_CONFIG_PREFIX=~/.joplin-bin npm install -g joplin
	sudo ln -s ~/.joplin-bin/bin/joplin /usr/bin/joplin

By default, the application binary will be installed under `~/.joplin-bin`. You may change this directory if needed. Alternatively, if your npm permissions are setup as described [here](https://docs.npmjs.com/getting-started/fixing-npm-permissions#option-2-change-npms-default-directory-to-another-directory) (Option 2) then simply running `npm -g install joplin` would work.

To start it, type `joplin`.

# Demo

The demo application shows various Wikipedia articles converted to Markdown and organised into notebooks, as well as an example to-do list, in order to test and demonstrate the application. The demo application and its settings will be installed in a separate directory so as not to interfere with any existing Joplin application.

	npm install -g demo-joplin

To start it, type `demo-joplin`.

# Usage

To start the application type `joplin`. This will open the user interface, which has three main panes: Notebooks, Notes and the text of the current note. There are also additional panels that can be toggled on and off via [shortcuts](#shortcuts).

<img src="https://joplin.cozic.net/images/ScreenshotTerminalCaptions.png" height="450px">

## Input modes

Joplin user interface is partly based on the text editor Vim and offers two different modes to interact with the notes and notebooks:

### Normal mode

Allows moving from one pane to another using the `Tab` and `Shift-Tab` keys, and to select/view notes using the arrow keys. Text area can be scrolled using the arrow keys too. Press `Enter` to edit a note. Various other [shortcuts](#shortcuts) are available.

### Command-line mode

Press `:` to enter command line mode. From there, the Joplin commands such as `mknote` or `search` are available. See the [full list of commands](#commands).

It is possible to refer to a note or notebook by title or ID. However the simplest way is to refer to the currently selected item using one of these shortcuts:

Shortcut | Description
---------|------------
`$n`     | Refers to the currently selected note
`$b`     | Refers to the currently selected notebook
`$c`     | Refers to the currently selected item. For example, if the note list is current active, `$c` will refer to the currently selected note.

**Examples:**

Create a new note with title "Wednesday's meeting":

	mknote "Wednesday's meeting"

Create a new to-do:

	mktodo "Buy bread"

Move the currently selected note ($n) to the notebook with title "Personal"

	mv $n "Personal"

Rename the currently selected notebook ($b) to "Something":

	ren $b "Something"

Attach a local file to the currently selected note ($n):

	attach $n /home/laurent/pictures/Vacation12.jpg

The configuration can also be changed from command-line mode. For example, to change the current editor to Sublime Text:

	config editor "subl -w"

## Editing a note

To edit a note, select it and press `ENTER`. Or, in command-line mode, type `edit $n` to edit the currently selected note, or `edit "Note title"` to edit a particular note.

## Getting help

The complete usage information is available from command-line mode, by typing one of these commands:

Command | Description
--------|-------------------
`help`  | General help information
`help keymap` | Lists the available shortcuts
`help [command]` | Displays information about a particular command

If the help is not fully visible, press `Tab` multiple times till the console is in focus and use the arrow keys or page up/down to scroll the text.

For general information relevant to all the applications, see also [Joplin home page](https://joplin.cozic.net).

# Importing notes from Evernote

To import Evernote data, follow these steps:

* First, export your Evernote notebooks to ENEX files as described [here](https://help.evernote.com/hc/en-us/articles/209005557-How-to-back-up-export-and-restore-import-notes-and-notebooks).
* In Joplin, in [command-line mode](#command-line-mode), type `import /path/to/file.enex`. This will import the notes into a new notebook named after the filename.
* Then repeat the process for each notebook that needs to be imported.

# Synchronisation

One of the goals of Joplin was to avoid being tied to any particular company or service, whether it is Evernote, Google or Microsoft. As such the synchronisation is designed without any hard dependency to any particular service. Most of the synchronisation process is done at an abstract level and access to external services, such as Nextcloud or OneDrive, is done via lightweight drivers. It is easy to support new services by creating simple drivers that provide a filesystem-like interface, i.e. the ability to read, write, delete and list items. It is also simple to switch from one service to another or to even sync to multiple services at once. Each note, notebook, tags, as well as the relation between items is transmitted as plain text files during synchronisation, which means the data can also be moved to a different application, can be easily backed up, inspected, etc.

Currently, synchronisation is possible with Nextcloud and OneDrive (by default) or the local filesystem. A Dropbox one will also be available once [this React Native bug](https://github.com/facebook/react-native/issues/14445) is fixed. To setup synchronisation please follow the instructions below. After that, the application will synchronise in the background whenever it is running, or you can click on "Synchronise" to start a synchronisation manually.

## Nextcloud synchronisation

You will need to set the `sync.target` config variable and all the `sync.5.path`, `sync.5.username` and `sync.5.password` config variables to, respectively the Nextcloud WebDAV URL, your username and your password. This can be done from the command line mode using:

	:config sync.target 5
	:config sync.5.path https://example.com/nextcloud/remote.php/dav/files/USERNAME/
	:config sync.5.username YOUR_USERNAME
	:config sync.5.password YOUR_PASSWORD

If synchronisation does not work, please consult the logs in the app profile directory (`~/.config/joplin`)- it is often due to a misconfigured URL or password. The log should indicate what the exact issue is.

## WebDAV synchronisation

Select the "WebDAV" synchronisation target and follow the same instructions as for Nextcloud above.

## OneDrive synchronisation

When syncing with OneDrive, Joplin creates a sub-directory in OneDrive, in /Apps/Joplin and read/write the notes and notebooks from it. The application does not have access to anything outside this directory.

To initiate the synchronisation process, type `:sync`. You will be asked to follow a link to authorise the application (simply input your Microsoft credentials - you do not need to register with OneDrive). It is possible to also synchronise outside of the user interface by typing `joplin sync` from the terminal. This can be used to setup a cron script to synchronise at regular interval. For example, this would do it every 30 minutes:

	*/30 * * * * /path/to/joplin sync

# URLs

When Ctrl+Clicking a URL, most terminals will open that URL in the default browser. However, one issue, especially with long URLs, is that they can end up like this:

<img src="https://joplin.cozic.net/images/UrlCut.png" width="300px">

Not only it makes the text hard to read, but the link, being cut in two, will also not be clickable.

As a solution Joplin tries to start a mini-server in the background and, if successful, all the links will be converted to a much shorter URL:

<img src="https://joplin.cozic.net/images/UrlNoCut.png" width="300px">

Since this is still an actual URL, the terminal will still make it clickable. And with shorter URLs, the text is more readable and the links unlikely to be cut. Both resources (files that are attached to notes) and external links are handled in this way.

# Attachments / Resources

In Markdown, links to resources are represented as a simple ID to the resource. In order to give access to these resources, they will be, like links, converted to local URLs. Clicking this link will then open a browser, which will handle the file - i.e. display the image, open the PDF file, etc.

# Shell mode

Commands can also be used directly from a shell. To view the list of available commands, type `joplin help all`. To reference a note, notebook or tag you can either use the ID (type `joplin ls -l` to view the ID) or by title.

For example, this will create a new note "My note" in the notebook "My notebook":

	$ joplin mkbook "My notebook"
	$ joplin use "My notebook"
	$ joplin mknote "My note"

To view the newly created note:

	$ joplin ls -l
	fe889 07/12/2017 17:57 My note

Give a new title to the note:

	$ joplin set fe889 title "New title"

# Shortcuts

There are two types of shortcuts: those that manipulate the user interface directly, such as `TAB` to move from one pane to another, and those that are simply shortcuts to actual commands. In a way similar to Vim, these shortcuts are generally a verb followed by an object. For example, typing `mn` ([m]ake [n]ote), is used to create a new note: it will switch the interface to command line mode and pre-fill it with `mknote ""` from where the title of the note can be entered. See below for the full list of default shortcuts:

	:                 enter_command_line_mode
	TAB               focus_next
	SHIFT_TAB         focus_previous
	UP                move_up
	DOWN              move_down
	PAGE_UP           page_up
	PAGE_DOWN         page_down
	ENTER             activate
	DELETE, BACKSPACE delete
	(SPACE)           todo toggle $n
	tc                toggle_console
	tm                toggle_metadata
	/                 search ""
	mn                mknote ""
	mt                mktodo ""
	mb                mkbook ""
	yn                cp $n ""
	dn                mv $n ""

Shortcut can be configured by adding a keymap file to the profile directory in `~/.config/joplin/keymap.json`. The content of this file is a JSON array with each entry defining a command and the keys associated with it.

As an example, this is the default keymap, but read below for a detailed explanation of each property.

```json
[
	{ "keys": [":"], "type": "function", "command": "enter_command_line_mode" },
	{ "keys": ["TAB"], "type": "function", "command": "focus_next" },
	{ "keys": ["SHIFT_TAB"], "type": "function", "command": "focus_previous" },
	{ "keys": ["UP"], "type": "function", "command": "move_up" },
	{ "keys": ["DOWN"], "type": "function", "command": "move_down" },
	{ "keys": ["PAGE_UP"], "type": "function", "command": "page_up" },
	{ "keys": ["PAGE_DOWN"], "type": "function", "command": "page_down" },
	{ "keys": ["ENTER"], "type": "function", "command": "activate" },
	{ "keys": ["DELETE", "BACKSPACE"], "type": "function", "command": "delete" },
	{ "keys": [" "], "command": "todo toggle $n" },
	{ "keys": ["tc"], "type": "function", "command": "toggle_console" },
	{ "keys": ["tm"], "type": "function", "command": "toggle_metadata" },
	{ "keys": ["/"], "type": "prompt", "command": "search \"\"", "cursorPosition": -2 },
	{ "keys": ["mn"], "type": "prompt", "command": "mknote \"\"", "cursorPosition": -2 },
	{ "keys": ["mt"], "type": "prompt", "command": "mktodo \"\"", "cursorPosition": -2 },
	{ "keys": ["mb"], "type": "prompt", "command": "mkbook \"\"", "cursorPosition": -2 },
	{ "keys": ["yn"], "type": "prompt", "command": "cp $n \"\"", "cursorPosition": -2 },
	{ "keys": ["dn"], "type": "prompt", "command": "mv $n \"\"", "cursorPosition": -2 }
]
```

Each entry can have the following properties:

Name | Description
-----|------------
`keys` | The array of keys that will trigger the action. Special keys such as page up, down arrow, etc. needs to be specified UPPERCASE. See the [list of available special keys](https://github.com/cronvel/terminal-kit/blob/3114206a9556f518cc63abbcb3d188fe1995100d/lib/termconfig/xterm.js#L531). For example, `['DELETE', 'BACKSPACE']` means the command will run if the user pressed either the delete or backspace key. Key combinations can also be provided - in that case specify them lowercase. For example "tc" means that the command will be executed when the user pressed "t" then "c". Special keys can also be used in this fashion - simply write them one after the other. For instance, `CTRL_WCTRL_W` means the action would be executed if the user pressed "ctrl-w ctrl-w".
`type` | The command type. It can have the value "exec", "function" or "prompt". **exec**: Simply execute the provided [command](#commands). For example `edit $n` would edit the selected note. **function**: Run a special commands (see below for the list of functions). **prompt**: A bit similar to "exec", except that the command is not going to be executed immediately - this allows the user to provide additional data. For example `mknote ""` would fill the command line with this command and allow the user to set the title. A prompt command can also take a `cursorPosition` parameter (see below)
`command` | The command that needs to be executed
`cusorPosition` | An integer. For prompt commands, tells where the cursor (caret) should start at. This is convenient for example to position the cursor between quotes. Use a negative value to set a position starting from the end. A value of "0" means positioning the caret at the first character. A value of "-1" means positioning it at the end.

This is the list of special functions:

Name | Description
-----|------------
enter_command_line_mode | Enter command line mode
focus_next | Focus next pane (or widget)
focus_previous | Focus previous pane (or widget)
move_up | Move up (in a list for example)
move_down | Move down (in a list for example)
page_up | Page up
page_down | Page down
activate | Activates the selected item. If the item is a note for example it will be open in the editor
delete | Deletes the selected item
toggle_console | Toggle the console
toggle_metadata | Toggle note metadata

# Commands

The following commands are available in [command-line mode](#command-line-mode):

	attach <note> <file>

	    Attaches the given file to the note.

	cat <note>

	    Displays the given note.

	    -v, --verbose  Displays the complete information about note.

	config [name] [value]

	    Gets or sets a config value. If [value] is not provided, it will show the 
	    value of [name]. If neither [name] nor [value] is provided, it will list 
	    the current configuration.

	    -v, --verbose  Also displays unset and hidden config variables.

	Possible keys/values:

	    editor                   Text editor.
	                             The editor that will be used to open a note. If 
	                             none is provided it will try to auto-detect the 
	                             default editor.
	                             Type: string.
	                             
	    locale                   Language.
	                             Type: Enum.
	                             Possible values: eu (Basque), hr_HR (Croatian), 
	                             cs_CZ (Czech), da_DK (Dansk), de_DE (Deutsch), 
	                             en_GB (English), es_ES (Español), fr_FR 
	                             (Français), gl_ES (Galician), it_IT (Italiano), 
	                             nl_BE (Nederlands), pt_BR (Português (Brasil)), 
	                             ru_RU (Русский), zh_CN (中文 (简体)), ja_JP (日本語).
	                             Default: "en_GB"
	                             
	    dateFormat               Date format.
	                             Type: Enum.
	                             Possible values: DD/MM/YYYY (30/01/2017), 
	                             DD/MM/YY (30/01/17), MM/DD/YYYY (01/30/2017), 
	                             MM/DD/YY (01/30/17), YYYY-MM-DD (2017-01-30).
	                             Default: "DD/MM/YYYY"
	                             
	    timeFormat               Time format.
	                             Type: Enum.
	                             Possible values: HH:mm (20:30), h:mm A (8:30 PM).
	                             Default: "HH:mm"
	                             
	    uncompletedTodosOnTop    Uncompleted to-dos on top.
	                             Type: bool.
	                             Default: true
	                             
	    notes.sortOrder.field    Sort notes by.
	                             Type: Enum.
	                             Possible values: user_updated_time (Updated 
	                             date), user_created_time (Created date), title 
	                             (Title).
	                             Default: "user_updated_time"
	                             
	    notes.sortOrder.reverse  Reverse sort order.
	                             Type: bool.
	                             Default: true
	                             
	    trackLocation            Save geo-location with notes.
	                             Type: bool.
	                             Default: true
	                             
	    sync.interval            Synchronisation interval.
	                             Type: Enum.
	                             Possible values: 0 (Disabled), 300 (5 minutes), 
	                             600 (10 minutes), 1800 (30 minutes), 3600 (1 
	                             hour), 43200 (12 hours), 86400 (24 hours).
	                             Default: 300
	                             
	    sync.target              Synchronisation target.
	                             The target to synchonise to. Each sync target may 
	                             have additional parameters which are named as 
	                             `sync.NUM.NAME` (all documented below).
	                             Type: Enum.
	                             Possible values: 2 (File system), 3 (OneDrive), 4 
	                             (OneDrive Dev (For testing only)), 5 (Nextcloud), 
	                             6 (WebDAV), 7 (Dropbox).
	                             Default: 7
	                             
	    sync.2.path              Directory to synchronise with (absolute path).
	                             The path to synchronise with when file system 
	                             synchronisation is enabled. See `sync.target`.
	                             Type: string.
	                             
	    sync.5.path              Nextcloud WebDAV URL.
	                             Type: string.
	                             
	    sync.5.username          Nextcloud username.
	                             Type: string.
	                             
	    sync.5.password          Nextcloud password.
	                             Type: string.
	                             
	    sync.6.path              WebDAV URL.
	                             Type: string.
	                             
	    sync.6.username          WebDAV username.
	                             Type: string.
	                             
	    sync.6.password          WebDAV password.
	                             Type: string.

	cp <note> [notebook]

	    Duplicates the notes matching <note> to [notebook]. If no notebook is 
	    specified the note is duplicated in the current notebook.

	done <note>

	    Marks a to-do as done.

	e2ee <command> [path]

	    Manages E2EE configuration. Commands are `enable`, `disable`, `decrypt`, 
	    `status` and `target-status`.

	    -p, --password <password>  Use this password as master password (For 
	                               security reasons, it is not recommended to use 
	                               this option).
	    -v, --verbose              More verbose output for the `target-status` 
	                               command

	edit <note>

	    Edit note.

	export <path>

	    Exports Joplin data to the given path. By default, it will export the 
	    complete database including notebooks, notes, tags and resources.

	    --format <format>      Destination format: jex (Joplin Export File), raw 
	                           (Joplin Export Directory)
	    --note <note>          Exports only the given note.
	    --notebook <notebook>  Exports only the given notebook.

	geoloc <note>

	    Displays a geolocation URL for the note.

	help [command]

	    Displays usage information.

	import <path> [notebook]

	    Imports data into Joplin.

	    --format <format>  Source format: auto, jex, md, raw, enex
	    -f, --force        Do not ask for confirmation.

	mkbook <new-notebook>

	    Creates a new notebook.

	mknote <new-note>

	    Creates a new note.

	mktodo <new-todo>

	    Creates a new to-do.

	mv <note> [notebook]

	    Moves the notes matching <note> to [notebook].

	ren <item> <name>

	    Renames the given <item> (note or notebook) to <name>.

	rmbook <notebook>

	    Deletes the given notebook.

	    -f, --force  Deletes the notebook without asking for confirmation.

	rmnote <note-pattern>

	    Deletes the notes matching <note-pattern>.

	    -f, --force  Deletes the notes without asking for confirmation.

	set <note> <name> [value]

	    Sets the property <name> of the given <note> to the given [value]. 
	    Possible properties are:

	    parent_id (text), title (text), body (text), created_time (int), 
	    updated_time (int), is_conflict (int), latitude (numeric), longitude 
	    (numeric), altitude (numeric), author (text), source_url (text), is_todo 
	    (int), todo_due (int), todo_completed (int), source (text), 
	    source_application (text), application_data (text), order (int), 
	    user_created_time (int), user_updated_time (int), encryption_cipher_text 
	    (text), encryption_applied (int)

	status

	    Displays summary about the notes and notebooks.

	sync

	    Synchronises with remote storage.

	    --target <target>  Sync to provided target (defaults to sync.target config 
	                       value)

	tag <tag-command> [tag] [note]

	    <tag-command> can be "add", "remove" or "list" to assign or remove [tag] 
	    from [note], or to list the notes associated with [tag]. The command `tag 
	    list` can be used to list all the tags.

	todo <todo-command> <note-pattern>

	    <todo-command> can either be "toggle" or "clear". Use "toggle" to toggle 
	    the given to-do between completed and uncompleted state (If the target is 
	    a regular note it will be converted to a to-do). Use "clear" to convert 
	    the to-do back to a regular note.

	undone <note>

	    Marks a to-do as non-completed.

	use <notebook>

	    Switches to [notebook] - all further operations will happen within this 
	    notebook.

	version

	    Displays version information

# License

Copyright (c) 2016-2018 Laurent Cozic

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
