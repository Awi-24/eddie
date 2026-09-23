<div align="center">

# Eddie

**A lightweight, beautiful, open-source WYSIWYG Markdown editor & reader for Windows, Linux, and macOS.**

</div>

Eddie opens `.md` files already formatted (Typora-style): you edit directly in
the rendered text — no raw syntax. Set it as your default app for Markdown files
and read or write with a clean, document-first interface.

## Features

- ✍️ **WYSIWYG editing** (Milkdown / Crepe on ProseMirror) — no split source pane.
- 🫧 **Selection toolbar** when you highlight text, plus a **`/` menu** to insert
  blocks — format without knowing Markdown syntax.
- 📄 **Full GFM**: tables, syntax-highlighted code blocks, task lists, footnotes, LaTeX math, and **Mermaid** diagrams with a **Show preview / Show code** toggle in edit mode.
- 🧩 **Embedded HTML** (`<kbd>`, `<sub>`, `<details>`, `<div align="center">`…) renders sanitized and isolated; double-click to edit the source.
- 🗂️ **Front matter** and **GitHub alerts** (`> [!NOTE]`) are kept intact; untouched files are never rewritten on save.
- 🔎 **Find & replace** (`Ctrl+F` / `Ctrl+H`) and an **Outline** of headings in the sidebar (`Ctrl+Shift+O`).
- 🎨 **Themes**: Retro EZ (default), Notebook, GitHub, VS Code Light/Dark, Solarized Light/Dark,
  Dracula, Nord, Cyberpunk, **Pink**, **Pixel**, **Nandão**, and **macOS** (traffic-light window chrome).
