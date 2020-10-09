import * as vm from 'vm';
import Plugin from 'lib/services/plugins/Plugin';
import sandboxProxy from 'lib/services/plugins/sandboxProxy';
import BasePluginRunner from 'lib/services/plugins/BasePluginRunner';
import executeSandboxCall from 'lib/services/plugins/utils/executeSandboxCall';
import Global from 'lib/services/plugins/api/Global';
import mapEventHandlersToIds, { EventHandlers } from 'lib/services/plugins/utils/mapEventHandlersToIds';

function createConsoleWrapper(pluginId:string) {
	const wrapper:any = {};

	for (const n in console) {
		if (!console.hasOwnProperty(n)) continue;
		wrapper[n] = (...args:any[]) => {
			const newArgs = args.slice();
			newArgs.splice(0, 0, `Plugin "${pluginId}":`);
			return (console as any)[n](...newArgs);
		};
	}

	return wrapper;
}

// The CLI plugin runner is more complex than it needs to be because it more or less emulates
// how it would work in a multi-process architecture, as in the desktop app (and probably how
// it would work in the mobile app too). This is mainly to allow doing integration testing.
//
// For example, all plugin calls go through a proxy, however they could made directly since
// the plugin script is running within the same process as the main app.

export default class PluginRunner extends BasePluginRunner {

	private eventHandlers_:EventHandlers = {};

	constructor() {
		super();

		this.eventHandler = this.eventHandler.bind(this);
	}

	private async eventHandler(eventHandlerId:string, args:any[]) {
		const cb = this.eventHandlers_[eventHandlerId];
		return cb(...args);
	}

	private newSandboxProxy(pluginId:string, sandbox:Global) {
		const target = async (path:string, args:any[]) => {
			return executeSandboxCall(pluginId, sandbox, `joplin.${path}`, mapEventHandlersToIds(args, this.eventHandlers_), this.eventHandler);
		};

		return {
			joplin: sandboxProxy(target),
			console: createConsoleWrapper(pluginId),
		};
	}

	async run(plugin:Plugin, sandbox:Global) {
		const vmSandbox = vm.createContext(this.newSandboxProxy(plugin.id, sandbox));

		try {
			vm.runInContext(plugin.scriptText, vmSandbox);
		} catch (error) {
			this.logger().error(`In plugin ${plugin.id}:`, error);
			return;
		}
	}

}
