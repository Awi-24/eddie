<div align="center">

# ez.down

**A lightweight, beautiful, open-source WYSIWYG Markdown editor & reader for Windows and Linux.**

</div>

ez.down opens `.md` files already formatted (Typora-style): you edit directly in
the rendered text — no raw syntax. Set it as your default app for Markdown files
and read or write with a clean, document-first interface.

## Features

- ✍️ **WYSIWYG editing** (Milkdown / Crepe on ProseMirror) — no split source pane.
- 🫧 **Selection toolbar** when you highlight text, plus a **`/` menu** to insert
  blocks — format without knowing Markdown syntax.
- 📄 **Full GFM**: tables, syntax-highlighted code blocks, task lists, and **Mermaid** diagrams with a **Show preview / Show code** toggle in edit mode.
- 🎨 **Themes**: Retro EZ (default), Notebook, GitHub, VS Code Light/Dark, Solarized Light/Dark,
  Dracula, Nord, Cyberpunk, and **macOS** (traffic-light window chrome).
- 📐 **Document-first shell** — top navbar (File / Settings / Help), full-width editor,
  bottom bar with tabs and optional status metrics.
- ⚙️ **Settings menu** — theme, reader mode, wide column, status bar, and in-app updates.
- 📖 **Reader mode** — view-only; hides editing controls for distraction-free reading.
- 📁 **Open files or folders** — recent files in the File menu; folder open for quick access.
- 🪟 **Multiple tabs** with unsaved-change indicators and smart names from document headings.
- 🔗 **File association** for `.md` / `.markdown` (open on double-click).
- 📊 **Status bar** with live word, character and line counts (optional).
- 📤 **Export to PDF** from the File menu or context menu.
- 🖱️ **Custom context menus** per area (editor, tabs, empty state).
- 🔁 **Auto-reload** when a file changes outside the app.
- ⬆️ **In-app updates** — check and install new versions from Settings (Windows & Linux).

## Settings

Open **Settings** in the top navbar:

| Preference | Description |
| ---------- | ----------- |
| **Theme** | Light/dark skins including Retro EZ and macOS-style chrome |
| **Wide reading column** | Broader text column (920px) |
| **Show status bar** | Toggle word/line counts in the bottom bar |
| **Reader mode** | Read-only — no editing or saving |
| **Updates** | Check for updates and install in place |

Preferences are stored locally and persist across sessions.

## Changelog

### 1.0.1

- **Mermaid & HTML previews** — uses Crepe's native preview panel (fixes duplicate renders, lag, and code showing next to preview).
- **Edit mode** — source code by default; **Show preview** / **Show code** on `mermaid` and `html` fences.
- **Reader mode** — diagram and HTML previews only, without the code editor.
- **PDF export** — waits for Mermaid diagrams to finish rendering before printing.
- **Windows installer** — redesigned NSIS UI (retro black/white/gray, app logo on header and sidebar).

### 1.0.0

First public release: document-first shell, Retro EZ theme, frameless window, WYSIWYG editing, eleven themes, tabs, PDF export, file association, in-app updates, and Linux/Windows installers.

## Release

Current version: **1.0.0**. To ship **1.0.1**, bump the version, commit the changelog and code changes, tag, and push (see below).

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
  During setup you can choose to set ez.down as the default app for `.md` files.
  File associations are also registered under "Open with".
- **Linux** — `.deb` and AppImage packages. The `.deb` registers the
  `text/markdown` MIME association and sets ez.down as the default handler
  via `xdg-mime` (opt out with `EZDOWN_SKIP_DEFAULT_MIME=1` before install).

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
which builds signed installers, uploads them to GitHub Releases, and publishes a `latest.json`
manifest for in-app updates.

### Updater signing (required for CI)

Generate a key pair once (keep the private key secret):

```bash
npm run tauri -- signer generate --ci -w ~/.tauri/ezdown.key -p "" -f
```

Add GitHub repository secrets:

| Secret | Value |
| ------ | ----- |
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `~/.tauri/ezdown.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Leave empty if the key has no password |

The public key is already in `src-tauri/tauri.conf.json`. **Do not commit the private key.**

1. Bump the version in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and
   `src-tauri/Cargo.toml` (run `npm install` so the lockfile stays in sync).
2. Update `src/release-notes-dialog.ts` and this README changelog if needed.
3. Commit, tag, and push:

```bash
git add -A
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
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

See **Help → Keyboard shortcuts** in the app for the full list.

## License

[MIT](LICENSE) © 2026 Adrian Widmer
