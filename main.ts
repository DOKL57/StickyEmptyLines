import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	MarkdownView,
	Editor,
} from "obsidian";

interface StickyEmptyLinesSettings {
	emptyLines: number;
	excludeRegex: string;
}

const DEFAULT_SETTINGS: StickyEmptyLinesSettings = {
	emptyLines: 5,
	excludeRegex: "",
};

export default class StickyEmptyLinesPlugin extends Plugin {
	settings: StickyEmptyLinesSettings;
	private lastFile: TFile | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new StickyEmptyLinesSettingTab(this.app, this));

		// Handle file switching, which covers opening new files.
		this.registerEvent(
			this.app.workspace.on("file-open", this.handleFileSwitch.bind(this))
		);

		// Cleanup the last active file when Obsidian is closed.
		this.onunload = () => {
			this.cleanupFile(this.lastFile);
		};

		// Initial padding if a file is already open on plugin load.
		const view = this.getActiveMarkdownView();
		if (view && view.file) {
			this.lastFile = view.file;
			this.padEditorBottom(view.file, view.editor);
		}
	}

	/**
	 * Cleans up the previously active file and pads the new one.
	 */
	private async handleFileSwitch(file: TFile | null) {
		// Clean the file we are switching away from.
		if (this.lastFile && this.lastFile.path !== file?.path) {
			await this.cleanupFile(this.lastFile);
		}

		this.lastFile = file;

		// Pad the newly opened file.
		const view = this.getActiveMarkdownView();
		if (file && view && (await this.shouldProcess(file))) {
			await this.padEditorBottom(file, view.editor);
		}
	}

	/**
	 * Removes all trailing empty lines from a given file and saves it.
	 */
	private async cleanupFile(file: TFile | null) {
		if (!file || !(await this.shouldProcess(file))) {
			return;
		}

		const content = await this.app.vault.cachedRead(file);
		const cleaned = removeTrailingEmptyLines(content);

		if (content !== cleaned) {
			await this.app.vault.modify(file, cleaned);
		}
	}

	/**
	 * Check if a file should be processed based on its extension and the user's exclude regex.
	 */
	private async shouldProcess(file: TFile): Promise<boolean> {
		if (file.extension !== "md") return false;

		const { excludeRegex } = this.settings;
		if (!excludeRegex) return true;

		try {
			const regex = new RegExp(excludeRegex);
			if (regex.test(file.path)) return false;

			const content = await this.app.vault.cachedRead(file);
			return !regex.test(content);
		} catch (e) {
			console.warn(`[StickyEmptyLines] Invalid regex: ${excludeRegex}`);
			return true;
		}
	}

	/**
	 * Add missing empty lines at the bottom of the editor view.
	 */
	private async padEditorBottom(file: TFile, editor: Editor) {
		const text = editor.getValue();
		const trailing = countTrailingEmptyLines(text);
		const needed = this.settings.emptyLines - trailing;

		if (needed > 0) {
			const pos = { line: editor.lineCount(), ch: 0 };
			editor.replaceRange("\n".repeat(needed), pos, pos);
		}
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/**
 * Counts the number of trailing empty lines in a string robustly.
 */
function countTrailingEmptyLines(text: string): number {
	const lines = text.split('\n');
	let count = 0;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].trim() === '') {
			count++;
		} else {
			// Stop at the first non-empty line.
			break;
		}
	}
	// An edge case: a single line of text like "hello" is split into `['hello']`.
	// The loop will see it's not empty and break, count is 0. This is correct.
	// But if the file ends with a non-empty line, that line itself isn't a "trailing empty line".
	// The loop correctly excludes it. So the raw count is correct.
	return count;
}


/**
 * Removes all trailing newline characters from a string.
 * Using this regex is more precise than trimEnd() as it won't remove spaces on the last content line.
 */
function removeTrailingEmptyLines(text: string): string {
	return text.replace(/[\r\n\s]+$/, "");
}

class StickyEmptyLinesSettingTab extends PluginSettingTab {
	plugin: StickyEmptyLinesPlugin;

	constructor(app: App, plugin: StickyEmptyLinesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "StickyEmptyLines Settings" });

		new Setting(containerEl)
			.setName("Empty lines at bottom")
			.setDesc(
				"Number of empty lines to keep at the end of the file during editing (0–20)."
			)
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.max = "20";
				text.inputEl.style.width = "60px";
				text
					.setPlaceholder("5")
					.setValue(this.plugin.settings.emptyLines.toString())
					.onChange(async (value) => {
						let num = parseInt(value, 10);
						if (isNaN(num)) num = DEFAULT_SETTINGS.emptyLines;

						num = Math.max(0, Math.min(num, 20));

						this.plugin.settings.emptyLines = num;
						await this.plugin.saveSettings();
						text.setValue(num.toString());
					});
			});

		new Setting(containerEl)
			.setName("Exclude files (regex)")
			.setDesc(
				"Files with a path or content matching this regex will be ignored."
			)
			.addText((text) =>
				text
					.setPlaceholder("e.g., Excalidraw/.+ or DO_NOT_TOUCH")
					.setValue(this.plugin.settings.excludeRegex)
					.onChange(async (value) => {
						this.plugin.settings.excludeRegex = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
