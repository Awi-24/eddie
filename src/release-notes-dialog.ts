import { icons } from "./icons";

declare const __APP_VERSION__: string;

const RELEASE_NOTES: string[] = [
  "Document-first layout with a top navbar (File, Settings, Help) and a bottom bar for tabs and status metrics",
  "Retro EZ default theme — white, black, and gray palette with System 7–inspired chrome",
  "Frameless window with theme-aware minimize, maximize, and close controls",
  "WYSIWYG Markdown editing (Milkdown / Crepe) with selection toolbar and slash menu",
  "Full GFM support: tables, syntax-highlighted code blocks, and task lists",
  "Mermaid diagram blocks render live in the editor and in PDF export",
  "Eleven built-in themes including GitHub, VS Code, Solarized, Dracula, Nord, Cyberpunk, and macOS",
  "Reader mode, wide reading column, optional status bar, and recent files in the File menu",
  "Multiple tabs with unsaved-change indicators and rename-from-heading file names",
  "Export to PDF, custom context menus, and auto-reload when files change on disk",
  "Flat line icons and themed dialogs for keyboard shortcuts and release notes",
  "Logo inverts on dark themes; transparent mark without edge halo",
  "NSIS installer with retro UI and optional default handler for .md files on Windows",
  "Linux .deb and AppImage with default Markdown association via xdg-mime",
  "In-app updates from Settings (Windows and Linux)",
];

let backdrop: HTMLElement | null = null;

/** Themed version and release notes dialog. */
export function showReleaseNotesDialog(): void {
  if (!backdrop) {
    backdrop = buildDialog();
    document.body.appendChild(backdrop);
  }
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    backdrop?.querySelector<HTMLButtonElement>(".app-dialog-close")?.focus();
  });
}

function closeDialog(): void {
  if (backdrop) backdrop.hidden = true;
}

function buildDialog(): HTMLElement {
  const root = document.createElement("div");
  root.className = "app-dialog-backdrop";
  root.hidden = true;
  root.innerHTML = `
    <div class="app-dialog app-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
      <header class="app-dialog-header">
        <h2 id="release-notes-title" class="app-dialog-title">ez.down ${__APP_VERSION__}</h2>
        <button type="button" class="app-dialog-close" aria-label="Close">${icons.close}</button>
      </header>
      <div class="app-dialog-body">
        <p class="release-notes-intro">The first public release includes:</p>
        <ul class="release-notes-list">
          ${RELEASE_NOTES.map((note) => `<li>${note}</li>`).join("")}
        </ul>
        <p class="release-notes-footer">MIT · Adrian Widmer</p>
      </div>
    </div>`;

  root.addEventListener("click", (e) => {
    if (e.target === root) closeDialog();
  });

  root.querySelector(".app-dialog-close")?.addEventListener("click", closeDialog);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && !backdrop.hidden) closeDialog();
  });

  return root;
}
