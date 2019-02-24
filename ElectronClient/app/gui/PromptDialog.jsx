const React = require('react');
const { connect } = require('react-redux');
const { _ } = require('lib/locale.js');
const moment = require('moment');
const { themeStyle } = require('../theme.js');
const { time } = require('lib/time-utils.js');
const Datetime = require('react-datetime');
const TagList = require('./TagList.min.js');
const Tag = require('lib/models/Tag.js');

class PromptDialog extends React.Component {

	componentWillMount() {
		let answer = ''
		if (this.props.inputType !== 'tags' && this.props.defaultValue) {
			answer = this.props.defaultValue;
		}

		this.setState({
			visible: false,
			answer: answer,
			tags: this.props.inputType === 'tags' ? this.props.defaultValue : null,
		});
		this.focusInput_ = true;
	}

	componentWillReceiveProps(newProps) {
		if ('visible' in newProps && newProps.visible !== this.props.visible) {
			this.setState({ visible: newProps.visible });
			if (newProps.visible) this.focusInput_ = true;
		}

		if ('defaultValue' in newProps && newProps.defaultValue !== this.props.defaultValue) {
			if ('inputType' in newProps && newProps.inputType === 'tags') {
				this.setState({ answer: '', tags: newProps.defaultValue });
			} else {
				this.setState({ answer: newProps.defaultValue });
			}
		}
	}

	componentDidUpdate() {
		if (this.focusInput_ && this.answerInput_) this.answerInput_.focus();
		this.focusInput_ = false;
	}

	styles(themeId, width, height, visible) {
		const styleKey = themeId + '_' + width + '_' + height + '_' + visible;
		if (styleKey === this.styleKey_) return this.styles_;

		const theme = themeStyle(themeId);

		this.styleKey_ = styleKey;

		this.styles_ = {};

		const paddingTop = 20;

		this.styles_.modalLayer = {
			zIndex: 9999,
			position: 'absolute',
			top: 0,
			left: 0,
			width: width,
			height: height - paddingTop,
			backgroundColor: 'rgba(0,0,0,0.6)',
			display: visible ? 'flex' : 'none',
    		alignItems: 'flex-start',
    		justifyContent: 'center',
    		paddingTop: paddingTop + 'px',
		};

		this.styles_.promptDialog = {
			backgroundColor: theme.backgroundColor,
			padding: 16,
			display: 'inline-block',
			maxWidth: width * 0.5,
			boxShadow: '6px 6px 20px rgba(0,0,0,0.5)',
		};

		this.styles_.button = {
			minWidth: theme.buttonMinWidth,
			minHeight: theme.buttonMinHeight,
			marginLeft: 5,
			color: theme.color,
			backgroundColor: theme.backgroundColor,
			border: '1px solid',
			borderColor: theme.dividerColor,
		};

		this.styles_.label = {
			marginRight: 5,
			fontSize: theme.fontSize,
			color: theme.color,
			fontFamily: theme.fontFamily,
			verticalAlign: 'top',
		};

		this.styles_.input = {
			width: 0.5 * width,
			maxWidth: 400,
			color: theme.color,
			backgroundColor: theme.backgroundColor,
			border: '1px solid',
			borderColor: theme.dividerColor,
		};

		this.styles_.tagList = {
			marginBottom: 10,
			marginTop: 10,
		};

		this.styles_.desc = Object.assign({}, theme.textStyle, {
			marginTop: 10,
		});

		return this.styles_;
	}

