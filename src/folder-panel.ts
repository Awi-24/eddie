import { basename, dirname, listDir, type DirEntry } from "./api";
import { attachFloatingPanelChrome } from "./floating-panel-chrome";
import { inferDockFromPosition, panelWidthForHost } from "./floating-panel-magnet";
import { icons } from "./icons";
import { loadPreferences, savePreferences } from "./preferences";

export interface FolderPanelHandlers {
  onOpenFile: (path: string) => void;
}

export interface FolderPanelHandle {
  openFolder: (path: string) => Promise<void>;
  toggle: () => void;
  refresh: () => Promise<void>;
  setActivePath: (path: string | null) => void;
  isVisible: () => boolean;
}

interface Crumb {
  name: string;
  path: string;
}

const normalizePath = (path: string): string =>
  path.replace(/\\/g, "/").replace(/\/+$/, "");

const pathsEqual = (a: string, b: string): boolean =>
  normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase();

const isInsideRoot = (path: string, root: string): boolean => {
  const p = normalizePath(path);
  const r = normalizePath(root);
  return p === r || p.startsWith(`${r}/`);
};

const breadcrumbTrail = (root: string, current: string): Crumb[] => {
  const r = normalizePath(root);
  const c = normalizePath(current);
  const trail: Crumb[] = [{ name: basename(r), path: r }];
  if (c === r) return trail;

  const rel = c.startsWith(`${r}/`) ? c.slice(r.length + 1) : "";
  if (!rel) return trail;

  let acc = r;
  for (const part of rel.split("/").filter(Boolean)) {
    acc = `${acc}/${part}`;
    trail.push({ name: part, path: acc });
  }
  return trail;
};

