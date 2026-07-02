import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

import {
  readFile,
  writeFile,
  renameFile,
  setWatchedPaths,
  fileMeta,
  dirname,
  basename,
} from "./api";
import { mountEditor, EditorHandle } from "./editor";
import { TabsManager, Tab } from "./tabs";
import { icons, iconLabel } from "./icons";
import { showStatusbar, updateMetrics } from "./statusbar";
import { exportEditorToPdf } from "./pdf";
import { initContextMenu } from "./context-menu";
import {
  addRecentFile,
  applyPreferences,
  loadPreferences,
  onPreferencesChange,
  removeRecentFile,
  repairRecentFiles,
  savePreferences,
} from "./preferences";
import { initNavbar } from "./navbar";
import { initWindowControls } from "./window-controls";
import { initUpdateChecker } from "./updater";
import { initFolderPanel } from "./folder-panel";
import { initEmptyRecent } from "./empty-recent";
import {
  buildSavePath,
  ensureMdExtension,
  nameFromPath,
  sanitizeFilename,
  stripMdExtension,
} from "./naming";

import "./styles.css";
import "./themes/skins.css";

const MD_FILTER = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
];

const editorHost = document.getElementById("editor-host") as HTMLElement;
const emptyState = document.getElementById("empty-state") as HTMLElement;
const workspace = document.querySelector(".workspace") as HTMLElement;
const tabbar = document.getElementById("tabbar") as HTMLElement;
const menuFileBtn = document.getElementById("menu-file") as HTMLButtonElement;
const menuSettingsBtn = document.getElementById("menu-settings") as HTMLButtonElement;
const menuHelpBtn = document.getElementById("menu-help") as HTMLButtonElement;
const windowControls = document.getElementById("window-controls") as HTMLElement;
const emptyNewFile = document.getElementById("empty-new-file") as HTMLButtonElement;
const emptyOpenFile = document.getElementById("empty-open-file") as HTMLButtonElement;
const emptyOpenFolder = document.getElementById("empty-open-folder") as HTMLButtonElement;
const emptyRecent = document.getElementById("empty-recent") as HTMLElement;
const emptyRecentList = document.getElementById("empty-recent-list") as HTMLElement;

emptyNewFile.innerHTML = iconLabel(icons.filePlus, "New document");
emptyOpenFile.innerHTML = iconLabel(icons.file, "Open file");
emptyOpenFolder.innerHTML = iconLabel(icons.folderOpen, "Open folder");

let editor: EditorHandle | null = null;
let loading = false;
let showSeq = 0;
let activeModified: number | null = null;
let baseDir: string | null = null;
let hasOpenDocument = false;

const folderPanel = initFolderPanel(workspace, {
  onOpenFile: (path) => void openFile(path),
});

const emptyRecentBar = initEmptyRecent(emptyRecent, emptyRecentList, (path) => {
  void openFile(path);
});

function isReaderMode(): boolean {
  return loadPreferences().readerMode;
}

function refreshStatusbarVisibility(): void {
  showStatusbar(hasOpenDocument && loadPreferences().showStatusbar);
}

async function showTab(tab: Tab): Promise<void> {
  const seq = ++showSeq;
  loading = true;
  try {
    if (editor) {
      await editor.destroy();
      editor = null;
    }
    if (seq !== showSeq) return;

    editorHost.innerHTML = "";
    emptyState.hidden = true;
    editorHost.hidden = false;
    hasOpenDocument = true;
    refreshStatusbarVisibility();

    const readerMode = isReaderMode();
    editor = await mountEditor(
      editorHost,
      tab.workingContent,
      (md) => {
        if (loading) return;
        tabs.setWorking(tab.id, md);
        updateMetrics(md, activeModified);
      },
      readerMode
    );
    if (seq !== showSeq) {
      await editor.destroy();
      editor = null;
      return;
    }

    loading = false;
    editorHost.classList.remove("fade-in");
    void editorHost.offsetWidth;
    editorHost.classList.add("fade-in");

    baseDir = tab.path ? dirname(tab.path) : null;
    folderPanel.setActivePath(tab.path);
    processImages();
    activeModified = tab.path ? await fetchModified(tab.path) : null;
    if (seq !== showSeq) return;
    updateMetrics(tab.workingContent, activeModified);

    requestAnimationFrame(() => {
      if (seq !== showSeq) return;
      editorHost.querySelector<HTMLElement>(".ProseMirror")?.focus();
    });
  } catch (e) {
    console.error(e);
  } finally {
    if (seq === showSeq) loading = false;
  }
}

