import { icons } from "./icons";

declare const __APP_VERSION__: string;

interface ReleaseEntry {
  intro: string;
  notes: string[];
}

const CHANGELOG: Record<string, ReleaseEntry> = {
  "1.1.0": {
    intro: "What's new in 1.1.0:",
    notes: [
      "New name: Eddie (formerly ez.down) — updating removes the old install on Windows and keeps your preferences",
      "New logo: Eddie's face, used for the app icon, installer and sidebar header; the sidebar logo follows the theme colors",
      "Eddie the mascot, redesigned — glides between spots, hops, sparkles when you save, sleeps with floating z's; toggle in View → Mascot",
      "Sidebar replaces the top navbar: menus open as flyouts, with Files and Outline panes",
      "Markdown fidelity — front matter, embedded HTML, GitHub alerts, CRLF and untouched files round-trip without rewriting",
      "Find & replace, Save as, new View menu, and shortcuts for tabs, sidebar and reader mode",
      "Document title in the title bar; double-click or F2 to rename",
    ],
  },
  "1.0.3": {
    intro: "What's new in 1.0.3:",
    notes: [
      "Retro EZ — single thick chrome line under the navbar and above the bottom bar (no duplicate shadow bands)",
      "Reader mode — task-list checkboxes can be toggled without enabling full editing",
      "Open file and Open folder are separate: file picker for one .md, or a folder for the project browser",
      "Folder panel — floating browser with back button, breadcrumb path, drag, magnetic edge snap, and minimize to a circular bubble; toggle in Settings → Folder panel",
      "Empty state — up to 5 recent files, deduplicated; missing or moved paths are removed automatically",
      "New themes: Pink, Pixel (8-bit chrome), and Nandão (warm orange)",
    ],
  },
  "1.0.2": {
    intro: "What's new in 1.0.2:",
    notes: [
      "Installers and latest.json now report the correct app version so in-app updates detect new releases",
      "Check for updates shows a dialog when you are up to date or when the check fails",
      "Settings menu reflects update status (Up to date / Update check failed)",
    ],
  },
  "1.0.1": {
    intro: "What's new in 1.0.1:",
    notes: [
      "Mermaid and HTML blocks use Crepe's native preview panel — fixes duplicate renders, lag, and code showing alongside preview",
      "Edit mode: source code by default; Show preview / Show code toggle on mermaid and html fences",
      "Reader mode: diagram and HTML previews only (no code editor chrome)",
      "PDF export waits for Mermaid diagrams to finish rendering before printing",
      "Windows NSIS installer redesigned — retro black/white/gray UI with app logo on header and sidebar",
    ],
  },
  "1.0.0": {
    intro: "The first public release included:",
    notes: [
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
    ],
  },
};

const VERSION_ORDER = ["1.0.3", "1.0.2", "1.0.1", "1.0.0"];

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

function renderReleaseSection(version: string, entry: ReleaseEntry): string {
  return `
    <section class="release-notes-section">
      <h3 class="release-notes-version">v${version}</h3>
      <p class="release-notes-intro">${entry.intro}</p>
      <ul class="release-notes-list">
        ${entry.notes.map((note) => `<li>${note}</li>`).join("")}
      </ul>
    </section>`;
}

function buildDialog(): HTMLElement {
  const sections = VERSION_ORDER.filter((v) => CHANGELOG[v]).map((v) =>
    renderReleaseSection(v, CHANGELOG[v]!)
  );

  const root = document.createElement("div");
  root.className = "app-dialog-backdrop";
  root.hidden = true;
  root.innerHTML = `
    <div class="app-dialog app-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
      <header class="app-dialog-header">
        <h2 id="release-notes-title" class="app-dialog-title">Eddie ${__APP_VERSION__}</h2>
        <button type="button" class="app-dialog-close" aria-label="Close">${icons.close}</button>
      </header>
      <div class="app-dialog-body release-notes-body">
        ${sections.join("")}
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