/** Floating folder browser — overlays the editor without changing layout. */
export function initFolderPanel(
  host: HTMLElement,
  handlers: FolderPanelHandlers
): FolderPanelHandle {
  let rootPath: string | null = null;
  let currentPath: string | null = null;
  let activePath: string | null = null;
  let renderSeq = 0;

  const panel = document.createElement("aside");
  panel.className = "folder-panel floating-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Folder browser");
  panel.innerHTML = `
    <header class="folder-panel-header folder-panel-header--draggable">
      <div class="folder-panel-nav">
        <button type="button" class="icon-btn folder-panel-back" title="Back" aria-label="Back" disabled>${icons.chevronLeft}</button>
        <nav class="folder-panel-breadcrumb" aria-label="Folder path"></nav>
      </div>
      <div class="folder-panel-actions">
        <button type="button" class="icon-btn folder-panel-minimize" title="Minimize" aria-label="Minimize">${icons.minimize}</button>
        <button type="button" class="icon-btn folder-panel-refresh" title="Refresh" aria-label="Refresh">${icons.refresh}</button>
        <button type="button" class="icon-btn folder-panel-close" title="Close panel" aria-label="Close panel">${icons.close}</button>
      </div>
    </header>
    <div class="file-tree folder-panel-tree"></div>
    <button type="button" class="floating-panel-bubble" aria-label="Expand folder panel">${icons.folderOpen}</button>`;

  host.appendChild(panel);

  const breadcrumbEl = panel.querySelector(
    ".folder-panel-breadcrumb"
  ) as HTMLElement;
  const treeEl = panel.querySelector(".folder-panel-tree") as HTMLElement;
  const headerEl = panel.querySelector(".folder-panel-header") as HTMLElement;
  const backBtn = panel.querySelector(".folder-panel-back") as HTMLButtonElement;
  const minimizeBtn = panel.querySelector(".folder-panel-minimize") as HTMLButtonElement;
  const bubbleBtn = panel.querySelector(".floating-panel-bubble") as HTMLButtonElement;

  const prefs = loadPreferences();
  const hostWidth = host.getBoundingClientRect().width || window.innerWidth;
  const initialDock = prefs.folderPanelMinimized
    ? "free"
    : prefs.folderPanelPos && prefs.folderPanelDock === "left"
      ? inferDockFromPosition(
          prefs.folderPanelPos,
          hostWidth,
          panelWidthForHost(hostWidth)
        )
      : prefs.folderPanelDock;

  const chrome = attachFloatingPanelChrome({
    panel,
    dragHandle: headerEl,
    minimizeBtn,
    bubbleBtn,
    host,
    initialMinimized: prefs.folderPanelMinimized,
    initialDock,
    initialPosition: prefs.folderPanelPos,
    onMinimizedChange: (minimized) => {
      savePreferences({ folderPanelMinimized: minimized });
      if (!minimized && currentPath && !panel.hidden) void renderBrowse();
    },
    onDockChange: (dock) => {
      savePreferences({ folderPanelDock: dock });
    },
    onPositionChange: (pos) => {
      savePreferences({ folderPanelPos: pos });
    },
  });

  const setVisible = (visible: boolean): void => {
    panel.hidden = !visible;
    savePreferences({ folderPanelVisible: visible });
    if (!visible) {
      chrome.setMinimized(false);
    }
  };

  const updateHeader = (): void => {
    if (!rootPath || !currentPath) {
      backBtn.disabled = true;
      breadcrumbEl.innerHTML = "";
      return;
    }

    backBtn.disabled = pathsEqual(currentPath, rootPath);
    breadcrumbEl.innerHTML = "";
    const trail = breadcrumbTrail(rootPath, currentPath);
    trail.forEach((crumb, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "folder-panel-crumb-sep";
        sep.textContent = "/";
        sep.setAttribute("aria-hidden", "true");
        breadcrumbEl.appendChild(sep);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "folder-panel-crumb";
      btn.textContent = crumb.name;
      btn.title = crumb.path;
      btn.disabled = index === trail.length - 1;
      btn.addEventListener("click", () => void navigateTo(crumb.path));
      breadcrumbEl.appendChild(btn);
    });
  };

  const navigateTo = async (path: string): Promise<void> => {
    if (!rootPath || !isInsideRoot(path, rootPath)) return;
    currentPath = normalizePath(path);
    updateHeader();
    await renderBrowse();
  };

  const navigateUp = (): void => {
    if (!rootPath || !currentPath || pathsEqual(currentPath, rootPath)) return;
    void navigateTo(dirname(currentPath));
  };

  const renderBrowse = async (): Promise<void> => {
    if (!currentPath) return;
    const seq = ++renderSeq;
    treeEl.innerHTML = "";

    let entries: DirEntry[];
    try {
      entries = await listDir(currentPath);
    } catch {
      if (seq !== renderSeq) return;
      const err = document.createElement("p");
      err.className = "folder-panel-error";
      err.textContent = "Could not read folder.";
      treeEl.appendChild(err);
      return;
    }

    if (seq !== renderSeq) return;

    const dirs = entries
      .filter((e) => e.is_dir)
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries
      .filter((e) => e.is_markdown)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!dirs.length && !files.length) {
      const empty = document.createElement("p");
      empty.className = "folder-panel-empty";
      empty.textContent = "Empty folder";
      treeEl.appendChild(empty);
    }

    for (const entry of dirs) {
      treeEl.appendChild(buildDirRow(entry));
    }
    for (const entry of files) {
      treeEl.appendChild(buildFileRow(entry));
    }
  };

  const buildFileRow = (entry: DirEntry): HTMLElement => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "tree-row tree-file";
    row.dataset.path = entry.path;
    if (entry.path === activePath) row.classList.add("active");
    row.innerHTML = `
      <span class="tree-twisty" aria-hidden="true"></span>
      <span class="tree-icon">${icons.file}</span>
      <span class="tree-name">${entry.name}</span>`;
    row.addEventListener("click", () => handlers.onOpenFile(entry.path));
    return row;
  };

  const buildDirRow = (entry: DirEntry): HTMLElement => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "tree-row tree-dir tree-dir--browse";
    row.dataset.path = entry.path;
    row.innerHTML = `
      <span class="tree-twisty" aria-hidden="true"></span>
      <span class="tree-icon">${icons.folder}</span>
      <span class="tree-name">${entry.name}</span>
      <span class="tree-enter">${icons.chevronRight}</span>`;
    row.addEventListener("click", () => void navigateTo(entry.path));
    return row;
  };

  backBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateUp();
  });

  panel.querySelector(".folder-panel-close")?.addEventListener("click", () => {
    setVisible(false);
  });

  panel.querySelector(".folder-panel-refresh")?.addEventListener("click", () => {
    void refresh();
  });

  const refresh = async (): Promise<void> => {
    await renderBrowse();
  };

  const openFolder = async (path: string): Promise<void> => {
    rootPath = normalizePath(path);
    currentPath = rootPath;
    updateHeader();
    savePreferences({
      openFolder: rootPath,
      folderPanelVisible: true,
      folderPanelMinimized: false,
      folderPanelDock: loadPreferences().folderPanelDock,
    });
    panel.hidden = false;
    chrome.setMinimized(false);
  };

  const toggle = (): void => {
    if (!rootPath) return;
    if (panel.hidden) {
      panel.hidden = false;
      savePreferences({ folderPanelVisible: true });
      chrome.setMinimized(false);
      return;
    }
    if (chrome.isMinimized()) {
      chrome.setMinimized(false);
      return;
    }
    setVisible(false);
  };

  const setActivePath = (path: string | null): void => {
    activePath = path;
    treeEl.querySelectorAll(".tree-file").forEach((el) => {
      el.classList.toggle(
        "active",
        (el as HTMLElement).dataset.path === path
      );
    });

    if (!path || !rootPath) return;
    const parent = normalizePath(dirname(path));
    if (!isInsideRoot(parent, rootPath)) return;
    if (!pathsEqual(parent, currentPath ?? "")) {
      void navigateTo(parent);
    }
  };

  const restore = (): void => {
    const current = loadPreferences();
    if (!current.openFolder) return;
    rootPath = normalizePath(current.openFolder);
    currentPath = rootPath;
    updateHeader();
    if (current.folderPanelVisible) {
      panel.hidden = false;
      if (!current.folderPanelMinimized) {
        void renderBrowse();
      }
    }
  };

  restore();

  return {
    openFolder,
    toggle,
    refresh,
    setActivePath,
    isVisible: () => !panel.hidden,
  };
}
