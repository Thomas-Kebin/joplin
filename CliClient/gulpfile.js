const gulp = require('gulp');
const fs = require('fs-extra');
const utils = require('../Tools/gulp/utils');
const tasks = {
	compileExtensions: {
		fn: require('../Tools/gulp/tasks/compileExtensions.js'),
	},
	copyLib: require('../Tools/gulp/tasks/copyLib'),
	tsc: require('../Tools/gulp/tasks/tsc'),
	updateIgnoredTypeScriptBuild: require('../Tools/gulp/tasks/updateIgnoredTypeScriptBuild'),
};

tasks.prepareBuild = {
	fn: async () => {
		const buildDir = `${__dirname}/build`;
		await utils.copyDir(`${__dirname}/app`, buildDir, {
			excluded: ['node_modules'],
		});
		await utils.copyDir(`${__dirname}/locales-build`, `${buildDir}/locales`);
		await tasks.copyLib.fn();
		await utils.copyFile(`${__dirname}/package.json`, `${buildDir}/package.json`);
		await utils.copyFile(`${__dirname}/package-lock.json`, `${buildDir}/package-lock.json`);
		await utils.copyFile(`${__dirname}/gulpfile.js`, `${buildDir}/gulpfile.js`);

		// Import all the patches inside the CliClient directory
		// and build file. Needs to be in CliClient dir for when running
		// in dev mode, and in build dir for production.
		const localPatchDir = `${buildDir}/patches`;
		await fs.remove(localPatchDir);
		await fs.mkdirp(localPatchDir);
		await utils.copyDir(`${__dirname}/../patches/shared`, `${localPatchDir}`, { delete: false });
		await utils.copyDir(`${__dirname}/../patches/node`, `${localPatchDir}`, { delete: false });

		await fs.remove(`${__dirname}/patches`);
		await utils.copyDir(`${localPatchDir}`, `${__dirname}/patches`);

		const packageRaw = await fs.readFile(`${buildDir}/package.json`);
		const package = JSON.parse(packageRaw.toString());
		package.scripts.postinstall = 'patch-package';
		await fs.writeFile(`${buildDir}/package.json`, JSON.stringify(package, null, 2), 'utf8');

		fs.chmodSync(`${buildDir}/main.js`, 0o755);
	},
};

tasks.prepareTestBuild = {
	fn: async () => {
		const testBuildDir = `${__dirname}/tests-build`;

		await utils.copyDir(`${__dirname}/tests`, testBuildDir, {
			excluded: [
				'lib/',
				'locales/',
				'node_modules/',
				'*.ts',
				'*.tsx',
			],
		});

		const rootDir = utils.rootDir();

		await utils.copyDir(`${rootDir}/ReactNativeClient/lib`, `${testBuildDir}/lib`, {
			excluded: [
				`${rootDir}/ReactNativeClient/lib/joplin-renderer/node_modules`,
			],
		});
		await utils.copyDir(`${rootDir}/ReactNativeClient/locales`, `${testBuildDir}/locales`);
		await fs.mkdirp(`${testBuildDir}/data`);
	},
};

utils.registerGulpTasks(gulp, tasks);

gulp.task('build', gulp.series([
	'prepareBuild',
	'compileExtensions',
	'copyLib',
]));

gulp.task('buildTests', gulp.series([
	'prepareTestBuild',
	'compileExtensions',
	'copyLib',
]));
