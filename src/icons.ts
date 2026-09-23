// Flat line icons — minimal, legible at 14–20px. No emojis. Uses currentColor.
// Stroke width and cap/join style come from CSS (`.icon` in styles.css) so each
// theme can tune them: rounded by default, square and heavier for Retro/Pixel.

const svg = (paths: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">${paths}</svg>`;

export const icons = {
  // Documents
  file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  filePlus: svg(
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6M9 14h6"/>'
  ),
  // Two sheets, the back one peeking out: "files in this folder".
  files: svg(
    '<path d="M15 3h-5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V7z"/><path d="M15 3v4h4"/><path d="M5 8v11a2 2 0 0 0 2 2h8"/>'
  ),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  folderOpen: svg(
    '<path d="M4 18V7a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v1"/><path d="M4 18l2.4-6.2A1.5 1.5 0 0 1 7.8 11H20a1 1 0 0 1 .9 1.4l-2.4 5.4A2 2 0 0 1 16.7 19H5a1 1 0 0 1-1-1z"/>'
  ),
  // Outline: a tree of sections branching off one spine.
  headings: svg('<path d="M4 5h16"/><path d="M6 5v13"/><path d="M6 11h3M6 18h3"/><path d="M12 11h8M12 18h8"/>'),

  // App menus
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><path d="M15 4.5v5M9 14.5v5"/>'),
  help: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17.2v.01"/>'
  ),
  sidebar: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),

  // Controls
  chevronUp: svg('<path d="M6 15l6-6 6 6"/>'),
  chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
  chevronLeft: svg('<path d="M15 6l-6 6 6 6"/>'),
  chevronRight: svg('<path d="M9 6l6 6-6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  refresh: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v5h-5"/>'),

  // Window controls
  minimize: svg('<path d="M5 12h14"/>'),
  maximize: svg('<rect x="5" y="5" width="14" height="14" rx="1.5"/>'),
  restore: svg('<rect x="5" y="8" width="11" height="11" rx="1.5"/><path d="M8 5h9.5A1.5 1.5 0 0 1 19 6.5V16"/>'),
};

/** Build a button's inner HTML: icon + optional label. */
export function iconLabel(icon: string, label?: string): string {
  return label ? `${icon}<span>${label}</span>` : icon;
}
