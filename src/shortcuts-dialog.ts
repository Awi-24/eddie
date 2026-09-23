import { icons } from "./icons";

interface ShortcutEntry {
  label: string;
  keys: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { label: "New document", keys: "Ctrl+N" },
  { label: "Open file", keys: "Ctrl+O" },
  { label: "Save", keys: "Ctrl+S" },
  { label: "Save as", keys: "Ctrl+Shift+S" },
  { label: "Rename document", keys: "F2" },
  { label: "Close tab", keys: "Ctrl+W" },
  { label: "Next / previous tab", keys: "Ctrl+Tab / Ctrl+Shift+Tab" },
  { label: "Find", keys: "Ctrl+F" },
  { label: "Replace", keys: "Ctrl+H" },
  { label: "Toggle sidebar", keys: "Ctrl+\\" },
  { label: "Show outline", keys: "Ctrl+Shift+O" },
  { label: "Reader mode", keys: "Ctrl+Shift+E" },
  { label: "Bold / italic / inline code", keys: "Ctrl+B / Ctrl+I / Ctrl+E" },
  { label: "Undo / redo", keys: "Ctrl+Z / Ctrl+Y" },
  { label: "Copy", keys: "Ctrl+C" },
  { label: "Cut", keys: "Ctrl+X" },
  { label: "Paste", keys: "Ctrl+V" },
  { label: "Select all", keys: "Ctrl+A" },
  { label: "Close menu / dialog", keys: "Escape" },
];

let backdrop: HTMLElement | null = null;

/** Themed keyboard shortcuts reference dialog. */
export function showShortcutsDialog(): void {
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
    <div class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <header class="app-dialog-header">
        <h2 id="shortcuts-title" class="app-dialog-title">Keyboard shortcuts</h2>
        <button type="button" class="app-dialog-close" aria-label="Close">${icons.close}</button>
      </header>
      <div class="app-dialog-body">
        <dl class="shortcut-list">
          ${SHORTCUTS.map(
            (entry) =>
              `<div class="shortcut-row"><dt>${entry.label}</dt><dd><kbd>${entry.keys}</kbd></dd></div>`
          ).join("")}
        </dl>
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
