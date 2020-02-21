 [![Travis Build Status](https://travis-ci.org/laurent22/joplin.svg?branch=master)](https://travis-ci.org/laurent22/joplin) [![Appveyor Build Status](https://ci.appveyor.com/api/projects/status/github/laurent22/joplin?branch=master&passingText=master%20-%20OK&svg=true)](https://ci.appveyor.com/project/laurent22/joplin)

# Building the applications

## Required dependencies

- Install yarn - https://yarnpkg.com/lang/en/docs/install/
- Install node v10.x (check with `node --version`) - https://nodejs.org/en/

## Building

Before doing anything else, from the root of the project, run:

	npm install

Then you can test the various applications:

## Testing the desktop application

	cd ElectronClient
	npm run start
	
## Testing the Terminal application

	cd CliClient
	npm run start

## Testing the Mobile application

First you need to setup React Native to build projects with native code. For this, follow the instructions on the [Get Started](https://facebook.github.io/react-native/docs/getting-started.html) tutorial, in the "React Native CLI Quickstart" tab.

Then:

	cd ReactNativeClient
	react-native run-ios
	# Or: react-native run-android

To run the iOS application, it might be easier to open the file `ios/Joplin.xcworkspace` on XCode and run the app from there.

# General information

- All the applications share the same library, which, for historical reasons, is in `ReactNativeClient/lib`. This library is copied to the relevant directories when building each app.
- In general, most of the backend (anything to do with the database, synchronisation, data import or export, etc.) is shared across all the apps, so when making a change please consider how it will affect all the apps.

## Watching files

To make change to the application, you'll need to rebuild any TypeScript file you've changed, and rebuild the lib. The simplest way to do all this is to watch for changes from the root of the project. Simply run this command, and it should take care of the rest:

	npm run watch

Running `npm run build` would have the same effect, but without watching.

## Running an application with additional parameters

You can specify additional parameters when running the desktop or CLI application. To do so, add `--` to the `npm run start` command, followed by your flags. For example:

	npm run start -- --profile ~/MyTestProfile

## TypeScript

Most of the application is written in JavaScript, however new classes and files should generally be written in [TypeScript](https://www.typescriptlang.org/). All TypeScript files are generated next to the .ts or .tsx file. So for example, if there's a file "lib/MyClass.ts", there will be a generated "lib/MyClass.js" next to it. It is implemented that way as it requires minimal changes to integrate TypeScript in the existing JavaScript code base.

# Troubleshooting desktop application

## On Linux and macOS

If there's an error `while loading shared libraries: libgconf-2.so.4: cannot open shared object file: No such file or directory`, run `sudo apt-get install libgconf-2-4`

If you get a node-gyp related error, you might need to manually install it: `npm install -g node-gyp`.

If you get the error `libtool: unrecognized option '-static'`, follow the instructions [in this post](https://stackoverflow.com/a/38552393/561309) to use the correct libtool version.

## On Windows

If node-gyp does not work (MSBUILD: error MSB3428: Could not load the Visual C++ component "VCBuild.exe"), you might need to install `windows-build-tools` using `npm install --global windows-build-tools`.

If `yarn dist` fails, it may need administrative rights.

If you get an `error MSB8020: The build tools for v140 cannot be found.` try to run with a different toolset version, eg `npm install --toolset=v141` (See [here](https://github.com/mapbox/node-sqlite3/issues/1124) for more info).

The [building\_win32\_tips on this page](./readme/building_win32_tips.md) might be helpful.

## Other issues

> The application window doesn't open or is white

This is an indication that there's an early initialisation error. Try this:

- In ElectronAppWrapper, set `debugEarlyBugs` to `true`. This will force the window to show up and should open the console next to it, which should display any error.
- In more rare cases, an already open instance of Joplin can create strange low-level bugs that will display no error but will result in this white window. A non-dev instance of Joplin, or a dev instance that wasn't properly closed might cause this. So make sure you close everything and try again. Perhaps even other Electron apps running (Skype, Slack, etc.) could cause this?
- Also try to delete node_modules and rebuild.
- If all else fails, switch your computer off and on again, to make sure you start clean.

> How to work on the app from Windows?

You should not use WSL at all because this is a GUI app that lives outside of WSL, and the WSL layer can cause all kind of very hard to debug issues. It can also lock files in node_modules that cannot be unlocked when the app crashes. (You need to restart your computer.) Likewise, don't run the TypeScript watch command from WSL.

So everything should be done from a Windows Command prompt or Windows PowerShell running as Administrator. You can use `run.bat` to run the app in dev mode.
