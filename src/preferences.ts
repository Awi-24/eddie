import { ThemeId, THEMES, applyTheme } from "./themes";

export interface Preferences {
  theme: ThemeId;
  readerMode: boolean;
  showStatusbar: boolean;
  wideColumn: boolean;
  recentFiles: string[];
}

const PREFS_KEY = "ezdown.preferences";
const LEGACY_THEME_KEY = "ezdown.theme";
const MAX_RECENT_FILES = 8;

const DEFAULT: Preferences = {
  theme: "retro",
  readerMode: false,
  showStatusbar: true,
  wideColumn: false,
  recentFiles: [],
};

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

function normalizeRecent(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  return files.filter((f): f is string => typeof f === "string").slice(0, MAX_RECENT_FILES);
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Preferences> & {
        sidebarCollapsedOnStart?: boolean;
      };
      const { sidebarCollapsedOnStart: _removed, ...rest } = parsed;
      return {
        ...DEFAULT,
        ...rest,
        theme:
          rest.theme && THEMES.includes(rest.theme) ? rest.theme : DEFAULT.theme,
        recentFiles: normalizeRecent(rest.recentFiles),
      };
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

export function addRecentFile(path: string): void {
  const prefs = loadPreferences();
  const next = [path, ...prefs.recentFiles.filter((p) => p !== path)].slice(
    0,
    MAX_RECENT_FILES
  );
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
