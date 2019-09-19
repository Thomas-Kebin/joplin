module.exports = {
	'env': {
		'browser': true,
		'es6': true,
		'node': true,
	},
	"parser": "@typescript-eslint/parser",
	'extends': ['eslint:recommended'],
	'globals': {
		'Atomics': 'readonly',
		'SharedArrayBuffer': 'readonly',

		// Jasmine variables
		'expect': 'readonly',
		'describe': 'readonly',
		'it': 'readonly',
		'beforeEach': 'readonly',
		'jasmine': 'readonly',

		// React Native variables
		'__DEV__': 'readonly',

		// Clipper variables
		'browserSupportsPromises_': true,
		'chrome': 'readonly',
		'browser': 'readonly',
	},
	'parserOptions': {
		'ecmaVersion': 2018,
		"ecmaFeatures": {
			"jsx": true,
	    },
	    "sourceType": "module",
	},
	'rules': {
		"react/jsx-uses-react": "error",
		"react/jsx-uses-vars": "error",
		// Ignore all unused function arguments, because in some
		// case they are kept to indicate the function signature.
		//"no-unused-vars": ["error", { "argsIgnorePattern": ".*" }],
		"@typescript-eslint/no-unused-vars": ["error"],
		"no-constant-condition": 0,
		"no-prototype-builtins": 0,
		"space-in-parens": ["error", "never"],
		"semi": ["error", "always"],
		"eol-last": ["error", "always"],
		"quotes": ["error", "single"],
		"indent": ["error", "tab"],
		"comma-dangle": ["error", "always-multiline"],
		"no-trailing-spaces": "error",
		"linebreak-style": ["error", "unix"],
		// This error is always a false positive so far since it detects
		// possible race conditions in contexts where we know it cannot happen.
		"require-atomic-updates": 0,
		"prefer-template": ["error"],
		"template-curly-spacing": ["error", "never"]
	},
	"plugins": [
		"react",
		"@typescript-eslint",
	],
};