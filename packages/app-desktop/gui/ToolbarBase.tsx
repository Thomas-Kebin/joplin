import ToolbarButton from './ToolbarButton/ToolbarButton';
import ToggleEditorsButton, { Value } from './ToggleEditorsButton/ToggleEditorsButton';
const React = require('react');
const { connect } = require('react-redux');
const { themeStyle } = require('@joplin/lib/theme');
const ToolbarSpace = require('./ToolbarSpace.min.js');

interface Props {
	themeId: number,
	style: any,
	items: any[],
}

class ToolbarBaseComponent extends React.Component<Props, any> {

	render() {
		const theme = themeStyle(this.props.themeId);

		const style:any = Object.assign({
			display: 'flex',
			flexDirection: 'row',
			boxSizing: 'border-box',
			backgroundColor: theme.backgroundColor3,
			padding: theme.toolbarPadding,
			paddingRight: theme.mainPadding,
		}, this.props.style);

		const groupStyle:any = {
			display: 'flex',
			flexDirection: 'row',
			boxSizing: 'border-box',
		};

		const leftItemComps:any[] = [];
		const centerItemComps:any[] = [];
		const rightItemComps:any[] = [];

		if (this.props.items) {
			for (let i = 0; i < this.props.items.length; i++) {
				const o = this.props.items[i];
				let key = o.iconName ? o.iconName : '';
				key += o.title ? o.title : '';
				const itemType = !('type' in o) ? 'button' : o.type;

				if (!key) key = `${o.type}_${i}`;

				const props = Object.assign(
					{
						key: key,
						themeId: this.props.themeId,
					},
					o
				);

				if (o.name === 'toggleEditors') {
					rightItemComps.push(<ToggleEditorsButton
						key={o.name}
						value={Value.Markdown}
						themeId={this.props.themeId}
						toolbarButtonInfo={o}
					/>);
				} else if (itemType === 'button') {
					const target = ['historyForward', 'historyBackward', 'toggleExternalEditing'].includes(o.name) ? leftItemComps : centerItemComps;
					target.push(<ToolbarButton {...props} />);
				} else if (itemType === 'separator') {
					centerItemComps.push(<ToolbarSpace {...props} />);
				}
			}
		}

		return (
			<div className="editor-toolbar" style={style}>
				<div style={groupStyle}>
					{leftItemComps}
				</div>
				<div style={groupStyle}>
					{centerItemComps}
				</div>
				<div style={Object.assign({}, groupStyle, { flex: 1, justifyContent: 'flex-end' })}>
					{rightItemComps}
				</div>
			</div>
		);
	}
}

const mapStateToProps = (state:any) => {
	return { themeId: state.settings.theme };
};

export default connect(mapStateToProps)(ToolbarBaseComponent);
