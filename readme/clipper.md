## Troubleshooting the web clipper service

The web clipper extension and the Joplin application communicates via a service, which is started by the Joplin desktop app.

However certain things can interfer with this service and prevent it from being accessible or from starting. If something does not work, check the following:

- Check that the service is started. You can check this in the Web clipper options in the desktop app.

- Check that the port used by the service is not blocked by a firewall. You can find the port number in the Web clipper options in the desktop Joplin application.

- Check that no proxy is running on the machine, or make sure that the requests from the web clipper service are filtered and allowed. For example https://github.com/laurent22/joplin/issues/561#issuecomment-392220191

If none of this work, please report it on the [forum](https://discourse.joplin.cozic.net/) or [GitHub issue tracker](https://github.com/laurent22/joplin/issues)

## Debugging the extension

To provide as much information as possible when reporting an issue, you may provide the log from the various Chrome console.

To do so, first enable developer mode in [chrome://extensions/](chrome://extensions/)

### Debugging the popup

Right-click on the Joplin extension icon, and select "Inspect popup".

### Debugging the background script

In `chrome://extensions/`, click on "Inspect background script".

### Debugging the content script

Press Ctrl+Shift+I to open the console of the current page.