	render() {
		const style = this.props.style;
		const theme = themeStyle(this.props.theme);
		const buttonTypes = this.props.buttons ? this.props.buttons : ['ok', 'cancel'];

		const styles = this.styles(this.props.theme, style.width, style.height, this.state.visible);

		const onClose = (accept, buttonType) => {
			if (this.props.onClose) {
				let outputAnswer = this.state.answer;
				if (this.props.inputType === 'datetime') {
					// outputAnswer = anythingToDate(outputAnswer);
					outputAnswer = time.anythingToDateTime(outputAnswer);
				}
				else if (this.props.inputType === 'tags') {
					outputAnswer = this.state.tags;
				}
				this.props.onClose(accept ? outputAnswer : null, buttonType);
			}
			this.setState({ visible: false, answer: '' });
		}

		const onChange = (event) => {
			this.setState({ answer: event.target.value });
		}

		// const anythingToDate = (o) => {
		// 	if (o && o.toDate) return o.toDate();
		// 	if (!o) return null;
		// 	let m = moment(o, time.dateTimeFormat());
		// 	if (m.isValid()) return m.toDate();
		// 	m = moment(o, time.dateFormat());
		// 	return m.isValid() ? m.toDate() : null;
		// }

		const onDateTimeChange = (momentObject) => {
			this.setState({ answer: momentObject });
		}

		const onKeyDown = (event) => {
			if (event.key === 'Enter') {
				if (this.state.answer.trim() !== '') {
					let newTags = this.state.tags;
					if (newTags.indexOf(this.state.answer) === -1) {
						newTags.push(this.state.answer);
					}
					this.setState({
						tags: newTags,
						answer: ''
					});
				}
			} else if (event.key === 'Escape') {
				onClose(false);
			}
		}

		const onDeleteTag = (tag) => {
			let newTags = this.state.tags;
			var index = newTags.indexOf(tag);
			if (index !== -1) newTags.splice(index, 1);
			this.setState({
				tags: newTags,
			});
		}

		const descComp = this.props.description ? <div style={styles.desc}>{this.props.description}</div> : null;

		let inputComp = null;
		let dataList = null;
		let tagList = null;

		if (this.props.inputType === 'datetime') {
			inputComp = <Datetime
				value={this.state.answer}
				inputProps={{style: styles.input}}
				dateFormat={time.dateFormat()}
				timeFormat={time.timeFormat()}
				onChange={(momentObject) => onDateTimeChange(momentObject)}
			/>
		} else {
			inputComp = <input
				style={styles.input}
				ref={input => this.answerInput_ = input}
				value={this.state.answer}
				type="text"
				list={this.props.inputType === "tags" ? "tags" : null}
				onChange={(event) => onChange(event)}
				onKeyDown={(event) => onKeyDown(event)}
			/>
		}

		if (this.props.inputType === 'tags') {
			tagList = <TagList
				style={styles.tagList}
				onDeleteItem={onDeleteTag}
				items={this.state.tags.map((a) => {
								return {title: a, id: a}
							})}
			/>;

			dataList = <datalist id="tags">
				{this.props.autocomplete.map((a) => {
					if (this.state.tags.indexOf(a.title) === -1) {
						return <option value={a.title} key={a.id} />
					}
				}
				)}
			</datalist>
		}

		const buttonComps = [];
		if (buttonTypes.indexOf('ok') >= 0) buttonComps.push(<button key="ok" style={styles.button} onClick={() => onClose(true, 'ok')}>{_('OK')}</button>);
		if (buttonTypes.indexOf('cancel') >= 0) buttonComps.push(<button key="cancel" style={styles.button} onClick={() => onClose(false, 'cancel')}>{_('Cancel')}</button>);
		if (buttonTypes.indexOf('clear') >= 0) buttonComps.push(<button key="clear" style={styles.button} onClick={() => onClose(false, 'clear')}>{_('Clear')}</button>);

		return (
			<div style={styles.modalLayer}>
				<div style={styles.promptDialog}>
					<label style={styles.label}>{this.props.label ? this.props.label : ''}</label>
					<div style={{display: 'inline-block', color: 'black', backgroundColor: theme.backgroundColor}}>
						{inputComp}
						{dataList}
						{descComp}
						{tagList}
					</div>
					<div style={{ textAlign: 'right', marginTop: 10 }}>
						{buttonComps}
					</div>
				</div>
			</div>
		);
	}

}

module.exports = { PromptDialog };
