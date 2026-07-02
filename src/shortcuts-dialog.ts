import { icons } from "./icons";

interface ShortcutEntry {
  label: string;
  keys: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { label: "New document", keys: "Ctrl+N" },
  { label: "Open file", keys: "Ctrl+O" },
  { label: "Save", keys: "Ctrl+S" },
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