function showEmpty(): void {
  if (editor) {
    void editor.destroy();
    editor = null;
  }
  editorHost.innerHTML = "";
  editorHost.hidden = true;
  emptyState.hidden = false;
  hasOpenDocument = false;
  folderPanel.setActivePath(null);
  void emptyRecentBar.refresh();
  refreshStatusbarVisibility();
}

function captureActiveWorking(): void {
  const active = tabs.active;
  if (active && editor && !loading && !isReaderMode()) {
    tabs.setWorking(active.id, editor.getMarkdown());
  }
}

async function fetchModified(path: string): Promise<number | null> {
  try {
    const meta = await fileMeta(path);
    return meta.modified_ms;
  } catch {
    return null;
  }
}

const tabs = new TabsManager(
  tabbar,
  (tab) => {
    void showTab(tab);
    void refreshWatched();
  },
  () => {
    showEmpty();
    void refreshWatched();
  },
  (tab, newName) => {
    void renameTab(tab, newName);
  }
);

async function openFile(path: string): Promise<void> {
  const existing = tabs.findByPath(path);
  if (existing) {
    tabs.activate(existing.id);
    return;
  }
  captureActiveWorking();
  try {
    const content = await readFile(path);
    tabs.open(path, content);
    addRecentFile(path);
    navbar.refresh();
    void emptyRecentBar.refresh();
  } catch (e) {
    console.error(e);
    removeRecentFile(path);
    navbar.refresh();
    void emptyRecentBar.refresh();
    alert(`Could not open file:\n${e}\n\nIt may have been moved or deleted.`);
  }
}

function newFile(): void {
  captureActiveWorking();
  if (isReaderMode()) {
    savePreferences({ readerMode: false });
  }
  tabs.open(null, "");
}

async function pickFile(): Promise<void> {
  const file = await openDialog({ multiple: false, filters: MD_FILTER });
  if (typeof file === "string") await openFile(file);
}

async function pickFolder(): Promise<void> {
  const dir = await openDialog({ directory: true, multiple: false });
  if (typeof dir !== "string") return;
  await folderPanel.openFolder(dir);
  navbar.refresh();
}

function defaultSaveDirectory(tab: Tab): string | null {
  if (tab.path) return dirname(tab.path);
  return loadPreferences().openFolder;
}

async function renameTab(tab: Tab, rawName: string): Promise<void> {
  if (isReaderMode()) return;
  captureActiveWorking();

  const name = sanitizeFilename(rawName);
  if (!name) return;

  if (!tab.path) {
    tabs.setName(tab.id, name, true);
    return;
  }

  const dir = dirname(tab.path);
  const newPath = buildSavePath(name, dir);
  if (newPath === tab.path) {
    tabs.setName(tab.id, nameFromPath(newPath), false);
    return;
  }

  try {
    await renameFile(tab.path, newPath);
    tabs.updatePath(tab.id, newPath);
    addRecentFile(newPath);
    navbar.refresh();
    if (tabs.active?.id === tab.id) {
      baseDir = dirname(newPath);
    }
    await refreshWatched();
    void folderPanel.refresh();
  } catch (e) {
    console.error(e);
    alert(`Could not rename file:\n${e}`);
    tabs.render();
  }
}

async function saveActive(): Promise<void> {
  if (isReaderMode()) return;
  const active = tabs.active;
  if (!active || !editor) return;
  const content = editor.getMarkdown();

  let path = active.path;
  if (!path) {
    const chosen = await saveDialog({
      defaultPath: buildSavePath(active.name, defaultSaveDirectory(active)),
      filters: MD_FILTER,
    });
    if (!chosen) return;
    path = ensureMdExtension(chosen);
  }

  try {
    await writeFile(path, content);
    tabs.markSaved(active.id, path, content);
    addRecentFile(path);
    navbar.refresh();
    activeModified = await fetchModified(path);
    updateMetrics(content, activeModified);
    baseDir = dirname(path);
    await refreshWatched();
    void folderPanel.refresh();
  } catch (e) {
    console.error(e);
    alert(`Failed to save:\n${e}`);
  }
}

function closeActiveTab(): void {
  const active = tabs.active;
  if (active) tabs.close(active.id);
}

async function refreshWatched(): Promise<void> {
  try {
    await setWatchedPaths(tabs.paths());
  } catch (e) {
    console.error(e);
  }
}

