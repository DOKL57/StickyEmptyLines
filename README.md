# StickyEmptyLines

A minimal, robust Obsidian plugin to manage empty lines at the bottom of Markdown files.

---

## What does it do?

- **While editing:**  
  Keeps _X_ empty lines at the end of every Markdown file in the editor, so you can easily click and type at the bottom.
- **On switching files or tabs:**  
  Cleans up and removes _all_ trailing empty lines at the end of the previous file, saving a tidy file to disk.
- **Settings:**
	- Choose how many empty lines are kept in the editor.
	- Exclude files from processing by providing a regular expression filter.
- **Respects manual edits:**  
  If you manually add or remove blank lines while editing, the plugin won’t interfere until you switch files/tabs.
- **No effect on empty lines in the middle of files.**
- **Works only for Markdown files.**

---

## Settings

- **Empty lines at bottom**  
  Set the number of empty lines (0–20) to keep at the end of the file during editing.  
  Default: `5`
- **Exclude files containing (regex)**  
  If a file's content matches this regex, it will be ignored by the plugin (no adding or cleaning of empty lines).

---

## Example scenarios

| Scenario                                            | What happens                                    |
|-----------------------------------------------------|-------------------------------------------------|
| Open a file with 0 blank lines at the end, X=5      | Adds 5 blank lines in the editor (not on disk)  |
| Manually remove 2 of them                           | Plugin does **not** restore until you switch    |
| Switch to another file/tab                          | Cleans all trailing blank lines and saves file  |
| Add blank lines in the middle of the file           | Plugin does **not** touch them                  |
| Change X in settings                                | Applies to current file immediately             |
| File content matches exclude regex                  | Plugin ignores that file completely             |

---

## Why?

If you like a "buffer" of empty lines for comfort while editing, but want clean, professional Markdown files without trailing blank lines on disk, this plugin is for you.  
It keeps your workflow comfy and your files tidy.

---

## Limitations

- Only one regex filter (case-sensitive).
- Only works for `.md` files.
- Does not resolve sync/merge conflicts.
- Does not affect the file unless you open it in the editor.

---

## Possible improvements (future)

- Option to preserve file mtime on cleaning.
- More advanced exclude filters (by path, frontmatter, etc.).
- Multi-regex or tag-based exclusion.

---

## License

MIT

---

*Simple, reliable, and as “dumb” as possible. For more power, fork and extend!*
