import CommandService from '../CommandService';
import KeymapService from '../KeymapService';
import propsHaveChanged from './propsHaveChanged';
const { createSelectorCreator, defaultMemoize } = require('reselect');
const { createCachedSelector } = require('re-reselect');

interface MenuItem {
	id: string,
	label: string,
	click: Function,
	role?: any,
	accelerator?: string,
}

interface MenuItems {
	[key: string]: MenuItem,
}

interface MenuItemProps {
	[key:string]: any,
}

interface MenuItemPropsCache {
	[key:string]: any,
}

interface MenuItemCache {
	[key:string]: MenuItems,
}

const createShallowObjectEqualSelector = createSelectorCreator(
	defaultMemoize,
	(prev:any, next:any) => {
		if (Object.keys(prev).length !== Object.keys(next).length) return false;
		for (const n in prev) {
			if (prev[n] !== next[n]) return false;
		}
		return true;
	}
);

// This selector ensures that for the given command names, the same toolbar
// button array is returned if the underlying toolbar buttons have not changed.
const selectObjectByCommands = createCachedSelector(
	(state:any) => state.array,
	(array:any[]) => array
)({
	keySelector: (_state:any, commandNames:string[]) => {
		return commandNames.join('_');
	},
	selectorCreator: createShallowObjectEqualSelector,
});

export default class MenuUtils {

	private service_:CommandService;
	private menuItemCache_:MenuItemCache = {};
	private menuItemPropsCache_:MenuItemPropsCache = {};

	constructor(service:CommandService) {
		this.service_ = service;
	}

	private get service():CommandService {
		return this.service_;
	}

	private get keymapService():KeymapService {
		return KeymapService.instance();
	}

	public commandToMenuItem(commandName:string, onClick:Function):MenuItem {
		const command = this.service.commandByName(commandName);

		const item:MenuItem = {
			id: command.declaration.name,
			label: this.service.label(commandName),
			click: () => onClick(command.declaration.name),
		};

		if (command.declaration.role) item.role = command.declaration.role;

		if (this.keymapService && this.keymapService.acceleratorExists(commandName)) {
			item.accelerator = this.keymapService.getAccelerator(commandName);
		}

		return item;
	}

	public commandToStatefulMenuItem(commandName:string, props:any = null):MenuItem {
		return this.commandToMenuItem(commandName, () => {
			return this.service.execute(commandName, props ? props : {});
		});
	}

	public commandsToMenuItems(commandNames:string[], onClick:Function):MenuItems {
		const key:string = `${this.keymapService.lastSaveTime}_${commandNames.join('_')}`;
		if (this.menuItemCache_[key]) return this.menuItemCache_[key];

		const output:MenuItems = {};

		for (const commandName of commandNames) {
			output[commandName] = this.commandToMenuItem(commandName, onClick);
		}

		this.menuItemCache_[key] = output;

		return output;
	}

	public commandsToMenuItemProps(state:any, commandNames:string[]):MenuItemProps {
		const output:MenuItemProps = {};

		for (const commandName of commandNames) {
			const newProps = this.service.commandMapStateToProps(commandName, state);
			if (newProps === null || propsHaveChanged(this.menuItemPropsCache_[commandName], newProps)) {
				output[commandName] = newProps;
				this.menuItemPropsCache_[commandName] = newProps;
			} else {
				output[commandName] = this.menuItemPropsCache_[commandName];
			}
		}

		return selectObjectByCommands({ array: output }, commandNames);
	}

}
