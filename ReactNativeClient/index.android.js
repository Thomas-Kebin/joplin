import React, { Component } from 'react';
import { AppRegistry, View, Button, TextInput } from 'react-native';

import { connect } from 'react-redux'
import { createStore } from 'redux';
import { Provider } from 'react-redux'

import { WebApi } from 'src/web-api.js'
import { Database } from 'src/database.js'
//import { Session } from 'src/model/session.js';

import { SessionService } from 'src/service/session-service.js';

import { Log } from 'src/log.js'


let debugMode = true;
let clientId = 'A7D301DA7D301DA7D301DA7D301DA7D3';

let db = new Database();
db.setDebugEnabled(debugMode);
db.open();



let defaultState = {
	'myButtonLabel': 'clicko123456',
	'counter': 0,
}

function shallowcopy(a) {
	return Object.assign({}, a);
}

let store = createStore(reducer, defaultState);

function reducer(state, action) {
	switch (action.type) {

		case 'SET_BUTTON_NAME':

			var state = shallowcopy(state);
			state.myButtonLabel = action.name;
			return state;

		case 'INC_COUNTER':

			var state = shallowcopy(state);
			state.counter++;
			return state;

	}

	return state;
}

class MyButton extends Component {

	render() {
		var label = this.props.label;
		if (label === undefined) label = '';
		return <Button onPress={this.props.onPress} title={label} />
	}

}

class MyInput extends Component {

	render() {
		return <TextInput onChangeText={this.props.onChangeText} />
	}

}

const mapStateToButtonProps = function(state) {
	return { label: state.myButtonLabel };
}

const mapDispatchToButtonProps = function(dispatch) {
	return {
		onPress: function() {
			dispatch({
				type: 'INC_COUNTER'
			});
		}
	}
}

const MyConnectedButton = connect(
	mapStateToButtonProps,
	mapDispatchToButtonProps
)(MyButton)

const mapStateToInputProps = function(state) {
	return {}
}

const mapDispatchToInputProps = function(dispatch) {
	return {
		onChangeText(text) {
			dispatch({
				type: 'SET_BUTTON_NAME',
				name: text
			});
		}
	}
}

const MyConnectionInput = connect(
	mapStateToInputProps,
	mapDispatchToInputProps
)(MyInput)

class App extends Component {

	render() {
		return (
			<Provider store={store}>
				<View>
					<MyConnectedButton />
					<MyConnectionInput />
				</View>
			</Provider>
		)
	}

}

// let api = new WebApi('http://192.168.1.2');
// let sessionService = new SessionService(api);
// sessionService.login('laurent@cozic.net', '12345678', clientId).then((session) => {
// 	console.info('GOT DATA:');
// 	console.info(session);
// }).catch(function(error) {
// 	console.warn('GOT ERROR:');
// 	console.warn(error);
// })

AppRegistry.registerComponent('AwesomeProject', () => App);