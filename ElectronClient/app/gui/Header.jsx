const React = require('react');
const { connect } = require('react-redux');
const { reg } = require('lib/registry.js');
const { themeStyle } = require('../theme.js');
const { _ } = require('lib/locale.js');

class HeaderComponent extends React.Component {

	back_click() {
		this.props.dispatch({ type: 'NAV_BACK' });
	}

	makeButton(key, style, options) {
		let icon = null;
		if (options.iconName) {
			const iconStyle = {
				fontSize: Math.round(style.fontSize * 1.4),
				color: style.color
			};
			if (options.title) iconStyle.marginRight = 5;
			icon = <i style={iconStyle} className={"fa " + options.iconName}></i>
		}

		return <a className="button" style={style} key={key} href="#" onClick={() => {options.onClick()}}>{icon}{options.title ? options.title : ''}</a>
	}

	render() {
		const style = this.props.style;
		const theme = themeStyle(this.props.theme);
		const showBackButton = this.props.showBackButton === undefined || this.props.showBackButton === true;
		style.height = theme.headerHeight;
		style.display = 'flex';
		style.flexDirection  = 'row';

		const buttons = [];
		if (showBackButton) {
			buttons.push(this.makeButton('back', {}, { title: _('Back'), onClick: () => this.back_click() }));
		}

		const buttonStyle = {
			height: theme.headerHeight,
			display: 'flex',
			alignItems: 'center',
			paddingLeft: theme.headerButtonHPadding,
			paddingRight: theme.headerButtonHPadding,
			color: theme.color,
			textDecoration: 'none',
			fontFamily: theme.fontFamily,
			fontSize: theme.fontSize,
			boxSizing: 'border-box',
			cursor: 'default',
		};

		if (this.props.buttons) {
			for (let i = 0; i < this.props.buttons.length; i++) {
				const o = this.props.buttons[i];
				buttons.push(this.makeButton('btn_' + i + '_' + o.title, buttonStyle, o));
			}
		}

		return (
			<div className="header" style={style}>
				{ buttons }
			</div>
		);
	}

}

const mapStateToProps = (state) => {
	return { theme: state.settings.theme };
};

const Header = connect(mapStateToProps)(HeaderComponent);

module.exports = { Header };