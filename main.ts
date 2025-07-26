import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	MarkdownView,
	Editor,
	WorkspaceLeaf,
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
	 * This is the central logic that runs when the user switches to a new file.
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
			// Check against file path first, which is a common use case.
			if (regex.test(file.path)) return false;

			// Then check against content as described in the original plugin.
			const content = await this.app.vault.cachedRead(file);
			return !regex.test(content);
		} catch (e) {
			console.warn(`[StickyEmptyLines] Invalid regex: ${excludeRegex}`);
			return true; // Fail open and process the file if regex is broken.
		}
	}

	/**
	 * Add missing empty lines at the bottom of the editor view.
	 * This only affects the editor, not the file on disk.
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

	/**
	 * Get the active Markdown view, ensuring it's in a mode with an editor.
	 */
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
 * Counts the number of trailing empty lines in a string.
 */
function countTrailingEmptyLines(text: string): number {
	const match = text.match(/(\s*)$/);
	if (!match) return 0;

	const trailingWhitespace = match[1];
	if (!trailingWhitespace.includes('\n')) return 0; // No newlines, so no empty lines.

	// Split by newline and count empty strings from the end.
	const lines = text.split("\n");
	let count = 0;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].trim() === "") {
			count++;
		} else {
			break;
		}
	}
    // If the text ends with non-empty content, the last "line" isn't a trailing empty one.
    // e.g. "hello\n", lines is ["hello", ""], count should be 1.
    // e.g. "hello", lines is ["hello"], count should be 0.
    if (lines.length > 1 && lines[lines.length-1].trim() === "") {
        return count;
    }
    // A special case for text that is only whitespace.
    if (lines.length === count) {
        return count;
    }
    return Math.max(0, count-1);
}

/**
 * Removes all trailing empty lines and whitespace from a string.
 */
function removeTrailingEmptyLines(text: string): string {
	return text.trimEnd();
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

						num = Math.max(0, Math.min(num, 20)); // Clamp value

						this.plugin.settings.emptyLines = num;
						await this.plugin.saveSettings();
						text.setValue(num.toString()); // Update UI to reflect sanitized value
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
