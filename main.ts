import { App, Plugin, PluginSettingTab, Setting, TFile, MarkdownView } from "obsidian";

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
    private lastActiveFile: TFile | null = null;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new StickyEmptyLinesSettingTab(this.app, this));

        // Listen for all file/tab/editor changes
        this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.onFileSwitch()));
        this.registerEvent(this.app.workspace.on("file-open", () => void this.onFileSwitch()));
        this.registerEvent(this.app.workspace.on("editor-change", () => void this.onFileSwitch()));

        // Initial application when the plugin loads
        void this.onFileSwitch();
    }

    onunload() {
        // Clean up the last active file on plugin unload
        void this.cleanTrailingLines(this.lastActiveFile);
    }

    /**
     * Called on every file/tab/editor switch:
     * - Cleans trailing empty lines in the previous file (on disk)
     * - Adds X empty lines in the editor of the new file (does not save)
     */
    private async onFileSwitch() {
        // Clean previous file (if any)
        await this.cleanTrailingLines(this.lastActiveFile);

        // Get current markdown view and editor
        const mdView = this.getActiveMarkdownView();
        const file = mdView?.file;
        const editor = mdView?.editor;

        // If file is valid and not excluded, add empty lines in editor
        if (file && editor && file.extension === "md" && !(await this.shouldIgnoreFile(file))) {
            const text = editor.getValue();
            const missing = this.settings.emptyLines - countTrailingEmptyLines(text);
            if (missing > 0) {
                const pos = { line: editor.lineCount(), ch: 0 };
                editor.replaceRange("\n".repeat(missing), pos, pos);
            }
        }

        // Update the tracker for the next switch
        this.lastActiveFile = file ?? null;
    }

    /**
     * Removes all trailing empty lines at the end of a file and saves the cleaned content.
     */
    private async cleanTrailingLines(file: TFile | null) {
        if (!file || file.extension !== "md" || await this.shouldIgnoreFile(file)) return;
        const content = await this.app.vault.read(file);
        const cleaned = content.replace(/\n*$/g, "");
        if (content !== cleaned) {
            await this.app.vault.modify(file, cleaned);
        }
    }

    /**
     * Returns true if file should be excluded based on content regex.
     */
    private async shouldIgnoreFile(file: TFile): Promise<boolean> {
        const { excludeRegex } = this.settings;
        if (!excludeRegex) return false;
        try {
            const regex = new RegExp(excludeRegex);
            const content = await this.app.vault.read(file);
            return regex.test(content);
        } catch (e) {
            console.warn(`[StickyEmptyLines] Invalid regex: ${excludeRegex}`);
            return false;
        }
    }

    /**
     * Gets the currently active markdown view in source mode, or null.
     */
    private getActiveMarkdownView(): MarkdownView | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        // Only apply in source (edit) mode
        // @ts-ignore: getMode may not exist in all API versions
        if (!view || (view.getMode && view.getMode() !== "source")) return null;
        return view;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

/**
 * Counts how many empty lines are at the end of the text.
 */
function countTrailingEmptyLines(text: string): number {
    const lines = text.split("\n");
    let count = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() === "") count++;
        else break;
    }
    return count;
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

        // Numeric input for empty lines at the bottom (with validation)
        new Setting(containerEl)
            .setName("Empty lines at bottom")
            .setDesc("Number of empty lines to keep at the end of the file while editing (0–20).")
            .addText(text => {
                text
                    .setPlaceholder("5")
                    .setValue(this.plugin.settings.emptyLines.toString())
                    .onChange(async (value) => {
                        let num = parseInt(value.replace(/[^0-9]/g, ""), 10);
                        if (isNaN(num)) num = 0;
                        if (num < 0) num = 0;
                        if (num > 20) num = 20;
                        this.plugin.settings.emptyLines = num;
                        await this.plugin.saveSettings();
                        await this.plugin.onFileSwitch();
                        text.setValue(num.toString());
                    });
                text.inputEl.type = "number";
                text.inputEl.min = "0";
                text.inputEl.max = "20";
                text.inputEl.style.width = "50px";
            });

        // Regex filter for excluding files
        new Setting(containerEl)
            .setName("Exclude files containing (regex)")
            .setDesc("If file content matches this regex, it will not be touched by the plugin. Example: ^---DO NOT TOUCH---")
            .addText(text =>
                text
                    .setPlaceholder("e.g. ^---DO NOT TOUCH---")
                    .setValue(this.plugin.settings.excludeRegex)
                    .onChange(async (value) => {
                        this.plugin.settings.excludeRegex = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
