# StickyEmptyLines

Minimal, robust Obsidian plugin for managing empty lines at the bottom of Markdown files.

---

## How it works

- **When you open a Markdown file**:  
  Adds _X_ empty lines at the end (editor only).
- **When you switch away from the file/tab**:  
  Removes all trailing empty lines (on disk).
- **Settings**:
	- Number of empty lines to keep at bottom (0–20).
	- Exclude files via regex filter.
- **No effect on lines in the middle.**
- **Works only with `.md` files.**

---

## Settings

- **Empty lines at bottom**  
  Number of empty lines to keep at the end of the file (default: `5`).
- **Exclude files containing (regex)**  
  Files matching this regex are ignored by the plugin.

---

## Example scenarios

| Scenario            | Result                                      |
|---------------------|---------------------------------------------|
| Open file (X=5)     | Adds up to 5 blank lines at bottom (editor) |
| Switch file/tab     | Removes all blank lines at bottom (on disk) |
| Middle edits        | Untouched                                   |
| Regex exclusion     | File ignored                                |

---

## Limitations

- One regex filter (case-sensitive).
- Only `.md` files supported.
- Doesn't handle sync conflicts.

---

## License

MIT
