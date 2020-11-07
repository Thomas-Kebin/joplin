const React = require('react');
const { themeStyle } = require('@joplin/lib/theme');

class ToolbarSpace extends React.Component {
	render() {
		const theme = themeStyle(this.props.themeId);
		const style = Object.assign({}, theme.toolbarStyle);
		style.minWidth = style.height / 2;

		return <span style={style}></span>;
	}
}

module.exports = ToolbarSpace;
