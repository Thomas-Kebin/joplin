import { execCommand2, githubRelease, gitPullTry, rootDir } from './tool-utils';

const appDir = `${rootDir}/packages/app-desktop`;

async function main() {
	await gitPullTry(false);

	const argv = require('yargs').argv;

	process.chdir(appDir);

	console.info(`Running from: ${process.cwd()}`);

	const version = (await execCommand2('npm version patch')).trim();
	const tagName = version;

	console.info(`New version number: ${version}`);

	await execCommand2('git add -A');
	await execCommand2(`git commit -m "Desktop release ${version}"`);
	await execCommand2(`git tag ${tagName}`);
	await execCommand2('git push');
	await execCommand2('git push --tags');

	const releaseOptions = { isDraft: true, isPreRelease: !!argv.beta };

	console.info('Release options: ', releaseOptions);

	const release = await githubRelease('joplin', tagName, releaseOptions);

	console.info(`Created GitHub release: ${release.html_url}`);
	console.info('GitHub release page: https://github.com/laurent22/joplin/releases');
	console.info(`To create changelog: node packages/tools/git-changelog.js ${version}`);
}

main().catch((error) => {
	console.error('Fatal error');
	console.error(error);
	process.exit(1);
});
