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
import { setHtmlImageResolver } from "./markdown-extras";
import { initFindBar } from "./find";
import { initOutline } from "./outline";
import { initMascot } from "./mascot";
import { initSidebar } from "./sidebar";
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
const menuViewBtn = document.getElementById("menu-view") as HTMLButtonElement;
const docTitle = document.getElementById("doc-title") as HTMLElement;
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

const sidebar = initSidebar(document.getElementById("sidebar") as HTMLElement);
const folderPanel = initFolderPanel(document.getElementById("sidebar-files") as HTMLElement, {
  onOpenFile: (path) => void openFile(path),
  onOpenFolder: () => void pickFolder(),
});

const activeView = () => editor?.view() ?? null;
const findBar = initFindBar(workspace, activeView, isReaderMode);
const outline = initOutline(document.getElementById("sidebar-outline") as HTMLElement, activeView);
const mascot = initMascot(document.getElementById("sidebar-mascot") as HTMLElement);
sidebar.onTabChange((tab) => {
  if (tab === "outline") outline.refresh();
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

    // Before mounting: embedded HTML resolves relative <img> paths on render.
    baseDir = tab.path ? dirname(tab.path) : null;
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
    editor.onDocChange(() => outline.refresh());
    outline.refresh();
    findBar.refresh();
    editorHost.classList.remove("fade-in");
    void editorHost.offsetWidth;
    editorHost.classList.add("fade-in");

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
  findBar.close();
  outline.refresh();
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
  sidebar.showTab("files");
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

async function saveActive(forceDialog = false): Promise<void> {
  if (isReaderMode()) return;
  const active = tabs.active;
  if (!active || !editor) return;
  const content = editor.getMarkdown();

  let path = active.path;
  if (!path || forceDialog) {
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
    mascot.react("saved");
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

/** Document name in the navbar + window title, with an unsaved marker. */
function updateTitle(): void {
  const tab = tabs.active;
  const name = tab ? (tab.path ? basename(tab.path) : `${tab.name}.md`) : "";
  docTitle.hidden = !tab;
  docTitle.textContent = name;
  docTitle.classList.toggle("dirty", !!tab?.dirty);
  docTitle.title = tab
    ? `${tab.path ?? "Not saved yet"}${isReaderMode() ? "" : " — double-click to rename"}`
    : "";
  document.title = tab ? `${name}${tab.dirty ? " (unsaved)" : ""} — Eddie` : "Eddie";
}

function renameActive(): void {
  const active = tabs.active;
  if (active && !isReaderMode()) tabs.startRename(active.id);
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

setHtmlImageResolver(resolveImageSrc);

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
  const baseName = active.path
    ? stripMdExtension(basename(active.path))
    : active.name;
  try {
    await exportEditorToPdf(editorHost, baseName);
  } catch (e) {
    console.error(e);
    alert(`Failed to export PDF:
${e}`);
  }
}

const navbar = initNavbar(
  {
    onNewFile: () => newFile(),
    onOpenFile: () => void pickFile(),
    onOpenFolder: () => void pickFolder(),
    onSave: () => void saveActive(),
    onSaveAs: () => void saveActive(true),
    onRename: renameActive,
    onExportPdf: () => void exportPdf(),
    onCloseTab: () => closeActiveTab(),
    onOpenRecent: (path) => void openFile(path),
    onFind: (withReplace) => findBar.open(withReplace),
    onToggleSidebar: () => sidebar.toggle(),
    isSidebarCollapsed: () => sidebar.isCollapsed(),
    onShowSidebarTab: (tab) => sidebar.showTab(tab),
    onToggleMascot: () => mascot.toggle(),
    isMascotVisible: () => mascot.isVisible(),
  },
  { file: menuFileBtn, view: menuViewBtn, settings: menuSettingsBtn, help: menuHelpBtn }
);

tabs.onRender = updateTitle;
docTitle.addEventListener("dblclick", renameActive);

initWindowControls(windowControls);

emptyNewFile.addEventListener("click", () => newFile());
emptyOpenFile.addEventListener("click", () => void pickFile());
emptyOpenFolder.addEventListener("click", () => void pickFolder());

window.addEventListener(
  "keydown",
  (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "F2" && !mod) {
      e.preventDefault();
      renameActive();
      return;
    }
    if (!mod || e.altKey) return;
    const shift = e.shiftKey;
    // Ctrl+E, B, I, Z, Y… stay with the editor (inline code, bold, italic, history).
    const actions: Record<string, (() => void) | undefined> = {
      s: () => void saveActive(shift),
      o: () => (shift ? sidebar.showTab("outline") : void pickFile()),
      "\\": shift ? undefined : () => sidebar.toggle(),
      n: shift ? undefined : newFile,
      w: shift ? undefined : closeActiveTab,
      e: shift ? () => savePreferences({ readerMode: !isReaderMode() }) : undefined,
      f: shift ? undefined : () => findBar.open(false),
      h: shift ? undefined : () => findBar.open(true),
      tab: () => tabs.cycle(shift ? -1 : 1),
    };
    const action = actions[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      action();
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

  // Only theme (Mermaid colors) and reader mode need a fresh editor; other
  // changes (recent files, panels, column width) must not reset cursor/scroll.
  let mounted = { theme: prefs.theme, readerMode: prefs.readerMode };
  onPreferencesChange((next) => {
    applyPreferences(next);
    refreshStatusbarVisibility();
    const remount = next.theme !== mounted.theme || next.readerMode !== mounted.readerMode;
    mounted = { theme: next.theme, readerMode: next.readerMode };
    if (remount && tabs.active) {
      captureActiveWorking();
      void showTab(tabs.active);
      updateTitle();
    }
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
