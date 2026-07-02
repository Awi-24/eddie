## Learned User Preferences

- Prefers communicating in Portuguese.
- Wants UI controls and chrome polished and consistent with the active theme (dropdowns, scrollbars, context menus, task-list checkboxes).
- Prefers a document-first layout: compact top navbar (File/Settings/Help dropdowns), full-width editor, bottom bar with tabs left and metrics right on the same row, and optional reader-only mode.
- Prefers consolidated chrome (menus in navbar dropdowns, not duplicate controls across sidebar and topbar).
- No emojis in UI; wants flat line icons (minimal, legible at small sizes).
- Default retro theme blends Mac System 7, Digitalism neo-brutalism, and Aeonik Fono aesthetics; heavy retro chrome applies only to the retro theme, not all themes.
- Custom per-theme window controls on a frameless Tauri window.
- File navigation via a compact recent-files list in the File menu dropdown, not a persistent sidebar file tree.
- Wants tab titles and new-file names derived from the Markdown heading or first line when possible.
- Wants Mermaid and HTML markdown blocks to render (editable code plus preview), not only raw code blocks.
- Expects GitHub Releases to include Windows and Linux installers, not just source archives.

## Learned Workspace Facts

- ez.down is a Tauri 2 desktop Markdown editor: Vite/TypeScript frontend, Milkdown Crepe editor, Rust backend in `src-tauri/`.
- GitHub repo is `Awi-24/ez.down`; pushing a `v*` tag triggers `.github/workflows/release.yml` (Windows NSIS `.exe`, Linux `.deb` and AppImage).
- Keep version in sync across `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
- App preferences live in `src/preferences.ts` (localStorage); settings UI is in the navbar Settings dropdown (`src/navbar.ts`).
- Tab naming, rename, and save-path logic live in `src/naming.ts` and `src/tabs.ts`; file rename uses the Rust `rename_file` command.
- Current release line is `1.0.0` (first public release; prior beta builds were internal).
- UI shell: navbar replaces sidebar; `src/sidebar.ts` removed; bottom bar holds tabbar and status metrics.
- Default theme is `retro`; theme tokens in `src/themes/skins.css`.
- Mermaid/HTML previews via `src/diagram-renderer.ts` with a `mermaid` dependency.
