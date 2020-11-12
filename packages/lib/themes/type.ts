export enum ThemeAppearance {
	Light = 'light',
	Dark = 'dark',
}

export interface Theme {
	appearance: ThemeAppearance;

	// Color scheme "1" is the basic one, like used to display the note
	// content. It's basically dark gray text on white background
	backgroundColor: string;
	backgroundColorTransparent: string;
	oddBackgroundColor: string;
	color: string; // For regular text
	colorError: string;
	colorWarn: string;
	colorFaded: string; // For less important text
	colorBright: string; // For important text
	dividerColor: string;
	selectedColor: string;
	urlColor: string;

	// Color scheme "2" is used for the sidebar. It's white text over
	// dark blue background.
	backgroundColor2: string;
	color2: string;
	selectedColor2: string;
	colorError2: string;

	// Color scheme "3" is used for the config screens for example/
	// It's dark text over gray background.
	backgroundColor3: string;
	backgroundColorHover3: string;
	color3: string;

	// Color scheme "4" is used for secondary-style buttons. It makes a white
	// button with blue text.
	backgroundColor4: string;
	color4: string;

	raisedBackgroundColor: string;
	raisedColor: string;
	searchMarkerBackgroundColor: string;
	searchMarkerColor: string;

	warningBackgroundColor: string;

	tableBackgroundColor: string;
	codeBackgroundColor: string;
	codeBorderColor: string;
	codeColor: string;

	codeMirrorTheme: string;
	codeThemeCss: string;

	highlightedColor?: string;
}
