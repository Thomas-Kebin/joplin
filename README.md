# Joplin

[![Donate](https://joplinapp.org/images/badges/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=E8JMYD2LQ8MMA&lc=GB&item_name=Joplin+Development&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHosted) [![Become a patron](https://joplinapp.org/images/badges/Patreon-Badge.svg)](https://www.patreon.com/joplin)

* * *
[Hacktoberfest 🎃](https://hacktoberfest.digitalocean.com/) is back this year again for our great pleasure ^^

To participate go to [https://hacktoberfest.digitalocean.com/](https://hacktoberfest.digitalocean.com/), log in (with you GitHub account) and you are ready to get in. Next, go dive into the Joplin issues list labelled "[Hacktoberfest](https://github.com/laurent22/joplin/labels/hacktoberfest)"

Start hacking, submit the PR from the 1st of October, not before.

We hope you will enjoy that event this year again like the previous one 🎃🎉

*PS: the 4 Pull Request don’t have to be done **only** on Joplin project, those can be done on any FOSS projects. Even PR for issue not tagged as 'hacktoberfest'*
* * *

Joplin is a free, open source note taking and to-do application, which can handle a large number of notes organised into notebooks. The notes are searchable, can be copied, tagged and modified either from the applications directly or from your own text editor. The notes are in [Markdown format](#markdown).

Notes exported from Evernote via .enex files [can be imported](#importing) into Joplin, including the formatted content (which is converted to Markdown), resources (images, attachments, etc.) and complete metadata (geolocation, updated time, created time, etc.). Plain Markdown files can also be imported.

The notes can be [synchronised](#synchronisation) with various cloud services including [Nextcloud](https://nextcloud.com/), Dropbox, OneDrive, WebDAV or the file system (for example with a network directory). When synchronising the notes, notebooks, tags and other metadata are saved to plain text files which can be easily inspected, backed up and moved around.

The application is available for Windows, Linux, macOS, Android and iOS (the terminal app also works on FreeBSD). A [Web Clipper](https://github.com/laurent22/joplin/blob/master/readme/clipper.md), to save web pages and screenshots from your browser, is also available for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/joplin-web-clipper/) and [Chrome](https://chrome.google.com/webstore/detail/joplin-web-clipper/alofnhikmmkdbbbgpnglcpdollgjjfek?hl=en-GB).

<div class="top-screenshot"><img src="https://joplinapp.org/images/AllClients.jpg" style="max-width: 100%; max-height: 35em;"></div>

# Installation

Three types of applications are available: for the **desktop** (Windows, macOS and Linux), for **mobile** (Android and iOS) and for **terminal** (Windows, macOS, Linux and FreeBSD). All applications have similar user interfaces and can synchronise with each other.

## Desktop applications

Operating System | Download | Alternative
-----------------|--------|-------------------
Windows (32 and 64-bit)         | <a href='https://github.com/laurent22/joplin/releases/download/v1.0.170/Joplin-Setup-1.0.170.exe'><img alt='Get it on Windows' width="134px" src='https://joplinapp.org/images/BadgeWindows.png'/></a> | Or get the <a href='https://github.com/laurent22/joplin/releases/download/v1.0.170/JoplinPortable.exe'>Portable version</a><br><br>The [portable application](https://en.wikipedia.org/wiki/Portable_application) allows installing the software on a portable device such as a USB key. Simply copy the file JoplinPortable.exe in any directory on that USB key ; the application will then create a directory called "JoplinProfile" next to the executable file.
macOS          | <a href='https://github.com/laurent22/joplin/releases/download/v1.0.170/Joplin-1.0.170.dmg'><img alt='Get it on macOS' width="134px" src='https://joplinapp.org/images/BadgeMacOS.png'/></a> | You can also use Homebrew: `brew cask install joplin`
Linux          | <a href='https://github.com/laurent22/joplin/releases/download/v1.0.170/Joplin-1.0.170-x86_64.AppImage'><img alt='Get it on Linux' width="134px" src='https://joplinapp.org/images/BadgeLinux.png'/></a> | An Arch Linux package [is also available](#terminal-application).<br><br>If it works with your distribution (it has been tested on Ubuntu, Fedora, Gnome and Mint), the recommended way is to use this script as it will handle the desktop icon too:<br><br> `wget -O - https://raw.githubusercontent.com/laurent22/joplin/master/Joplin_install_and_update.sh \| bash`

## Mobile applications

Operating System | Download | Alt. Download
-----------------|----------|----------------
Android          | <a href='https://play.google.com/store/apps/details?id=net.cozic.joplin&utm_source=GitHub&utm_campaign=README&pcampaignid=MKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1'><img alt='Get it on Google Play' height="40px" src='https://joplinapp.org/images/BadgeAndroid.png'/></a> | or download the APK file: [64-bit](https://github.com/laurent22/joplin-android/releases/download/android-v1.0.309/joplin-v1.0.309.apk) [32-bit](https://github.com/laurent22/joplin-android/releases/download/android-v1.0.309/joplin-v1.0.309-32bit.apk)
iOS              | <a href='https://itunes.apple.com/us/app/joplin/id1315599797'><img alt='Get it on the App Store' height="40px" src='https://joplinapp.org/images/BadgeIOS.png'/></a> | -

## Terminal application

Operating system | Method
-----------------|----------------
macOS            | `brew install joplin`
Linux or Windows (via [WSL](https://msdn.microsoft.com/en-us/commandline/wsl/faq?f=255&MSPPError=-2147217396)) | **Important:** First, [install Node 8+](https://nodejs.org/en/download/package-manager/).<br/><br/>`NPM_CONFIG_PREFIX=~/.joplin-bin npm install -g joplin`<br/>`sudo ln -s ~/.joplin-bin/bin/joplin /usr/bin/joplin`<br><br>By default, the application binary will be installed under `~/.joplin-bin`. You may change this directory if needed. Alternatively, if your npm permissions are setup as described [here](https://docs.npmjs.com/getting-started/fixing-npm-permissions#option-2-change-npms-default-directory-to-another-directory) (Option 2) then simply running `npm -g install joplin` would work.
Arch Linux | An Arch Linux package is available [here](https://aur.archlinux.org/packages/joplin/). To install it, use an AUR wrapper such as yay: `yay -S joplin`. Both the CLI tool (type `joplin`) and desktop app (type `joplin-desktop`) are packaged. You can also install a compiled version with the [chaotic-aur](https://wiki.archlinux.org/index.php/Unofficial_user_repositories#chaotic-aur) repository. For support, please go to the [GitHub repo](https://github.com/masterkorp/joplin-pkgbuild).

To start it, type `joplin`.

For usage information, please refer to the full [Joplin Terminal Application Documentation](https://joplinapp.org/terminal/).

## Web Clipper

The Web Clipper is a browser extension that allows you to save web pages and screenshots from your browser. For more information on how to install and use it, see the [Web Clipper Help Page](https://github.com/laurent22/joplin/blob/master/readme/clipper.md).

<!-- TOC -->
# Table of contents

- Applications

	- [Desktop application](https://github.com/laurent22/joplin/blob/master/readme/desktop.md)
	- [Mobile applications](https://github.com/laurent22/joplin/blob/master/readme/mobile.md)
	- [Terminal application](https://github.com/laurent22/joplin/blob/master/readme/terminal.md)
	- [Web Clipper](https://github.com/laurent22/joplin/blob/master/readme/clipper.md)

- Support

	- [Joplin Forum](https://discourse.joplinapp.org)
	- [Markdown Guide](https://github.com/laurent22/joplin/blob/master/readme/markdown.md)
	- [How to enable end-to-end encryption](https://github.com/laurent22/joplin/blob/master/readme/e2ee.md)
	- [End-to-end encryption spec](https://github.com/laurent22/joplin/blob/master/readme/spec.md)
	- [How to enable debug mode](https://github.com/laurent22/joplin/blob/master/readme/debugging.md)
	- [API documentation](https://github.com/laurent22/joplin/blob/master/readme/api.md)
	- [FAQ](https://github.com/laurent22/joplin/blob/master/readme/faq.md)

- About

	- [Changelog (Desktop App)](https://github.com/laurent22/joplin/blob/master/readme/changelog.md)
	- [Changelog (CLI App)](https://github.com/laurent22/joplin/blob/master/readme/changelog_cli.md)
	- [Stats](https://github.com/laurent22/joplin/blob/master/readme/stats.md)
	- [Donate](https://github.com/laurent22/joplin/blob/master/readme/donate.md)
<!-- TOC -->

# Features

- Desktop, mobile and terminal applications.
- [Web Clipper](https://github.com/laurent22/joplin/blob/master/readme/clipper.md) for Firefox and Chrome.
- End To End Encryption (E2EE)
- Note history (revisions)
- Synchronisation with various services, including NextCloud, Dropbox, WebDAV and OneDrive.
- Import Enex files (Evernote export format) and Markdown files.
- Export JEX files (Joplin Export format) and raw files.
- Support notes, to-dos, tags and notebooks.
- Goto Anything feature.
- Sort notes by multiple criteria - title, updated time, etc.
- Support for alarms (notifications) in mobile and desktop applications.
- Offline first, so the entire data is always available on the device even without an internet connection.
- Markdown notes, which are rendered with images and formatting in the desktop and mobile applications. Support for extra features such as math notation and checkboxes.
- File attachment support - images are displayed, and other files are linked and can be opened in the relevant application.
- Search functionality.
- Geo-location support.
- Supports multiple languages
- External editor support - open notes in your favorite external editor with one click in Joplin.

# Importing

## Importing from Evernote

Joplin was designed as a replacement for Evernote and so can import complete Evernote notebooks, as well as notes, tags, resources (attached files) and note metadata (such as author, geo-location, etc.) via ENEX files. In terms of data, the only two things that might slightly differ are:

- Recognition data - Evernote images, in particular scanned (or photographed) documents have [recognition data](https://en.wikipedia.org/wiki/Optical_character_recognition) associated with them. It is the text that Evernote has been able to recognise in the document. This data is not preserved when the note are imported into Joplin. However, should it become supported in the search tool or other parts of Joplin, it should be possible to regenerate this recognition data since the actual image would still be available.

- Colour, font sizes and faces - Evernote text is stored as HTML and this is converted to Markdown during the import process. For notes that are mostly plain text or with basic formatting (bold, italic, bullet points, links, etc.) this is a lossless conversion, and the note, once rendered back to HTML should be very similar. Tables are also imported and converted to Markdown tables. For very complex notes, some formatting data might be lost - in particular colours, font sizes and font faces will not be imported. The text itself however is always imported in full regardless of formatting.

To import Evernote data, first export your Evernote notebooks to ENEX files as described [here](https://help.evernote.com/hc/en-us/articles/209005557-How-to-back-up-export-and-restore-import-notes-and-notebooks). Then follow these steps:

In the **desktop application**, open File > Import > ENEX and select your file. The notes will be imported into a new separate notebook. If needed they can then be moved to a different notebook, or the notebook can be renamed, etc.

In the **terminal application**, in [command-line mode](https://github.com/laurent22/joplin/blob/master/readme/terminal.md#command-line-mode), type `import /path/to/file.enex`. This will import the notes into a new notebook named after the filename.

## Importing from Markdown files

Joplin can import notes from plain Markdown file. You can either import a complete directory of Markdown files or individual files.

In the **desktop application**, open File > Import > MD and select your Markdown file or directory.

In the **terminal application**, in [command-line mode](https://github.com/laurent22/joplin/blob/master/readme/terminal.md#command-line-mode), type `import --format md /path/to/file.md` or `import --format md /path/to/directory/`.

## Importing from other applications

In general the way to import notes from any application into Joplin is to convert the notes to ENEX files (Evernote format) and to import these ENEX files into Joplin using the method above. Most note-taking applications support ENEX files so it should be relatively straightforward. For help about specific applications, see below:

* Standard Notes: Please see [this tutorial](https://programadorwebvalencia.com/migrate-notes-from-standard-notes-to-joplin/)
* Tomboy Notes: Export the notes to ENEX files [as described here](https://askubuntu.com/questions/243691/how-can-i-export-my-tomboy-notes-into-evernote/608551) for example, and import these ENEX files into Joplin.
* OneNote: First [import the notes from OneNote into Evernote](https://discussion.evernote.com/topic/107736-is-there-a-way-to-import-from-onenote-into-evernote-on-the-mac/). Then export the ENEX file from Evernote and import it into Joplin.
* NixNote: Synchronise with Evernote, then export the ENEX files and import them into Joplin. More info [in this thread](https://discourse.joplinapp.org/t/import-from-nixnote/183/3).

# Exporting

Joplin can export to the JEX format (Joplin Export file), which is a tar file that can contain multiple notes, notebooks, etc. This is a lossless format in that all the notes, but also metadata such as geo-location, updated time, tags, etc. are preserved. This format is convenient for backup purposes and can be re-imported into Joplin. A "raw" format is also available. This is the same as the JEX format except that the data is saved to a directory and each item represented by a single file.

# Synchronisation

One of the goals of Joplin was to avoid being tied to any particular company or service, whether it is Evernote, Google or Microsoft. As such the synchronisation is designed without any hard dependency to any particular service. Most of the synchronisation process is done at an abstract level and access to external services, such as Nextcloud or Dropbox, is done via lightweight drivers. It is easy to support new services by creating simple drivers that provide a filesystem-like interface, i.e. the ability to read, write, delete and list items. It is also simple to switch from one service to another or to even sync to multiple services at once. Each note, notebook, tags, as well as the relation between items is transmitted as plain text files during synchronisation, which means the data can also be moved to a different application, can be easily backed up, inspected, etc.

Currently, synchronisation is possible with Nextcloud, Dropbox (by default), OneDrive or the local filesystem. To setup synchronisation please follow the instructions below. After that, the application will synchronise in the background whenever it is running, or you can click on "Synchronise" to start a synchronisation manually.

## Nextcloud synchronisation

<img src="https://joplinapp.org/images/nextcloud-logo-background.png" width="100" align="left"> <a href="https://nextcloud.com/">Nextcloud</a> is a self-hosted, private cloud solution. It can store documents, images and videos but also calendars, passwords and countless other things and can sync them to your laptop or phone. As you can host your own Nextcloud server, you own both the data on your device and infrastructure used for synchronisation. As such it is a good fit for Joplin. The platform is also well supported and with a strong community, so it is likely to be around for a while - since it's open source anyway, it is not a service that can be closed, it can exist on a server for as long as one chooses.

In the **desktop application** or **mobile application**, go to the config screen and select Nextcloud as the synchronisation target. Then input the WebDAV URL (to get it, click on Settings in the bottom left corner of the page, in Nextcloud), this is normally `https://example.com/nextcloud/remote.php/webdav/Joplin` (**make sure to create the "Joplin" directory in Nextcloud**), and set the username and password. If it does not work, please [see this explanation](https://github.com/laurent22/joplin/issues/61#issuecomment-373282608) for more details.

In the **terminal application**, you will need to set the `sync.target` config variable and all the `sync.5.path`, `sync.5.username` and `sync.5.password` config variables to, respectively the Nextcloud WebDAV URL, your username and your password. This can be done from the command line mode using:

	:config sync.5.path https://example.com/nextcloud/remote.php/webdav/Joplin
	:config sync.5.username YOUR_USERNAME
	:config sync.5.password YOUR_PASSWORD
	:config sync.target 5

If synchronisation does not work, please consult the logs in the app profile directory - it is often due to a misconfigured URL or password. The log should indicate what the exact issue is.

## Dropbox synchronisation

When syncing with Dropbox, Joplin creates a sub-directory in Dropbox, in `/Apps/Joplin` and read/write the notes and notebooks from it. The application does not have access to anything outside this directory.

In the **desktop application** or **mobile application**, select "Dropbox" as the synchronisation target in the config screen (it is selected by default). Then, to initiate the synchronisation process, click on the "Synchronise" button in the sidebar and follow the instructions.

In the **terminal application**, to initiate the synchronisation process, type `:sync`. You will be asked to follow a link to authorise the application. It is possible to also synchronise outside of the user interface by typing `joplin sync` from the terminal. This can be used to setup a cron script to synchronise at regular interval. For example, this would do it every 30 minutes:

	*/30 * * * * /path/to/joplin sync

## WebDAV synchronisation

Select the "WebDAV" synchronisation target and follow the same instructions as for Nextcloud above.

WebDAV-compatible services that are known to work with Joplin:

- [Apache WebDAV Module](https://httpd.apache.org/docs/current/mod/mod_dav.html)
- [Box.com](https://www.box.com/)
- [DriveHQ](https://www.drivehq.com)
- [Fastmail](https://www.fastmail.com/)
- [HiDrive](https://www.strato.fr/stockage-en-ligne/) from Strato. [Setup help](https://github.com/laurent22/joplin/issues/309)
- [Nginx WebDAV Module](https://nginx.org/en/docs/http/ngx_http_dav_module.html)
- [NextCloud](https://nextcloud.com/)
- [OwnCloud](https://owncloud.org/)
- [Seafile](https://www.seafile.com/)
- [Stack](https://www.transip.nl/stack/)
- [WebDAV Nav](https://www.schimera.com/products/webdav-nav-server/), a macOS server.
- [Zimbra](https://www.zimbra.com/)

## OneDrive synchronisation

When syncing with OneDrive, Joplin creates a sub-directory in OneDrive, in /Apps/Joplin and read/write the notes and notebooks from it. The application does not have access to anything outside this directory.

In the **desktop application** or **mobile application**, select "OneDrive" as the synchronisation target in the config screen. Then, to initiate the synchronisation process, click on the "Synchronise" button in the sidebar and follow the instructions.

In the **terminal application**, to initiate the synchronisation process, type `:sync`. You will be asked to follow a link to authorise the application (simply input your Microsoft credentials - you do not need to register with OneDrive).

# Encryption

Joplin supports end-to-end encryption (E2EE) on all the applications. E2EE is a system where only the owner of the notes, notebooks, tags or resources can read them. It prevents potential eavesdroppers - including telecom providers, internet providers, and even the developers of Joplin from being able to access the data. Please see the [End-To-End Encryption Tutorial](https://github.com/laurent22/joplin/blob/master/readme/e2ee.md) for more information about this feature and how to enable it.

For a more technical description, mostly relevant for development or to review the method being used, please see the [Encryption specification](https://github.com/laurent22/joplin/blob/master/readme/spec.md).

# Note history

The Joplin applications automatically save previous versions of your notes at regular intervals. These versions are synced across devices and can be viewed from the desktop application. To do so, click on the "Information" button on a note, then click on "Previous version of this note". From this screen you can view the previous versions of the note as well as restore any of them.

This feature can be disabled from the "Note history" section in the settings, and it is also possible to change for how long the history of a note is saved.

More information about this feature in the [announcement post](https://www.patreon.com/posts/note-history-now-27083082).

# External text editor

Joplin notes can be opened and edited using an external editor of your choice. It can be a simple text editor like Notepad++ or Sublime Text or an actual Markdown editor like Typora. In that case, images will also be displayed within the editor. To open the note in an external editor, click on the icon in the toolbar or press Ctrl+E (or Cmd+E). Your default text editor will be used to open the note. If needed, you can also specify the editor directly in the General Options, under "Text editor command".

# Attachments

Any kind of file can be attached to a note. In Markdown, links to these files are represented as a simple ID to the attachment. In the note viewer, these files, if they are images, will be displayed or, if they are other files (PDF, text files, etc.) they will be displayed as links. Clicking on this link will open the file in the default application.

In the **desktop application**, files can be attached either by clicking the "Attach file" icon in the editor or via drag and drop. If you prefer to create a link to a local file instead, hold the ALT key while performing the drag and drop operation.
If the OS-clipboard contains an image you can directly paste it in the editor via Ctrl+V.

Resources that are not attached to any note will be automatically deleted after 10 days (see [rationale](https://github.com/laurent22/joplin/issues/154#issuecomment-356582366)).

**Important:** Resources larger than 10 MB are not currently supported on mobile. They will crash the application when synchronising so it is recommended not to attach such resources at the moment. The issue is being looked at.

## Downloading attachments

The way the attachments are downloaded during synchronisation can be customised in the Configuration screen, under "Attachment download behaviour". The default option ("Always") is to download all the attachments, all the time, so that the data is available even when the device is offline. There is also the option to download the attachments manually (option "Manual"), by clicking on it, or automatically (Option "Auto"), in which case the attachments are downloaded only when a note is opened. These options should help saving disk space and network bandwidth, especially on mobile.

# Notifications

In the desktop and mobile apps, an alarm can be associated with any to-do. It will be triggered at the given time by displaying a notification. How the notification will be displayed depends on the operating system since each has a different way to handle this. Please see below for the requirements for the desktop applications:

- **Windows**: >= 8. Make sure the Action Center is enabled on Windows. Task bar balloon for Windows < 8. Growl as fallback. Growl takes precedence over Windows balloons.
- **macOS**: >= 10.8 or Growl if earlier.
- **Linux**: `notify-osd` or `libnotify-bin` installed (Ubuntu should have this by default). Growl otherwise

See [documentation and flow chart for reporter choice](https://github.com/mikaelbr/node-notifier/blob/master/DECISION_FLOW.md)

On mobile, the alarms will be displayed using the built-in notification system.

If for any reason the notifications do not work, please [open an issue](https://github.com/laurent22/joplin/issues).

# Sub-notebooks

Sub-notebooks allow organising multiple notebooks into a tree of notebooks. For example it can be used to regroup all the notebooks related to work, to family or to a particular project under a parent notebook.

![](https://joplinapp.org/images/SubNotebooks.png)

- In the **desktop application**, to create a subnotebook, drag and drop it onto another notebook. To move it back to the root, drag and drop it on the "Notebooks" header. Currently only the desktop app can be used to organise the notebooks.
- The **mobile application** supports displaying and collapsing/expanding the tree of notebooks, however it does not currently support moving the subnotebooks to different notebooks.
- The **terminal app** supports displaying the tree of subnotebooks but it does not support collapsing/expanding them or moving the subnotebooks around.

# Markdown

Joplin uses and renders a Github-flavoured Markdown with a few variations and additions. In particular it adds math formula support, interactive checkboxes and support for note links. Joplin also supports Markdown plugins which allow enabling and disabling various advanced Markdown features. Have a look at the [Markdown Guide](https://github.com/laurent22/joplin/blob/master/readme/markdown.md) for more information.

# Custom CSS

Rendered markdown can be customized by placing a userstyle file in the profile directory `~/.config/joplin-desktop/userstyle.css` (This path might be different on your device - check at the top of the Config screen for the exact path). This file supports standard CSS syntax. Joplin ***must*** be restarted for the new css to be applied, please ensure that Joplin is not closing to the tray, but is actually exiting. Note that this file is used only when display the notes, **not when printing or exporting to PDF**. This is because printing has a lot more restrictions (for example, printing white text over a black background is usually not wanted), so special rules are applied to make it look good when printing, and a userstyle.css would interfer with that.

# Note templates

In the **desktop app**, templates can be used to create new notes or to insert into existing ones by creating a `templates` folder in Joplin's config folder and placing Markdown template files into it. For example creating the file `hours.md` in the `templates` directory with the contents:

```markdown
Date: {{date}}
Hours:
Details:
```

Templates can then be inserted from the menu (File->Templates).

The currently supported template variables are:

| Variable | Description | Example |
| --- | --- | --- |
| `{{date}}` | Today's date formatted based on the settings format | 2019-01-01 |
| `{{time}}` | Current time formatted based on the settings format | 13:00 |
| `{{datetime}}` | Current date and time formatted based on the settings format | 01/01/19 1:00 PM |
| `{{#custom_datetime}}` | Current date and/or time formatted based on a supplied string (using [moment.js](https://momentjs.com/) formatting) | `{{#custom_datetime}}M d{{/custom_datetime}}` |

# Searching

Joplin implements the SQLite Full Text Search (FTS4) extension. It means the content of all the notes is indexed in real time and search queries return results very fast. Both [Simple FTS Queries](https://www.sqlite.org/fts3.html#simple_fts_queries) and [Full-Text Index Queries](https://www.sqlite.org/fts3.html#full_text_index_queries) are supported. See below for the list of supported queries:

Search type | Description | Example
------------|-------------|---------
Single word | Returns all the notes that contain this term. | For example, searching for `cat` will return all the notes that contain this exact word. Note: it will not return the notes that contain the substring - thus, for "cat", notes that contain "cataclysmic" or "prevaricate" will **not** be returned.
Multiples words | Returns all the notes that contain **all** these words, but not necessarily next to each other. | `dog cat` - will return any notes that contain the words "dog" and "cat" anywhere in the note, no necessarily in that order nor next to each other. It will **not** return results that contain "dog" or "cat" only.
Phrase query | Add double quotes to return the notes that contain exactly this phrase. | `"shopping list"` - will return the notes that contain these **exact terms** next to each other and in this order. It will **not** return for example a note that contains "going shopping with my list".
Prefix | Add a wildcard to return all the notes that contain a term with a specified prefix. | `swim*` - will return all the notes that contain eg. "swim", but also "swimming", "swimsuit", etc. IMPORTANT: The wildcard **can only be at the end** - it will be ignored at the beginning of a word (eg. `*swim`) and will be treated as a literal asterisk in the middle of a word (eg. `ast*rix`)
Field restricted | Add either `title:` or `body:` before a note to restrict your search to just the title, or just the body. | `title:shopping`, `body:egg`

Notes are sorted by "relevance". Currently it means the notes that contain the requested terms the most times are on top. For queries with multiple terms, it also matters how close to each other the terms are. This is a bit experimental so if you notice a search query that returns unexpected results, please report it in the forum, providing as many details as possible to replicate the issue.

# Goto Anything

In the desktop application, press Ctrl+G or Cmd+G and type the title of a note to jump directly to it. You can also type `#` followed by a tag or `@` followed by a notebook title.

# Donations

Donations to Joplin support the development of the project. Developing quality applications mostly takes time, but there are also some expenses, such as digital certificates to sign the applications, app store fees, hosting, etc. Most of all, your donation will make it possible to keep up the current development standard.

Please see the [donation page](https://github.com/laurent22/joplin/blob/master/readme/donate.md) for information on how to support the development of Joplin.

# Community

- For general discussion about Joplin, user support, software development questions, and to discuss new features, go to the [Joplin Forum](https://discourse.joplinapp.org/). It is possible to login with your GitHub account.
- Also see here for information about [the latest releases and general news](https://discourse.joplinapp.org/c/news).
- For bug reports and feature requests, go to the [GitHub Issue Tracker](https://github.com/laurent22/joplin/issues).
- The latest news are posted [on the Patreon page](https://www.patreon.com/joplin).
- You can also follow us on <a rel="me" href="https://mastodon.social/@joplinapp">the Mastodon feed</a> or [the Twitter feed](https://twitter.com/joplinapp).
- You can join the live community on [the JoplinApp discord server](https://discordapp.com/invite/d2HMPwE) to get help with Joplin or to discuss anything Joplin related.

# Contributing

Please see the guide for information on how to contribute to the development of Joplin: https://github.com/laurent22/joplin/blob/master/CONTRIBUTING.md

# Localisation

Joplin is currently available in the languages below. If you would like to contribute a **new translation**, it is quite straightforward, please follow these steps:

- [Download Poedit](https://poedit.net/), the translation editor, and install it.
- [Download the file to be translated](https://raw.githubusercontent.com/laurent22/joplin/master/CliClient/locales/joplin.pot).
- In Poedit, open this .pot file, go into the Catalog menu and click Configuration. Change "Country" and "Language" to your own country and language.
- From then you can translate the file. Once it is done, please either [open a pull request](https://github.com/laurent22/joplin/pulls) or send the file to [this address](https://raw.githubusercontent.com/laurent22/joplin/master/Assets/AdresseTranslation.png).

This translation will apply to the three applications - desktop, mobile and terminal.

To **update a translation**, follow the same steps as above but instead of getting the .pot file, get the .po file for your language from the table below.

Current translations:

<!-- LOCALE-TABLE-AUTO-GENERATED -->
&nbsp;  |  Language  |  Po File  |  Last translator  |  Percent done
---|---|---|---|---
![](https://joplinapp.org/images/flags/country-4x3/arableague.png)  |  Arabic  |  [ar](https://github.com/laurent22/joplin/blob/master/CliClient/locales/ar.po)  |  عبد الناصر سعيد (as@althobaity.com)  |  83%
![](https://joplinapp.org/images/flags/es/basque_country.png)  |  Basque  |  [eu](https://github.com/laurent22/joplin/blob/master/CliClient/locales/eu.po)  |  juan.abasolo@ehu.eus  |  47%
![](https://joplinapp.org/images/flags/country-4x3/bg.png)  |  Bulgarian  |  [bg_BG](https://github.com/laurent22/joplin/blob/master/CliClient/locales/bg_BG.po)  |    |  91%
![](https://joplinapp.org/images/flags/es/catalonia.png)  |  Catalan  |  [ca](https://github.com/laurent22/joplin/blob/master/CliClient/locales/ca.po)  |  jmontane, 2019  |  72%
![](https://joplinapp.org/images/flags/country-4x3/hr.png)  |  Croatian  |  [hr_HR](https://github.com/laurent22/joplin/blob/master/CliClient/locales/hr_HR.po)  |  Hrvoje Mandić (trbuhom@net.hr)  |  38%
![](https://joplinapp.org/images/flags/country-4x3/cz.png)  |  Czech  |  [cs_CZ](https://github.com/laurent22/joplin/blob/master/CliClient/locales/cs_CZ.po)  |  Lukas Helebrandt (lukas@aiya.cz)  |  84%
![](https://joplinapp.org/images/flags/country-4x3/dk.png)  |  Dansk  |  [da_DK](https://github.com/laurent22/joplin/blob/master/CliClient/locales/da_DK.po)  |  Morten Juhl-Johansen Zölde-Fejér (mjjzf@syntaktisk.  |  61%
![](https://joplinapp.org/images/flags/country-4x3/de.png)  |  Deutsch  |  [de_DE](https://github.com/laurent22/joplin/blob/master/CliClient/locales/de_DE.po)  |  Michael Sonntag (ms@editorei.de)  |  96%
![](https://joplinapp.org/images/flags/country-4x3/gb.png)  |  English (UK)  |  [en_GB](https://github.com/laurent22/joplin/blob/master/CliClient/locales/en_GB.po)  |    |  100%
![](https://joplinapp.org/images/flags/country-4x3/us.png)  |  English (US)  |  [en_US](https://github.com/laurent22/joplin/blob/master/CliClient/locales/en_US.po)  |    |  100%
![](https://joplinapp.org/images/flags/country-4x3/es.png)  |  Español  |  [es_ES](https://github.com/laurent22/joplin/blob/master/CliClient/locales/es_ES.po)  |  Andros Fenollosa (andros@fenollosa.email)  |  90%
![](https://joplinapp.org/images/flags/country-4x3/fr.png)  |  Français  |  [fr_FR](https://github.com/laurent22/joplin/blob/master/CliClient/locales/fr_FR.po)  |  Laurent Cozic  |  100%
![](https://joplinapp.org/images/flags/es/galicia.png)  |  Galician  |  [gl_ES](https://github.com/laurent22/joplin/blob/master/CliClient/locales/gl_ES.po)  |  Marcos Lans (marcoslansgarza@gmail.com)  |  59%
![](https://joplinapp.org/images/flags/country-4x3/it.png)  |  Italiano  |  [it_IT](https://github.com/laurent22/joplin/blob/master/CliClient/locales/it_IT.po)  |    |  95%
![](https://joplinapp.org/images/flags/country-4x3/be.png)  |  Nederlands  |  [nl_BE](https://github.com/laurent22/joplin/blob/master/CliClient/locales/nl_BE.po)  |    |  47%
![](https://joplinapp.org/images/flags/country-4x3/nl.png)  |  Nederlands  |  [nl_NL](https://github.com/laurent22/joplin/blob/master/CliClient/locales/nl_NL.po)  |  Heimen Stoffels (vistausss@outlook.com)  |  94%
![](https://joplinapp.org/images/flags/country-4x3/no.png)  |  Norwegian  |  [nb_NO](https://github.com/laurent22/joplin/blob/master/CliClient/locales/nb_NO.po)  |  Mats Estensen (code@mxe.no)  |  84%
![](https://joplinapp.org/images/flags/country-4x3/ir.png)  |  Persian  |  [fa](https://github.com/laurent22/joplin/blob/master/CliClient/locales/fa.po)  |  Mehrad Mahmoudian (mehrad@mahmoudian.me)  |  45%
![](https://joplinapp.org/images/flags/country-4x3/pl.png)  |  Polski  |  [pl_PL](https://github.com/laurent22/joplin/blob/master/CliClient/locales/pl_PL.po)  |    |  90%
![](https://joplinapp.org/images/flags/country-4x3/br.png)  |  Português (Brasil)  |  [pt_BR](https://github.com/laurent22/joplin/blob/master/CliClient/locales/pt_BR.po)  |  Rafael Teixeira (rto.tinfo@gmail.com)  |  93%
![](https://joplinapp.org/images/flags/country-4x3/ro.png)  |  Română  |  [ro](https://github.com/laurent22/joplin/blob/master/CliClient/locales/ro.po)  |    |  47%
![](https://joplinapp.org/images/flags/country-4x3/si.png)  |  Slovenian  |  [sl_SI](https://github.com/laurent22/joplin/blob/master/CliClient/locales/sl_SI.po)  |    |  59%
![](https://joplinapp.org/images/flags/country-4x3/se.png)  |  Svenska  |  [sv](https://github.com/laurent22/joplin/blob/master/CliClient/locales/sv.po)  |  Jonatan Nyberg (jonatan@autistici.org)  |  80%
![](https://joplinapp.org/images/flags/country-4x3/tr.png)  |  Türkçe  |  [tr_TR](https://github.com/laurent22/joplin/blob/master/CliClient/locales/tr_TR.po)  |  Zorbey Doğangüneş (zorbeyd@gmail.com)  |  78%
![](https://joplinapp.org/images/flags/country-4x3/ru.png)  |  Русский  |  [ru_RU](https://github.com/laurent22/joplin/blob/master/CliClient/locales/ru_RU.po)  |  Artyom Karlov (artyom.karlov@gmail.com)  |  83%
![](https://joplinapp.org/images/flags/country-4x3/rs.png)  |  српски језик  |  [sr_RS](https://github.com/laurent22/joplin/blob/master/CliClient/locales/sr_RS.po)  |    |  90%
![](https://joplinapp.org/images/flags/country-4x3/cn.png)  |  中文 (简体)  |  [zh_CN](https://github.com/laurent22/joplin/blob/master/CliClient/locales/zh_CN.po)  |    |  98%
![](https://joplinapp.org/images/flags/country-4x3/tw.png)  |  中文 (繁體)  |  [zh_TW](https://github.com/laurent22/joplin/blob/master/CliClient/locales/zh_TW.po)  |  penguinsam (samliu@gmail.com)  |  72%
![](https://joplinapp.org/images/flags/country-4x3/jp.png)  |  日本語  |  [ja_JP](https://github.com/laurent22/joplin/blob/master/CliClient/locales/ja_JP.po)  |  AWASHIRO Ikuya (ikunya@gmail.com)  |  98%
![](https://joplinapp.org/images/flags/country-4x3/kr.png)  |  한국말  |  [ko](https://github.com/laurent22/joplin/blob/master/CliClient/locales/ko.po)  |    |  98%
<!-- LOCALE-TABLE-AUTO-GENERATED -->

# Sponsors

Thanks to our GitHub sponsors!

|     |     |     |
| :---: | :---: | :---: |
| <img width="50" src="https://avatars1.githubusercontent.com/u/6979755?v=4"/></br>[devonzuegel](https://github.com/devonzuegel) | <img width="50" src="https://avatars1.githubusercontent.com/u/794584?v=4"/></br>[corvus-ch](https://github.com/corvus-ch) | <img width="50" src="https://avatars2.githubusercontent.com/u/5559891?v=4"/></br>[stellaktran](https://github.com/stellaktran)

# Contributors

<!-- CONTRIBUTORS-TABLE-AUTO-GENERATED -->
|     |     |     |     |     |
| :---: | :---: | :---: | :---: | :---: |
| <img width="50" src="https://avatars0.githubusercontent.com/u/1285584?v=4"/></br>[laurent22](https://api.github.com/users/laurent22) | <img width="50" src="https://avatars3.githubusercontent.com/u/223439?v=4"/></br>[tessus](https://api.github.com/users/tessus) | <img width="50" src="https://avatars3.githubusercontent.com/u/2179547?v=4"/></br>[CalebJohn](https://api.github.com/users/CalebJohn) | <img width="50" src="https://avatars3.githubusercontent.com/u/4553672?v=4"/></br>[tanrax](https://api.github.com/users/tanrax) | <img width="50" src="https://avatars0.githubusercontent.com/u/8701534?v=4"/></br>[rtmkrlv](https://api.github.com/users/rtmkrlv) |
| <img width="50" src="https://avatars3.githubusercontent.com/u/10997189?v=4"/></br>[fmrtn](https://api.github.com/users/fmrtn) | <img width="50" src="https://avatars3.githubusercontent.com/u/16101778?v=4"/></br>[gabcoh](https://api.github.com/users/gabcoh) | <img width="50" src="https://avatars2.githubusercontent.com/u/1685517?v=4"/></br>[Abijeet](https://api.github.com/users/Abijeet) | <img width="50" src="https://avatars2.githubusercontent.com/u/6557454?v=4"/></br>[innocuo](https://api.github.com/users/innocuo) | <img width="50" src="https://avatars3.githubusercontent.com/u/10927304?v=4"/></br>[matsest](https://api.github.com/users/matsest) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/6319051?v=4"/></br>[abonte](https://api.github.com/users/abonte) | <img width="50" src="https://avatars3.githubusercontent.com/u/208212?v=4"/></br>[foxmask](https://api.github.com/users/foxmask) | <img width="50" src="https://avatars2.githubusercontent.com/u/5365582?v=4"/></br>[marcosvega91](https://api.github.com/users/marcosvega91) | <img width="50" src="https://avatars3.githubusercontent.com/u/37639389?v=4"/></br>[petrz12](https://api.github.com/users/petrz12) | <img width="50" src="https://avatars1.githubusercontent.com/u/4237724?v=4"/></br>[alexdevero](https://api.github.com/users/alexdevero) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/3194829?v=4"/></br>[moltenform](https://api.github.com/users/moltenform) | <img width="50" src="https://avatars1.githubusercontent.com/u/6979755?v=4"/></br>[devonzuegel](https://api.github.com/users/devonzuegel) | <img width="50" src="https://avatars0.githubusercontent.com/u/5199995?v=4"/></br>[zuphilip](https://api.github.com/users/zuphilip) | <img width="50" src="https://avatars2.githubusercontent.com/u/31567272?v=4"/></br>[0ndrey](https://api.github.com/users/0ndrey) | <img width="50" src="https://avatars1.githubusercontent.com/u/6734573?v=4"/></br>[stweil](https://api.github.com/users/stweil) |
| <img width="50" src="https://avatars1.githubusercontent.com/u/1904967?v=4"/></br>[readingsnail](https://api.github.com/users/readingsnail) | <img width="50" src="https://avatars3.githubusercontent.com/u/937861?v=4"/></br>[archont00](https://api.github.com/users/archont00) | <img width="50" src="https://avatars3.githubusercontent.com/u/32770029?v=4"/></br>[bradmcl](https://api.github.com/users/bradmcl) | <img width="50" src="https://avatars1.githubusercontent.com/u/22592201?v=4"/></br>[tfinnberg](https://api.github.com/users/tfinnberg) | <img width="50" src="https://avatars0.githubusercontent.com/u/226708?v=4"/></br>[RaphaelKimmig](https://api.github.com/users/RaphaelKimmig) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/17768566?v=4"/></br>[RenatoXSR](https://api.github.com/users/RenatoXSR) | <img width="50" src="https://avatars1.githubusercontent.com/u/36303913?v=4"/></br>[sensor-freak](https://api.github.com/users/sensor-freak) | <img width="50" src="https://avatars2.githubusercontent.com/u/4245227?v=4"/></br>[zblesk](https://api.github.com/users/zblesk) | <img width="50" src="https://avatars2.githubusercontent.com/u/560571?v=4"/></br>[chrisb86](https://api.github.com/users/chrisb86) | <img width="50" src="https://avatars2.githubusercontent.com/u/339645?v=4"/></br>[jmontane](https://api.github.com/users/jmontane) |
| <img width="50" src="https://avatars2.githubusercontent.com/u/4168339?v=4"/></br>[solariz](https://api.github.com/users/solariz) | <img width="50" src="https://avatars0.githubusercontent.com/u/390889?v=4"/></br>[mmahmoudian](https://api.github.com/users/mmahmoudian) | <img width="50" src="https://avatars1.githubusercontent.com/u/25288?v=4"/></br>[maicki](https://api.github.com/users/maicki) | <img width="50" src="https://avatars3.githubusercontent.com/u/2136373?v=4"/></br>[mjjzf](https://api.github.com/users/mjjzf) | <img width="50" src="https://avatars3.githubusercontent.com/u/27608187?v=4"/></br>[rt-oliveira](https://api.github.com/users/rt-oliveira) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/559346?v=4"/></br>[metbril](https://api.github.com/users/metbril) | <img width="50" src="https://avatars0.githubusercontent.com/u/2486806?v=4"/></br>[sebastienjust](https://api.github.com/users/sebastienjust) | <img width="50" src="https://avatars0.githubusercontent.com/u/1540054?v=4"/></br>[ShaneKilkelly](https://api.github.com/users/ShaneKilkelly) | <img width="50" src="https://avatars1.githubusercontent.com/u/4079047?v=4"/></br>[Zorbeyd](https://api.github.com/users/Zorbeyd) | <img width="50" src="https://avatars0.githubusercontent.com/u/35413451?v=4"/></br>[chenlhlinux](https://api.github.com/users/chenlhlinux) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/17399340?v=4"/></br>[pf-siedler](https://api.github.com/users/pf-siedler) | <img width="50" src="https://avatars1.githubusercontent.com/u/17232523?v=4"/></br>[ruuti](https://api.github.com/users/ruuti) | <img width="50" src="https://avatars2.githubusercontent.com/u/23638148?v=4"/></br>[s1nceri7y](https://api.github.com/users/s1nceri7y) | <img width="50" src="https://avatars1.githubusercontent.com/u/7471938?v=4"/></br>[ShuiHuo](https://api.github.com/users/ShuiHuo) | <img width="50" src="https://avatars2.githubusercontent.com/u/11596277?v=4"/></br>[ikunya](https://api.github.com/users/ikunya) |
| <img width="50" src="https://avatars1.githubusercontent.com/u/498326?v=4"/></br>[Shaxine](https://api.github.com/users/Shaxine) | <img width="50" src="https://avatars2.githubusercontent.com/u/7034200?v=4"/></br>[bimlas](https://api.github.com/users/bimlas) | <img width="50" src="https://avatars0.githubusercontent.com/u/105843?v=4"/></br>[chaifeng](https://api.github.com/users/chaifeng) | <img width="50" src="https://avatars2.githubusercontent.com/u/549349?v=4"/></br>[charles-e](https://api.github.com/users/charles-e) | <img width="50" src="https://avatars3.githubusercontent.com/u/1686759?v=4"/></br>[chrmoritz](https://api.github.com/users/chrmoritz) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/5131923?v=4"/></br>[donbowman](https://api.github.com/users/donbowman) | <img width="50" src="https://avatars2.githubusercontent.com/u/47756?v=4"/></br>[dflock](https://api.github.com/users/dflock) | <img width="50" src="https://avatars3.githubusercontent.com/u/1962738?v=4"/></br>[einverne](https://api.github.com/users/einverne) | <img width="50" src="https://avatars0.githubusercontent.com/u/628474?v=4"/></br>[Atalanttore](https://api.github.com/users/Atalanttore) | <img width="50" src="https://avatars1.githubusercontent.com/u/16492558?v=4"/></br>[eodeluga](https://api.github.com/users/eodeluga) |
| <img width="50" src="https://avatars2.githubusercontent.com/u/1714374?v=4"/></br>[FleischKarussel](https://api.github.com/users/FleischKarussel) | <img width="50" src="https://avatars0.githubusercontent.com/u/6190183?v=4"/></br>[gmag11](https://api.github.com/users/gmag11) | <img width="50" src="https://avatars2.githubusercontent.com/u/2257024?v=4"/></br>[gusbemacbe](https://api.github.com/users/gusbemacbe) | <img width="50" src="https://avatars0.githubusercontent.com/u/18524580?v=4"/></br>[Fvbor](https://api.github.com/users/Fvbor) | <img width="50" src="https://avatars3.githubusercontent.com/u/3379379?v=4"/></br>[sczhg](https://api.github.com/users/sczhg) |
| <img width="50" src="https://avatars1.githubusercontent.com/u/1716229?v=4"/></br>[Vistaus](https://api.github.com/users/Vistaus) | <img width="50" src="https://avatars2.githubusercontent.com/u/2733783?v=4"/></br>[JOJ0](https://api.github.com/users/JOJ0) | <img width="50" src="https://avatars3.githubusercontent.com/u/11466782?v=4"/></br>[jacobherrington](https://api.github.com/users/jacobherrington) | <img width="50" src="https://avatars1.githubusercontent.com/u/4995433?v=4"/></br>[jaredcrowe](https://api.github.com/users/jaredcrowe) | <img width="50" src="https://avatars0.githubusercontent.com/u/163555?v=4"/></br>[JoelRSimpson](https://api.github.com/users/JoelRSimpson) |
| <img width="50" src="https://avatars1.githubusercontent.com/u/23194385?v=4"/></br>[jony0008](https://api.github.com/users/jony0008) | <img width="50" src="https://avatars1.githubusercontent.com/u/6048003?v=4"/></br>[joybinchen](https://api.github.com/users/joybinchen) | <img width="50" src="https://avatars1.githubusercontent.com/u/1560189?v=4"/></br>[y-usuzumi](https://api.github.com/users/y-usuzumi) | <img width="50" src="https://avatars0.githubusercontent.com/u/1660460?v=4"/></br>[xuhcc](https://api.github.com/users/xuhcc) | <img width="50" src="https://avatars3.githubusercontent.com/u/7824233?v=4"/></br>[kklas](https://api.github.com/users/kklas) |
| <img width="50" src="https://avatars2.githubusercontent.com/u/2599210?v=4"/></br>[lboullo0](https://api.github.com/users/lboullo0) | <img width="50" src="https://avatars1.githubusercontent.com/u/1562062?v=4"/></br>[dbinary](https://api.github.com/users/dbinary) | <img width="50" src="https://avatars3.githubusercontent.com/u/5699725?v=4"/></br>[mvonmaltitz](https://api.github.com/users/mvonmaltitz) | <img width="50" src="https://avatars3.githubusercontent.com/u/5788516?v=4"/></br>[Marmo](https://api.github.com/users/Marmo) | <img width="50" src="https://avatars2.githubusercontent.com/u/12831489?v=4"/></br>[mgroth0](https://api.github.com/users/mgroth0) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/51273874?v=4"/></br>[MichipX](https://api.github.com/users/MichipX) | <img width="50" src="https://avatars1.githubusercontent.com/u/53177864?v=4"/></br>[MrTraduttore](https://api.github.com/users/MrTraduttore) | <img width="50" src="https://avatars3.githubusercontent.com/u/9076687?v=4"/></br>[NJannasch](https://api.github.com/users/NJannasch) | <img width="50" src="https://avatars2.githubusercontent.com/u/12369770?v=4"/></br>[Ouvill](https://api.github.com/users/Ouvill) | <img width="50" src="https://avatars3.githubusercontent.com/u/43815417?v=4"/></br>[shorty2380](https://api.github.com/users/shorty2380) |
| <img width="50" src="https://avatars3.githubusercontent.com/u/6306608?v=4"/></br>[Diadlo](https://api.github.com/users/Diadlo) | <img width="50" src="https://avatars0.githubusercontent.com/u/8766773?v=4"/></br>[Cogitri](https://api.github.com/users/Cogitri) | <img width="50" src="https://avatars1.githubusercontent.com/u/744655?v=4"/></br>[ruzaq](https://api.github.com/users/ruzaq) | <img width="50" src="https://avatars0.githubusercontent.com/u/19328605?v=4"/></br>[SamuelBlickle](https://api.github.com/users/SamuelBlickle) | <img width="50" src="https://avatars2.githubusercontent.com/u/505011?v=4"/></br>[kcrt](https://api.github.com/users/kcrt) |
| <img width="50" src="https://avatars1.githubusercontent.com/u/538584?v=4"/></br>[xissy](https://api.github.com/users/xissy) | <img width="50" src="https://avatars3.githubusercontent.com/u/466122?v=4"/></br>[Tekki](https://api.github.com/users/Tekki) | <img width="50" src="https://avatars0.githubusercontent.com/u/8731922?v=4"/></br>[tbroadley](https://api.github.com/users/tbroadley) | <img width="50" src="https://avatars1.githubusercontent.com/u/114300?v=4"/></br>[Kriechi](https://api.github.com/users/Kriechi) | <img width="50" src="https://avatars0.githubusercontent.com/u/3457339?v=4"/></br>[tkilaker](https://api.github.com/users/tkilaker) |
| <img width="50" src="https://avatars1.githubusercontent.com/u/4201229?v=4"/></br>[tcyrus](https://api.github.com/users/tcyrus) | <img width="50" src="https://avatars2.githubusercontent.com/u/834914?v=4"/></br>[tobias-grasse](https://api.github.com/users/tobias-grasse) | <img width="50" src="https://avatars3.githubusercontent.com/u/6691273?v=4"/></br>[strobeltobias](https://api.github.com/users/strobeltobias) | <img width="50" src="https://avatars2.githubusercontent.com/u/11031696?v=4"/></br>[ymitsos](https://api.github.com/users/ymitsos) | <img width="50" src="https://avatars3.githubusercontent.com/u/5077221?v=4"/></br>[axq](https://api.github.com/users/axq) |
| <img width="50" src="https://avatars3.githubusercontent.com/u/28493662?v=4"/></br>[cdorin93](https://api.github.com/users/cdorin93) | <img width="50" src="https://avatars3.githubusercontent.com/u/30935096?v=4"/></br>[cybertramp](https://api.github.com/users/cybertramp) | <img width="50" src="https://avatars3.githubusercontent.com/u/9694906?v=4"/></br>[delta-emil](https://api.github.com/users/delta-emil) | <img width="50" src="https://avatars0.githubusercontent.com/u/926263?v=4"/></br>[doc75](https://api.github.com/users/doc75) | <img width="50" src="https://avatars2.githubusercontent.com/u/2903013?v=4"/></br>[ebayer](https://api.github.com/users/ebayer) |
| <img width="50" src="https://avatars0.githubusercontent.com/u/14201321?v=4"/></br>[rasperepodvipodvert](https://api.github.com/users/rasperepodvipodvert) | <img width="50" src="https://avatars1.githubusercontent.com/u/29672555?v=4"/></br>[genneko](https://api.github.com/users/genneko) | <img width="50" src="https://avatars1.githubusercontent.com/u/11388094?v=4"/></br>[hydrandt](https://api.github.com/users/hydrandt) | <img width="50" src="https://avatars1.githubusercontent.com/u/42961947?v=4"/></br>[pensierocrea](https://api.github.com/users/pensierocrea) | <img width="50" src="https://avatars3.githubusercontent.com/u/10206967?v=4"/></br>[rhtenhove](https://api.github.com/users/rhtenhove) |
| <img width="50" src="https://avatars3.githubusercontent.com/u/14062932?v=4"/></br>[simonsan](https://api.github.com/users/simonsan) | <img width="50" src="https://avatars2.githubusercontent.com/u/5004545?v=4"/></br>[stellarpower](https://api.github.com/users/stellarpower) | <img width="50" src="https://avatars1.githubusercontent.com/u/12995773?v=4"/></br>[sumomo-99](https://api.github.com/users/sumomo-99) | <img width="50" src="https://avatars0.githubusercontent.com/u/10956653?v=4"/></br>[tcassaert](https://api.github.com/users/tcassaert) | <img width="50" src="https://avatars0.githubusercontent.com/u/2216902?v=4"/></br>[xcffl](https://api.github.com/users/xcffl) |
| <img width="50" src="https://avatars1.githubusercontent.com/u/1308646?v=4"/></br>[zhangmx](https://api.github.com/users/zhangmx) |  |  |  |  |
<!-- CONTRIBUTORS-TABLE-AUTO-GENERATED -->

# Known bugs

- Resources larger than 10 MB are not currently supported on mobile. They will crash the application so it is recommended not to attach such resources at the moment. The issue is being looked at.
- Non-alphabetical characters such as Chinese or Arabic might create glitches in the terminal on Windows. This is a limitation of the current Windows console.
- It is only possible to upload files of up to 4MB to OneDrive due to a limitation of [the API](https://docs.microsoft.com/en-gb/onedrive/developer/rest-api/api/driveitem_put_content) being currently used. There is currently no plan to support OneDrive "large file" API.

# License

MIT License

Copyright (c) 2016-2019 Laurent Cozic

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
