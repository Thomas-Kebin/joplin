const BaseWidget = require('tkwidgets/BaseWidget.js');
const chalk = require('chalk');
const termutils = require('tkwidgets/framework/termutils.js');

class StatusBarWidget extends BaseWidget {

	constructor() {
		super();

		this.promptState_ = null;
		this.inputEventEmitter_ = null;
		this.history_ = [];
		this.items_ = [];
	}

	get name() {
		return 'statusBar';
	}

	get canHaveFocus() {
		return false;
	}

	setItemAt(index, text) {
		this.items_[index] = text;
		this.invalidate();
	}

	async prompt(initialText = '', promptString = ':') {
		if (this.promptState_) throw new Error('Another prompt already active');

		this.root.globalDisableKeyboard(this);

		this.promptState_ = {
			promise: null,
			initialText: initialText,
			promptString: promptString,
		};

		this.promptState_.promise = new Promise((resolve, reject) => {
			this.promptState_.resolve = resolve;
			this.promptState_.reject = reject;
		});

		this.invalidate();

		return this.promptState_.promise;
	}

	get promptActive() {
		return !!this.promptState_;
	}

	get history() {
		return this.history_;
	}

	resetCursor() {
		if (!this.promptActive) return;
		if (!this.inputEventEmitter_) return;

		this.inputEventEmitter_.redraw();
		this.inputEventEmitter_.rebase(this.absoluteInnerX + termutils.textLength(this.promptState_.promptString), this.absoluteInnerY);
		this.term.moveTo(this.absoluteInnerX + termutils.textLength(this.promptState_.promptString) + this.inputEventEmitter_.getInput().length, this.absoluteInnerY);
	}

	render() {
		super.render();

		const doSaveCursor = !this.promptActive;
		
		if (doSaveCursor) this.term.saveCursor();

		this.innerClear();

		const textStyle = chalk.bgBlueBright.white;

		this.term.drawHLine(this.absoluteInnerX, this.absoluteInnerY, this.innerWidth, textStyle(' '));

		this.term.moveTo(this.absoluteInnerX, this.absoluteInnerY);

		if (this.promptActive) {

			this.term.write(textStyle(this.promptState_.promptString));

			if (this.inputEventEmitter_) {
				// inputField is already waiting for input so in that case just make
				// sure that the cursor is at the right position and exit.
				this.resetCursor();
				return;
			}

			this.term.showCursor(true);

			let options = {
				cancelable: true,
				history: this.history,
				default: this.promptState_.initialText,
				style: this.term.innerStyle.bgBrightBlue.white, // NOTE: Need to use TK style for this as inputField is not compatible with chalk
			};

			this.inputEventEmitter_ = this.term.inputField(options, (error, input) => {
				let resolveResult = null;
				const resolveFn = this.promptState_.resolve;

				if (error) {
					this.logger().error('StatusBar: inputField error:', error);
				} else {
					if (input === undefined) {
						// User cancel
					} else {
						resolveResult = input;
						if (input && input.trim() != '') this.history_.push(input);
					}
				}

				// If the inputField spans several lines invalidate the root so that
				// the interface is relayouted.
				if (termutils.textLength(this.promptState_.promptString) + termutils.textLength(input) >= this.innerWidth - 5) {
					this.root.invalidate();
				}

				this.inputEventEmitter_ = null;
				this.term.showCursor(false);
				this.promptState_ = null;
				this.root.globalEnableKeyboard(this);
				this.invalidate();

				// Only callback once everything has been cleaned up and reset
				resolveFn(resolveResult);
			});

		} else {

			for (let i = 0; i < this.items_.length; i++) {
				this.term.write(textStyle(this.items_[i].trim()));
			}

		}

		if (doSaveCursor) this.term.restoreCursor();
	}

}

module.exports = StatusBarWidget;