function resolveImageSrc(src: string): string {
  if (/^(https?:|data:|blob:|asset:)/i.test(src) || src.includes("asset.localhost")) {
    return src;
  }
  let p = src.replace(/^file:\/\//i, "");
  const isAbsolute =
    /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/") || p.startsWith("\\\\");
  if (!isAbsolute) {
    if (!baseDir) return src;
    p = `${baseDir}/${p.replace(/^\.\//, "")}`;
  }
  try {
    return convertFileSrc(decodeURI(p));
  } catch {
    return src;
  }
}

function processImages(): void {
  editorHost.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || src === img.dataset.ezResolved) return;
    const resolved = resolveImageSrc(src);
    if (resolved !== src) {
      img.dataset.ezResolved = resolved;
      img.src = resolved;
    }
  });
}

const imageObserver = new MutationObserver(() => processImages());
imageObserver.observe(editorHost, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src"],
});

async function exportPdf(): Promise<void> {
  const active = tabs.active;
  if (!active || !editor) return;
  captureActiveWorking();

  const prose = editorHost.querySelector(".milkdown .ProseMirror");
  if (!prose) return;

  const baseName = active.path
    ? stripMdExtension(basename(active.path))
    : active.name;
  const chosen = await saveDialog({
    defaultPath: `${baseName}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!chosen) return;

  try {
    await exportEditorToPdf(prose as HTMLElement, chosen, baseName);
  } catch (e) {
    console.error(e);
    alert(`Failed to export PDF:\n${e}`);
  }
}

const navbar = initNavbar(
  {
    onNewFile: () => newFile(),
    onOpenFile: () => void pickFile(),
    onOpenFolder: () => void pickFolder(),
    onToggleFolderPanel: () => {
      folderPanel.toggle();
      navbar.refresh();
    },
    onSave: () => void saveActive(),
    onExportPdf: () => void exportPdf(),
    onCloseTab: () => closeActiveTab(),
    onOpenRecent: (path) => void openFile(path),
  },
  menuFileBtn,
  menuSettingsBtn,
  menuHelpBtn
);

initWindowControls(windowControls);

emptyNewFile.addEventListener("click", () => newFile());
emptyOpenFile.addEventListener("click", () => void pickFile());
emptyOpenFolder.addEventListener("click", () => void pickFolder());

window.addEventListener(
  "keydown",
  (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === "s") {
      e.preventDefault();
      void saveActive();
    } else if (key === "o") {
      e.preventDefault();
      void pickFile();
    } else if (key === "n") {
      e.preventDefault();
      newFile();
    }
  },
  true
);

void listen<{ path: string }>("file-changed", async (event) => {
  const tab = tabs.findByPath(event.payload.path);
  if (!tab || tab.dirty) return;
  try {
    const content = await readFile(event.payload.path);
    if (content === tab.savedContent) return;
    if (tabs.active?.id === tab.id) {
      tab.savedContent = content;
      tab.workingContent = content;
      await showTab(tab);
    } else {
      tabs.reloadFromDisk(tab.id, content);
    }
  } catch (e) {
    console.error(e);
  }
});

void listen<string[]>("open-files", (event) => {
  for (const path of event.payload) void openFile(path);
});

async function start(): Promise<void> {
  const prefs = loadPreferences();
  applyPreferences(prefs);
  initUpdateChecker();

  onPreferencesChange((next) => {
    applyPreferences(next);
    refreshStatusbarVisibility();
    if (tabs.active) void showTab(tabs.active);
  });

  initContextMenu({
    onNewFile: () => newFile(),
    onOpenFile: () => void pickFile(),
    onOpenFolder: () => void pickFolder(),
    onSave: () => void saveActive(),
    onExportPdf: () => void exportPdf(),
    onOpenFilePath: (path) => void openFile(path),
    onActivateTab: (tabId) => tabs.activate(tabId),
    onCloseTab: (tabId) => tabs.close(tabId),
    onCloseOtherTabs: (tabId) => tabs.closeOthers(tabId),
    getTabId: (el) => {
      const tab = el.closest(".tab") as HTMLElement | null;
      const id = tab?.dataset.tabId;
      return id ? Number(id) : null;
    },
    getFilePath: () => null,
  });

  showEmpty();
  repairRecentFiles();
  void emptyRecentBar.refresh();

  try {
    const { takePendingOpen } = await import("./api");
    const pending = await takePendingOpen();
    for (const path of pending) {
      await openFile(path);
      if (pending.length === 1) {
        savePreferences({ openFolder: dirname(path) });
      }
    }
  } catch (e) {
    console.error(e);
  }
}

void start();
