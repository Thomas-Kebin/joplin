const React = require('react');
const { connect } = require('react-redux');
const time = require('@joplin/lib/time').default;
const { themeStyle } = require('@joplin/lib/theme');

class NoteStatusBarComponent extends React.Component {
	style() {
		const theme = themeStyle(this.props.themeId);

		const style = {
			root: Object.assign({}, theme.textStyle, {
				backgroundColor: theme.backgroundColor,
				color: theme.colorFaded,
			}),
		};

		return style;
	}

	render() {
		const note = this.props.note;
		return <div style={this.style().root}>{time.formatMsToLocal(note.user_updated_time)}</div>;
	}
}

const mapStateToProps = state => {
	return {
		// notes: state.notes,
		// folders: state.folders,
		// selectedNoteIds: state.selectedNoteIds,
		themeId: state.settings.theme,
	};
};

const NoteStatusBar = connect(mapStateToProps)(NoteStatusBarComponent);

module.exports = { NoteStatusBar };
