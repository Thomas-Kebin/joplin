/* joplin-manifest:
{
	"manifest_version": 1,
	"name": "JS Bundle test",
	"description": "JS Bundle Test plugin",
	"version": "1.0.0",
	"author": "Laurent Cozic",
	"homepage_url": "https://joplinapp.org"
}
*/

joplin.plugins.register({
	onStart: async function() {
		await joplin.data.post(['folders'], null, { title: "my plugin folder" });
	},
});
