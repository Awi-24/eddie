export type ThemeId =
  | "retro"
  | "notebook"
  | "github"
  | "vscode-light"
  | "solarized-light"
  | "macos"
  | "dracula"
  | "nord"
  | "solarized-dark"
  | "cyberpunk"
  | "vscode-dark";

const DEFAULT: ThemeId = "retro";

export const THEMES: ThemeId[] = [
  "retro",
  "notebook",
  "github",
  "vscode-light",
  "solarized-light",
  "macos",
  "dracula",
  "nord",
  "solarized-dark",
  "cyberpunk",
  "vscode-dark",
];

export const THEME_LABELS: Record<ThemeId, string> = {
  retro: "Retro EZ",
  notebook: "Notebook",
  github: "GitHub",
  "vscode-light": "VS Code Light",
  "solarized-light": "Solarized Light",
  macos: "macOS",
  dracula: "Dracula",
  nord: "Nord",
  "solarized-dark": "Solarized Dark",
  cyberpunk: "Cyberpunk",
  "vscode-dark": "VS Code Dark",
};

export const THEME_GROUPS: { label: string; ids: ThemeId[] }[] = [
  {
    label: "Light",
    ids: ["retro", "notebook", "github", "vscode-light", "solarized-light", "macos"],
  },
  {
    label: "Dark",
    ids: ["dracula", "nord", "solarized-dark", "cyberpunk", "vscode-dark"],
  },
];

const DARK_THEMES = new Set<ThemeId>(THEME_GROUPS[1].ids);

/** Apply a skin to the document root (persistence lives in preferences.ts). */
export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute(
    "data-theme-tone",
    DARK_THEMES.has(theme) ? "dark" : "light"
  );
}

export function isThemeId(value: string): value is ThemeId {
  return THEMES.includes(value as ThemeId);
}

export { DEFAULT as DEFAULT_THEME };
