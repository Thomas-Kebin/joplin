const React = require('react');
const { connect } = require('react-redux');
const { reg } = require('lib/registry.js');
const { themeStyle } = require('../theme.js');
const { _ } = require('lib/locale.js');

class HeaderComponent extends React.Component {

	constructor() {
		super();
		this.state = {
			searchQuery: '',
		};

		this.scheduleSearchChangeEventIid_ = null;
		this.searchOnQuery_ = null;
		this.searchElement_ = null;

		const triggerOnQuery = (query) => {
			clearTimeout(this.scheduleSearchChangeEventIid_);
			if (this.searchOnQuery_) this.searchOnQuery_(query);
			this.scheduleSearchChangeEventIid_ = null;
		}

		this.search_onChange = (event) => {
			this.setState({ searchQuery: event.target.value });

			if (this.scheduleSearchChangeEventIid_) clearTimeout(this.scheduleSearchChangeEventIid_);

			this.scheduleSearchChangeEventIid_ = setTimeout(() => {
				triggerOnQuery(this.state.searchQuery);
			}, 500);
		};

		this.search_onClear = (event) => {
			this.setState({ searchQuery: '' });
			triggerOnQuery('');
		}
	}

	async componentWillReceiveProps(nextProps) {
		if (nextProps.windowCommand) {
			this.doCommand(nextProps.windowCommand);
		}
	}

	async doCommand(command) {
		if (!command) return;

		let commandProcessed = true;

		if (command.name === 'focus_search' && this.searchElement_) {
			this.searchElement_.focus();
		} else {
			commandProcessed = false;
		}

		if (commandProcessed) {
			this.props.dispatch({
				type: 'WINDOW_COMMAND',
				name: null,
			});
		}
	}

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

		const isEnabled = (!('enabled' in options) || options.enabled);
		let classes = ['button'];
		if (!isEnabled) classes.push('disabled');

		const finalStyle = Object.assign({}, style, {
			opacity: isEnabled ? 1 : 0.4,
		});

		return <a
			className={classes.join(' ')}
			style={finalStyle}
			key={key}
			href="#"
			onClick={() => { if (isEnabled) options.onClick() }}
		>
			{icon}{options.title ? options.title : ''}
		</a>
	}

	makeSearch(key, style, options, state) {
		const inputStyle = {
			display: 'flex',
			flex: 1,
			paddingLeft: 4,
			paddingRight: 4,
			color: style.color,
			fontSize: style.fontSize,
			fontFamily: style.fontFamily,
		};

		const searchButton = {
			paddingLeft: 4,
			paddingRight: 4,
			paddingTop: 2,
			paddingBottom: 2,
			textDecoration: 'none',
		};

		const iconStyle = {
			display: 'flex',
			fontSize: Math.round(style.fontSize) * 1.2,
			color: style.color,
		};

		const containerStyle = {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
		};

		const iconName = state.searchQuery ? 'fa-times' : 'fa-search';
		const icon = <i style={iconStyle} className={"fa " + iconName}></i>
		if (options.onQuery) this.searchOnQuery_ = options.onQuery;

		return (
			<div key={key} style={containerStyle}>
				<input
					type="text"
					style={inputStyle}
					placeholder={options.title}
					value={state.searchQuery}
					onChange={this.search_onChange}
					ref={elem => this.searchElement_ = elem}
				/>
				<a
					href="#"
					style={searchButton}
					onClick={this.search_onClear}
				>{icon}</a>
			</div>);
	}

	render() {
		const style = Object.assign({}, this.props.style);
		const theme = themeStyle(this.props.theme);
		const showBackButton = this.props.showBackButton === undefined || this.props.showBackButton === true;
		style.height = theme.headerHeight;
		style.display = 'flex';
		style.flexDirection  = 'row';
		style.borderBottom = '1px solid ' + theme.dividerColor;
		style.boxSizing = 'border-box';

		const items = [];

		const itemStyle = {
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

		if (showBackButton) {
			items.push(this.makeButton('back', itemStyle, { title: _('Back'), onClick: () => this.back_click(), iconName: 'fa-chevron-left ' }));
		}

		if (this.props.items) {
			for (let i = 0; i < this.props.items.length; i++) {
				const item = this.props.items[i];

				if (item.type === 'search') {
					items.push(this.makeSearch('item_' + i + '_search', itemStyle, item, this.state));
				} else {
					items.push(this.makeButton('item_' + i + '_' + item.title, itemStyle, item));
				}
			}
		}

		return (
			<div className="header" style={style}>
				{ items }
			</div>
		);
	}

}

const mapStateToProps = (state) => {
	return {
		theme: state.settings.theme,
		windowCommand: state.windowCommand,
	};
};

const Header = connect(mapStateToProps)(HeaderComponent);

module.exports = { Header };