const Setting = require('lib/models/Setting.js');

// globalStyle should be used for properties that do not change across themes
// i.e. should not be used for colors
const globalStyle = {
	fontSize: 12,
	fontFamily: 'sans-serif',
	margin: 15, // No text and no interactive component should be within this margin
	itemMarginTop: 10,
	itemMarginBottom: 10,
	fontSizeSmaller: 14,
	disabledOpacity: 0.3,
	buttonMinWidth: 50,
	buttonMinHeight: 30,
	editorFontSize: 12,
	textAreaLineHeight: 17,

	headerHeight: 35,
	headerButtonHPadding: 6,

	toolbarHeight: 35,
	tagItemPadding: 3,
};

globalStyle.marginRight = globalStyle.margin;
globalStyle.marginLeft = globalStyle.margin;
globalStyle.marginTop = globalStyle.margin;
globalStyle.marginBottom = globalStyle.margin;
globalStyle.htmlMarginLeft = ((globalStyle.marginLeft / 10) * 0.6).toFixed(2) + 'em';

globalStyle.icon = {
	fontSize: 30,
};

globalStyle.lineInput = {
	fontFamily: globalStyle.fontFamily,
};

globalStyle.headerStyle = {
	fontFamily: globalStyle.fontFamily,
};

globalStyle.inputStyle = {
	border: '1px solid',
	height: 24,
	paddingLeft: 5,
	paddingRight: 5,
	boxSizing: 'border-box',
};

globalStyle.containerStyle = {
	overflow: 'auto',
	overflowY: 'auto',
};

globalStyle.buttonStyle = {
	marginRight: 10,
	border: '1px solid',
	minHeight: 30,
	minWidth: 80,
	maxWidth: 160,
	paddingLeft: 12,
	paddingRight: 12,
};

const lightStyle = {
	backgroundColor: "#ffffff",
	backgroundColorTransparent: 'rgba(255,255,255,0.9)',
	oddBackgroundColor: "#dddddd",
	color: "#222222", // For regular text
	colorError: "red",
	colorWarn: "#9A5B00",
	colorFaded: "#777777", // For less important text
	colorBright: "#000000", // For important text
	dividerColor: "#dddddd",
	selectedColor: '#e5e5e5',
	urlColor: '#155BDA',

	backgroundColor2: "#162B3D",
	color2: "#ffffff",
	selectedColor2: "#0269C2",
	colorError2: "#ff6c6c",

	raisedBackgroundColor: "#e5e5e5",
	raisedColor: "#222222",

	warningBackgroundColor: "#FFD08D",

	htmlColor:'#222222',
	htmlBackgroundColor: 'white',
	htmlDividerColor: 'rgb(230,230,230)',
	htmlLinkColor: 'rgb(80,130,190)',
	htmlTableBackgroundColor: 'rgb(247, 247, 247)',
	htmlCodeBackgroundColor: 'rgb(243, 243, 243)',
	htmlCodeBorderColor: 'rgb(220, 220, 220)',
	htmlCodeColor: 'rgb(0,0,0)',

	editorTheme: "chrome",
	codeThemeCss: "atom-one-light.css",
};

const darkStyle = {
	backgroundColor: '#1D2024',
	backgroundColorTransparent: 'rgba(255,255,255,0.9)',
	oddBackgroundColor: "#dddddd",
	color: '#dddddd',
	colorFaded: '#777777',
	colorError: "red",
	colorWarn: "#9A5B00",
	colorFaded: "#777777", // For less important text
	colorBright: "#ffffff", // For important text
	dividerColor: '#555555',
	selectedColor: '#333333',
	urlColor: '#4E87EE',

	backgroundColor2: "#181A1D",
	color2: "#ffffff",
	selectedColor2: "#333333",
	colorError2: "#ff6c6c",

	raisedBackgroundColor: "#474747",
	raisedColor: "#ffffff",

	warningBackgroundColor: "#CC6600",

	htmlColor: 'rgb(220,220,220)',
	htmlBackgroundColor: 'rgb(29,32,36)',
	htmlDividerColor: '#3D444E',
	htmlCodeColor: '#ffffff',
	htmlLinkColor: 'rgb(166,166,255)',
	htmlTableBackgroundColor: 'rgb(40, 41, 42)',
	htmlCodeBackgroundColor: 'rgb(47, 48, 49)',
	htmlCodeBorderColor: 'rgb(70, 70, 70)',

	editorTheme: 'twilight',
	codeThemeCss: "atom-one-dark-reasonable.css",
};

