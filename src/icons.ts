// Flat line icons — minimal, legible at 16–20px. No emojis. Uses currentColor.

const svg = (paths: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths}</svg>`;

export const icons = {
  file: svg(
    '<path d="M5 4h8l6 6v12H5z"/><path d="M13 4v6h6"/>'
  ),
  filePlus: svg(
    '<path d="M5 4h8l6 6v12H5z"/><path d="M13 4v6h6"/><path d="M12 13v6"/><path d="M9 16h6"/>'
  ),
  folder: svg('<path d="M3 7h6l2 2h10v10H3z"/>'),
  folderOpen: svg(
    '<path d="M3 7h6l2 2h10"/><path d="M3 7v12h16l2-6H5"/>'
  ),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
  chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
  chevronRight: svg('<path d="M9 6l6 6-6 6"/>'),
  close: svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'),
  filePdf: svg(
    '<path d="M5 4h8l6 6v12H5z"/><path d="M13 4v6h6"/><path d="M8 14h8"/><path d="M8 17h5"/>'
  ),
  settings: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>'
  ),
  help: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.2 1.8c0 2-2.7 2.2-2.7 3.7"/><path d="M12 17h.01"/>'
  ),
  theme: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>'
  ),
  keyboard: svg(
    '<rect x="2" y="6" width="20" height="12" rx="1"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>'
  ),
  minimize: svg('<path d="M5 12h14"/>'),
  maximize: svg('<rect x="5" y="5" width="14" height="14"/>'),
  restore: svg('<path d="M8 8h10v10H8z"/><path d="M6 6h10v10"/>'),
};

/** Build a button's inner HTML: icon + optional label. */
export function iconLabel(icon: string, label?: string): string {
  return label ? `${icon}<span>${label}</span>` : icon;
}
