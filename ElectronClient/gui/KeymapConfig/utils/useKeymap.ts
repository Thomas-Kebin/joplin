import { useState, useEffect } from 'react';
import KeymapService, { KeymapItem } from 'lib/services/KeymapService';

const keymapService = KeymapService.instance();

// This custom hook provides a synchronized snapshot of the keymap residing at KeymapService
// All the logic regarding altering and interacting with the keymap is isolated from the components

const useKeymap = (): [
	KeymapItem[],
	Error,
	(keymapItems: KeymapItem[]) => void,
	(commandName: string, accelerator: string) => void,
	(commandName: string) => void
] => {
	const [keymapItems, setKeymapItems] = useState<KeymapItem[]>(() => keymapService.getKeymapItems());
	const [keymapError, setKeymapError] = useState<Error>(null);
	const [mustSave, setMustSave] = useState(false);

	const setAccelerator = (commandName: string, accelerator: string) => {
		setKeymapItems(prevKeymap => {
			const newKeymap = [...prevKeymap];

			newKeymap.find(item => item.command === commandName).accelerator = accelerator || null /* Disabled */;
			return newKeymap;
		});

		setMustSave(true);
	};

	const resetAccelerator = (commandName: string) => {
		const defaultAccelerator = keymapService.getDefaultAccelerator(commandName);
		setKeymapItems(prevKeymap => {
			const newKeymap = [...prevKeymap];

			newKeymap.find(item => item.command === commandName).accelerator = defaultAccelerator;
			return newKeymap;
		});

		setMustSave(true);
	};

	const overrideKeymapItems = (customKeymapItems: KeymapItem[]) => {
		const oldKeymapItems = [...customKeymapItems];
		keymapService.initialize(); // Start with a fresh keymap

		try {
			// First, try to update the in-memory keymap of KeymapService
			// This function will throw if there are any issues with the new custom keymap
			keymapService.overrideKeymap(customKeymapItems);
			// Then, update the state with the data from KeymapService
			// Side-effect: Changes will also be saved to the disk
			setKeymapItems(keymapService.getKeymapItems());
		} catch (err) {
			// oldKeymapItems includes even the unchanged keymap items
			// However, it is not an issue because the logic accounts for such scenarios
			keymapService.overrideKeymap(oldKeymapItems);
			throw err;
		}
	};

	useEffect(() => {
		if (!mustSave) return;

		setMustSave(false);

		async function saveKeymap() {
			try {
				keymapService.overrideKeymap(keymapItems);
				await keymapService.saveCustomKeymap();
				setKeymapError(null);
			} catch (err) {
				const error = new Error(`Could not save file: ${err.message}`);
				setKeymapError(error);
			}
		}

		saveKeymap();
	}, [keymapItems, mustSave]);

	return [keymapItems, keymapError, overrideKeymapItems, setAccelerator, resetAccelerator];
};

export default useKeymap;