- 📐 **Sidebar shell** — collapsible sidebar (`Ctrl+\`) with the File / View / Settings / Help menus, Files and Outline panes,
  and Eddie at the bottom; slim title bar with the document name, full-width editor, bottom bar with tabs and optional metrics.
- 👁️ **View menu** — reader mode, find, sidebar, files, outline, mascot, wide column, status bar.
- 📖 **Reader mode** — view-only; hides editing controls for distraction-free reading.
- 📁 **Open file or folder** — **Open file** uses the system file picker; **Open folder** shows the folder in the sidebar's **Files** pane with breadcrumb navigation; the empty state lists your 5 most recent files.
- 🪟 **Multiple tabs** with unsaved-change indicators and smart names from document headings.
- 🔗 **File association** for `.md` / `.markdown` (open on double-click).
- 📊 **Status bar** with live word, character and line counts (optional).
- 📤 **Export to PDF** from the File menu or context menu.
- 🖱️ **Custom context menus** per area (editor, tabs, empty state).
- 🔁 **Auto-reload** when a file changes outside the app.
- ⬆️ **In-app updates** — check and install new versions from Settings (Windows & Linux).

GitHub Releases also ship **macOS `.dmg`** installers (Universal: Apple Silicon + Intel).

## View & Settings

| Menu | Option | Description |
| ---- | ------ | ----------- |
| View | **Reader mode** | Read-only — no editing or saving (`Ctrl+Shift+E`) |
| View | **Find / Replace** | Search the document (`Ctrl+F`, `Ctrl+H`) |
| View | **Sidebar / Files / Outline** | Collapse the sidebar (`Ctrl+\`) or switch its pane |
| View | **Mascot** | Show or hide Eddie at the bottom of the sidebar |
| View | **Wide reading column** | Broader text column (920px) |
| View | **Status bar** | Toggle word/line counts in the bottom bar |
| Settings | **Theme** | Light/dark skins including Retro EZ and macOS-style chrome |
| Settings | **Updates** | Check for updates and install in place |

Preferences are stored locally and persist across sessions.

## Changelog

### 1.1.0

- **New name: Eddie** (formerly ez.down). Updating from ez.down removes the old install on Windows; preferences are kept.
- **Markdown fidelity** — YAML front matter is preserved (shown as *Properties*), embedded HTML renders instead of showing raw tags, GitHub alerts are styled, inline `<br>` and image alt text survive saving, `-` bullets and `---` rules are kept, CRLF files stay CRLF, and saving a document you didn't edit writes it back byte-for-byte.
- **Safer HTML previews** — DOMPurify sanitizing, rendered in shadow DOM so a `<style>` block can't restyle the app.
- **Mermaid** diagrams follow the theme when switching between light and dark.
- **Menus** — new **View** menu; **Settings** now holds theme and updates; **About** moved to **Help**. With a menu open, hovering another menu switches to it.
- **Document title** in the title bar (italic while unsaved); double-click (or `F2`) to rename.
- **New logo** and **Eddie**, an ASCII mascot living in a little scene at the bottom of the sidebar: he wanders, waters his plant, naps at home when you're away, follows the mouse and cheers when you save. Toggle in **View → Mascot**. Redesigned: glides between spots, hops and throws sparkles, sleeps with floating z's, and his head is a crisp CSS frame that matches the logo.
- **Logo** — Eddie's face (two asterisk eyes in a retro box with a hard shadow) replaces the old mark in the app icons, installer art and sidebar header; the sidebar logo follows the active theme's colors.
- **Sidebar** replaces the top navbar: menus open as flyouts, the folder browser and the outline live in sidebar panes (no more floating panels).
- **Find & replace**, **Save as…**, and shortcuts for close tab, switch tab, sidebar and reader mode.
- Saving no longer reloads the editor (cursor and scroll stay put).

### 1.0.3

- **Retro EZ** — single thick chrome line under the navbar and above the bottom bar (no duplicate shadow bands).
- **Reader mode** — task-list checkboxes can be toggled without enabling full editing.
- **Open file / Open folder** — separate actions: file picker for one `.md`, or a folder for the project browser.
- **Folder panel** — floating browser with back button, breadcrumb path, drag, magnetic edge snap, and minimize to a circular bubble (click to expand); toggle in **Settings → Folder panel**.
- **Empty state** — up to **5 recent** files, deduplicated; missing or moved paths are removed automatically.
- **New themes** — Pink, Pixel (8-bit chrome), and Nandão (warm orange).
- **macOS** — Universal `.dmg` in GitHub Releases (CI).

### 1.0.2

- **In-app updates** — installers and `latest.json` use the correct version string; update check works from 1.0.0 installs.
- **Update feedback** — Settings → Check for updates shows a dialog when up to date or on failure.

### 1.0.1

- **Mermaid & HTML previews** — uses Crepe's native preview panel (fixes duplicate renders, lag, and code showing next to preview).
- **Edit mode** — source code by default; **Show preview** / **Show code** on `mermaid` and `html` fences.
- **Reader mode** — diagram and HTML previews only, without the code editor.
- **PDF export** — waits for Mermaid diagrams to finish rendering before printing.
- **Windows installer** — redesigned NSIS UI (retro black/white/gray, app logo on header and sidebar).

### 1.0.0

First public release: document-first shell, Retro EZ theme, frameless window, WYSIWYG editing, eleven themes, tabs, PDF export, file association, in-app updates, and Linux/Windows installers.

## Release

Current version: **1.1.0**.

## Tech stack

| Layer          | Technology               |
| -------------- | ------------------------ |
| Shell / OS     | Tauri 2 (Rust)           |
| Editor         | Milkdown + Crepe (TypeScript) |
| Frontend build | Vite + TypeScript        |

## Development

Prerequisites: [Node.js](https://nodejs.org), [Rust](https://rustup.rs), and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev      # run the app in development mode
```

## Building installers

### Local build

```bash
npm run tauri build
```

This produces, under `src-tauri/target/release/bundle/`:

- **Windows** — an NSIS installer (`.exe`) with retro-themed UI matching the app.
  During setup you can choose to set Eddie as the default app for `.md` files.
  File associations are also registered under "Open with".
- **Linux** — `.deb` and AppImage packages. The `.deb` registers the
  `text/markdown` MIME association and sets Eddie as the default handler
  via `xdg-mime` (opt out with `EDDIE_SKIP_DEFAULT_MIME=1` before install).
- **macOS** — `.dmg` disk image with a Universal binary (Apple Silicon + Intel).
  First launch may require **Right click → Open** if the app is not notarized.

To verify the file association after installing on Linux:

```bash
xdg-mime query default text/markdown
```

Regenerate Windows installer artwork after changing `src/assets/logo.png`:

```bash
python scripts/generate-installer-assets.py
```

### GitHub Release (CI)

Pushes to tags matching `v*` trigger [`.github/workflows/release.yml`](.github/workflows/release.yml),
which builds signed installers for **Windows**, **Linux**, and **macOS**, uploads them to GitHub Releases, and publishes a `latest.json`
manifest for in-app updates (Windows & Linux).

### Updater signing (required for CI)

Generate a key pair once (keep the private key secret):

```bash
npm run tauri -- signer generate --ci -w ~/.tauri/eddie.key -p "" -f
```

Add GitHub repository secrets:

| Secret | Value |
| ------ | ----- |
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `~/.tauri/eddie.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Leave empty if the key has no password |

The public key is already in `src-tauri/tauri.conf.json`. **Do not commit the private key.**

1. Bump the version in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and
   `src-tauri/Cargo.toml` (run `npm install` so the lockfile stays in sync).
2. Update `src/release-notes-dialog.ts` and this README changelog if needed.
3. Commit, tag, and push:

```bash
git add README.md index.html package.json package-lock.json `
  .github/workflows/release.yml `
  src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json `
  src/editor.ts src/icons.ts src/main.ts src/navbar.ts src/preferences.ts `
  src/release-notes-dialog.ts src/styles.css src/themes/index.ts src/themes/skins.css `
  src/empty-recent.ts src/folder-panel.ts src/sidebar.ts src/outline.ts src/find.ts src/mascot.ts src/markdown-extras.ts

git status

git commit -m "Release v1.1.0"

git tag v1.1.0

git push origin main
git push origin v1.1.0
```

You can also run the workflow manually from the **Actions** tab (`workflow_dispatch`).

Ensure **Settings → Actions → General → Workflow permissions** is set to
**Read and write permissions** so the workflow can create releases.

## Keyboard shortcuts

| Shortcut   | Action          |
| ---------- | --------------- |
| `Ctrl+N`   | New document    |
| `Ctrl+O`   | Open file       |
| `Ctrl+S`   | Save            |
| `Ctrl+Shift+S` | Save as     |
| `Ctrl+W`   | Close tab       |
| `Ctrl+Tab` | Next tab        |
| `Ctrl+F` / `Ctrl+H` | Find / replace |
| `Ctrl+Shift+O` | Outline     |
| `Ctrl+\`   | Toggle sidebar  |
| `Ctrl+Shift+E` | Reader mode |
| `F2`       | Rename document |

See **Help → Keyboard shortcuts** in the app for the full list.

## License

[MIT](LICENSE) © 2026 Adrian Widmer
