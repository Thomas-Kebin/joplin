# Plugin Manifest

The manifest file is a JSON file that describes various properties of the plugin. If you use the Yeoman generator, it should be automatically generated based on the answers you've provided. The supported properties are:

Name | Type | Required? | Description
--- | --- | --- | ---
`manifest_version` | number | **Yes** | For now should always be "1".
`name` | string | **Yes** | Name of the plugin. Should be a user-friendly string, as it will be displayed in the UI.
`version` | string | **Yes** | Version number such as "1.0.0".
`app_min_version` | string | **Yes** | Minimum version of Joplin that the plugin is compatible with. In general it should be whatever version you are using to develop the plugin.
`description` | string | No | Detailed description of the plugin.
`author` | string | No | Plugin author name.
`homepage_url` | string | No | Homepage URL of the plugin. It can also be, for example, a link to a GitHub repository.
`content_scripts` | string[] | No | List of [content scripts](https://github.com/laurent22/joplin/blob/dev/packages/generator-joplin/README.md#content-scripts) used by the plugin.

## Manifest example

```json
{
    "manifest_version": 1,
    "name": "Joplin Simple Plugin",
    "description": "To test loading and running a plugin",
    "version": "1.0.0",
    "author": "John Smith",
    "app_min_version": "1.4",
    "homepage_url": "https://joplinapp.org"
}
```