function addExtraStyles(style) {
	style.tagStyle = {
		fontSize: style.fontSize,
		fontFamily: style.fontFamily,
		marginTop: style.itemMarginTop * 0.4,
		marginBottom: style.itemMarginBottom * 0.4,
		marginRight: style.margin * 0.3,
		paddingTop: style.tagItemPadding,
		paddingBottom: style.tagItemPadding,
		paddingRight: style.tagItemPadding * 2,
		paddingLeft: style.tagItemPadding * 2,
		backgroundColor: style.raisedBackgroundColor,
		color: style.raisedColor,
	};

	style.toolbarStyle = {
		height: style.toolbarHeight,
		// minWidth: style.toolbarHeight,
		display: 'flex',
		alignItems: 'center',
		paddingLeft: style.headerButtonHPadding,
		paddingRight: style.headerButtonHPadding,
		textDecoration: 'none',
		fontFamily: style.fontFamily,
		fontSize: style.fontSize,
		boxSizing: 'border-box',
		cursor: 'default',
		justifyContent: 'center',
		color: style.color,
		whiteSpace: 'nowrap',
	};

	style.textStyle = {
		fontFamily: globalStyle.fontFamily,
		fontSize: style.fontSize,
		lineHeight: '1.6em',
		color: style.color
	};

	style.textStyle2 = Object.assign({}, style.textStyle,
		{ color: style.color2, }
	);

	style.urlStyle = Object.assign({}, style.textStyle,
		{
			textDecoration: 'underline',
			color: style.urlColor
		}
	);

	style.h1Style = Object.assign({},
		style.textStyle,
		{
			color: style.color,
			fontSize: style.textStyle.fontSize * 1.5,
			fontWeight: 'bold'
		}
	);

	style.h2Style = Object.assign({},
		style.textStyle,
		{
			color: style.color,
			fontSize: style.textStyle.fontSize * 1.3,
			fontWeight: 'bold'
		}
	);

	style.dialogModalLayer = {
		zIndex: 9999,
		display: 'flex',
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		backgroundColor: 'rgba(0,0,0,0.6)',
		alignItems: 'flex-start',
		justifyContent: 'center',
	};

	style.dialogBox = {
		backgroundColor: style.backgroundColor,
		padding: 16,
		boxShadow: '6px 6px 20px rgba(0,0,0,0.5)',
		marginTop: 20,
	}

	style.dialogTitle = Object.assign({}, style.h1Style, { marginBottom: '1.2em' });

	return style;
}

let themeCache_ = {};

function themeStyle(theme) {
	if (!theme) throw new Error('Theme must be specified');

	var zoomRatio = Setting.value('style.zoom') / 100;
	var editorFontSize = Setting.value('style.editor.fontSize');

	const cacheKey = [theme, zoomRatio, editorFontSize].join('-');
	if (themeCache_[cacheKey]) return themeCache_[cacheKey];

	let fontSizes = {
		fontSize: Math.round(12 * zoomRatio),
		editorFontSize: editorFontSize,
		textAreaLineHeight: Math.round(17 * editorFontSize / 12),

		// For WebView - must correspond to the properties above
		htmlFontSize: Math.round(15 * zoomRatio) + 'px',
		htmlLineHeight: '1.6em', //Math.round(20 * zoomRatio) + 'px'

		htmlCodeFontSize: '.9em',
	}

	let output = {};
	output.zoomRatio = zoomRatio;
	output.editorFontSize = editorFontSize;
	if (theme == Setting.THEME_LIGHT) {
		output = Object.assign({}, globalStyle, fontSizes, lightStyle);
	}
	else if (theme == Setting.THEME_DARK) {
		output = Object.assign({}, globalStyle, fontSizes, darkStyle);
	}

	// Note: All the theme specific things should go in addExtraStyles
	// so that their definition is not split between here and the
	// beginning of the file. At least new styles should go in
	// addExtraStyles.

	output.icon = Object.assign({},
		output.icon,
		{ color: output.color }
	);

	output.lineInput = Object.assign({},
		output.lineInput,
		{
			color: output.color,
			backgroundColor: output.backgroundColor,
		}
	);

	output.headerStyle = Object.assign({},
		output.headerStyle,
		{
			color: output.color,
			backgroundColor: output.backgroundColor,
		}
	);

	output.inputStyle = Object.assign({},
		output.inputStyle,
		{
			color: output.color,
			backgroundColor: output.backgroundColor,
			borderColor: output.dividerColor,
		}
	);

	output.containerStyle = Object.assign({},
		output.containerStyle,
		{
			color: output.color,
			backgroundColor: output.backgroundColor,
		}
	);

	output.buttonStyle = Object.assign({},
		output.buttonStyle,
		{
			color: output.color,
			backgroundColor: output.backgroundColor,
			borderColor: output.dividerColor,
		}
	);

	output = addExtraStyles(output);

	themeCache_[cacheKey] = output;
	return themeCache_[cacheKey];
}

module.exports = { themeStyle };
