import { ThemeId, THEMES, applyTheme } from "./themes";
import type { PanelDock } from "./floating-panel-magnet";

export interface Preferences {
  theme: ThemeId;
  readerMode: boolean;
  showStatusbar: boolean;
  wideColumn: boolean;
  recentFiles: string[];
  openFolder: string | null;
  folderPanelVisible: boolean;
  folderPanelMinimized: boolean;
  folderPanelDock: PanelDock;
  folderPanelPos: { x: number; y: number } | null;
}

const PREFS_KEY = "ezdown.preferences";
const LEGACY_THEME_KEY = "ezdown.theme";
export const MAX_RECENT_FILES = 8;
export const RECENT_EMPTY_COUNT = 5;

const DEFAULT: Preferences = {
  theme: "retro",
  readerMode: false,
  showStatusbar: true,
  wideColumn: false,
  recentFiles: [],
  openFolder: null,
  folderPanelVisible: false,
  folderPanelMinimized: false,
  folderPanelDock: "left",
  folderPanelPos: null,
};

function normalizePanelDock(value: unknown): PanelDock {
  return value === "left" || value === "right" || value === "free"
    ? value
    : DEFAULT.folderPanelDock;
}

type PrefListener = (prefs: Preferences) => void;
const listeners = new Set<PrefListener>();

function migrateLegacyTheme(): ThemeId | null {
  const legacy = localStorage.getItem(LEGACY_THEME_KEY) as ThemeId | null;
  if (legacy && THEMES.includes(legacy)) {
    localStorage.removeItem(LEGACY_THEME_KEY);
    return legacy;
  }
  return null;
}

/** Stable key for recent-file dedupe (handles slashes, casing, file://, \\?\). */
export function normalizeRecentPath(path: string): string {
  let p = path.trim();
  if (!p) return "";

  if (/^file:\/\//i.test(p)) {
    try {
      p = decodeURIComponent(new URL(p).pathname);
      if (/^\/[a-zA-Z]:\//.test(p)) p = p.slice(1);
    } catch {
      p = p.replace(/^file:\/\//i, "");
    }
  }

  p = p.replace(/^\\\\\?\\?/i, "");
  p = p.replace(/\\/g, "/").replace(/\/+/g, "/");

  const winAbs = /^[a-zA-Z]:\//.exec(p);
  const parts = p.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      const minLen = winAbs ? 1 : 0;
      if (resolved.length > minLen) resolved.pop();
      continue;
    }
    resolved.push(part);
  }

  if (winAbs) {
    p = `${resolved[0]?.toLowerCase() ?? winAbs[0].toLowerCase()}/${resolved.slice(1).join("/")}`;
  } else if (p.startsWith("/")) {
    p = `/${resolved.join("/")}`;
  } else {
    p = resolved.join("/");
  }

  if (p.length > 3 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }

  return p.toLowerCase();
}

function dedupeRecent(files: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const file of files) {
    if (!file) continue;
    const key = normalizeRecentPath(file);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(file);
  }
  return unique;
}

function normalizeRecent(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  const strings = files.filter((f): f is string => typeof f === "string");
  return dedupeRecent(strings).slice(0, MAX_RECENT_FILES);
}

function healRecentInStorage(files: string[]): void {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const current = normalizeRecent(parsed.recentFiles);
    if (
      current.length === files.length &&
      current.every((p, i) => normalizeRecentPath(p) === normalizeRecentPath(files[i] ?? ""))
    ) {
      return;
    }
    parsed.recentFiles = files;
    localStorage.setItem(PREFS_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Preferences> & {
        sidebarCollapsedOnStart?: boolean;
      };
      const { sidebarCollapsedOnStart: _removed, ...rest } = parsed;
      const parsedRecent = Array.isArray(rest.recentFiles)
        ? rest.recentFiles.filter((f): f is string => typeof f === "string")
        : [];
      const recentFiles = normalizeRecent(parsedRecent);
      const hadDuplicateKeys =
        new Set(parsedRecent.map(normalizeRecentPath)).size !== parsedRecent.length;
      if (hadDuplicateKeys || recentFiles.length !== parsedRecent.length) {
        healRecentInStorage(recentFiles);
      }
      const prefs: Preferences = {
        ...DEFAULT,
        ...rest,
        theme:
          rest.theme && THEMES.includes(rest.theme) ? rest.theme : DEFAULT.theme,
        recentFiles,
        openFolder:
          typeof rest.openFolder === "string" ? rest.openFolder : DEFAULT.openFolder,
        folderPanelVisible:
          typeof rest.folderPanelVisible === "boolean"
            ? rest.folderPanelVisible
            : DEFAULT.folderPanelVisible,
        folderPanelMinimized:
          typeof rest.folderPanelMinimized === "boolean"
            ? rest.folderPanelMinimized
            : DEFAULT.folderPanelMinimized,
        folderPanelDock: normalizePanelDock(rest.folderPanelDock),
        folderPanelPos:
          rest.folderPanelPos &&
          typeof rest.folderPanelPos.x === "number" &&
          typeof rest.folderPanelPos.y === "number"
            ? rest.folderPanelPos
            : DEFAULT.folderPanelPos,
      };
      return prefs;
    }
  } catch {
    /* ignore corrupt prefs */
  }

  const legacyTheme = migrateLegacyTheme();
  return legacyTheme ? { ...DEFAULT, theme: legacyTheme } : { ...DEFAULT };
}

export function savePreferences(patch: Partial<Preferences>): Preferences {
  const next = { ...loadPreferences(), ...patch };
  if (patch.theme && !THEMES.includes(patch.theme)) {
    next.theme = DEFAULT.theme;
  }
  if (patch.recentFiles) {
    next.recentFiles = normalizeRecent(patch.recentFiles);
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  applyPreferences(next);
  listeners.forEach((fn) => fn(next));
  return next;
}

export function repairRecentFiles(): string[] {
  const prefs = loadPreferences();
  const next = normalizeRecent(prefs.recentFiles);
  const hadDuplicateKeys =
    new Set(prefs.recentFiles.map(normalizeRecentPath)).size !==
    prefs.recentFiles.length;
  if (hadDuplicateKeys || next.length !== prefs.recentFiles.length) {
    savePreferences({ recentFiles: next });
    return next;
  }
  return prefs.recentFiles;
}

export function addRecentFile(path: string): void {
  const trimmed = path.trim();
  if (!trimmed) return;
  const prefs = loadPreferences();
  const key = normalizeRecentPath(trimmed);
  const next = [
    trimmed,
    ...prefs.recentFiles.filter((p) => normalizeRecentPath(p) !== key),
  ].slice(0, MAX_RECENT_FILES);
  savePreferences({ recentFiles: next });
}

export function removeRecentFile(path: string): void {
  const prefs = loadPreferences();
  const key = normalizeRecentPath(path);
  const next = prefs.recentFiles.filter((p) => normalizeRecentPath(p) !== key);
  if (next.length === prefs.recentFiles.length) return;
  savePreferences({ recentFiles: next });
}

export function clearRecentFiles(): void {
  savePreferences({ recentFiles: [] });
}

export function onPreferencesChange(fn: PrefListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Apply DOM side effects for the current preference set. */
export function applyPreferences(prefs: Preferences): void {
  applyTheme(prefs.theme);
  document.documentElement.dataset.readerMode = prefs.readerMode ? "true" : "false";
  document.documentElement.dataset.wideColumn = prefs.wideColumn ? "true" : "false";
  document.documentElement.style.setProperty(
    "--content-width",
    prefs.wideColumn ? "920px" : "760px"
  );
}
