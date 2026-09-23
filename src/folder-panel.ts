import { basename, dirname, listDir, type DirEntry } from "./api";
import { icons } from "./icons";
import { loadPreferences, savePreferences } from "./preferences";

export interface FolderPanelHandlers {
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
}

export interface FolderPanelHandle {
  openFolder: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
  setActivePath: (path: string | null) => void;
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
  const rel = c.startsWith(`${r}/`) ? c.slice(r.length + 1) : "";
  let acc = r;
  for (const part of rel.split("/").filter(Boolean)) {
    acc = `${acc}/${part}`;
    trail.push({ name: part, path: acc });
  }
  return trail;
};

/** Folder browser for the sidebar's Files pane (one level at a time). */
export function initFolderPanel(
  pane: HTMLElement,
  handlers: FolderPanelHandlers
): FolderPanelHandle {
  let rootPath: string | null = null;
  let currentPath: string | null = null;
  let activePath: string | null = null;
  let renderSeq = 0;

  pane.innerHTML = `
    <header class="folder-panel-header">
      <div class="folder-panel-nav">
        <button type="button" class="icon-btn folder-panel-back" title="Back" aria-label="Back" disabled>${icons.chevronLeft}</button>
        <nav class="folder-panel-breadcrumb" aria-label="Folder path"></nav>
      </div>
      <button type="button" class="icon-btn folder-panel-refresh" title="Refresh" aria-label="Refresh">${icons.refresh}</button>
    </header>
    <div class="file-tree folder-panel-tree"></div>
    <div class="sidebar-empty folder-panel-none">
      <p>No folder open</p>
      <button type="button" class="btn folder-panel-open">Open folder…</button>
    </div>`;

  const header = pane.querySelector(".folder-panel-header") as HTMLElement;
  const breadcrumbEl = pane.querySelector(".folder-panel-breadcrumb") as HTMLElement;
  const treeEl = pane.querySelector(".folder-panel-tree") as HTMLElement;
  const noneEl = pane.querySelector(".folder-panel-none") as HTMLElement;
  const backBtn = pane.querySelector(".folder-panel-back") as HTMLButtonElement;

  const message = (text: string): void => {
    const p = document.createElement("p");
    p.className = "sidebar-empty";
    p.textContent = text;
    treeEl.appendChild(p);
  };

  const row = (className: string, icon: string, name: string, extra = ""): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tree-row ${className}`;
    btn.innerHTML = `<span class="tree-icon">${icon}</span><span class="tree-name"></span>${extra}`;
    (btn.querySelector(".tree-name") as HTMLElement).textContent = name;
    btn.title = name;
    return btn;
  };

  const updateHeader = (): void => {
    const open = !!(rootPath && currentPath);
    header.hidden = !open;
    treeEl.hidden = !open;
    noneEl.hidden = open;
    breadcrumbEl.innerHTML = "";
    if (!rootPath || !currentPath) return;

    backBtn.disabled = pathsEqual(currentPath, rootPath);
    const trail = breadcrumbTrail(rootPath, currentPath);
    trail.forEach((crumb, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "folder-panel-crumb-sep";
        sep.textContent = "/";
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

  const renderBrowse = async (): Promise<void> => {
    if (!currentPath) return;
    const seq = ++renderSeq;
    let entries: DirEntry[];
    try {
      entries = await listDir(currentPath);
    } catch {
      if (seq !== renderSeq) return;
      treeEl.innerHTML = "";
      message("Could not read folder.");
      return;
    }
    if (seq !== renderSeq) return;
    treeEl.innerHTML = "";

    const byName = (a: DirEntry, b: DirEntry): number => a.name.localeCompare(b.name);
    const dirs = entries.filter((e) => e.is_dir).sort(byName);
    const files = entries.filter((e) => e.is_markdown).sort(byName);
    if (!dirs.length && !files.length) message("No Markdown files here");

    for (const entry of dirs) {
      const btn = row("tree-dir", icons.folder, entry.name, `<span class="tree-enter">${icons.chevronRight}</span>`);
      btn.addEventListener("click", () => void navigateTo(entry.path));
      treeEl.appendChild(btn);
    }
    for (const entry of files) {
      const btn = row("tree-file", icons.file, entry.name);
      btn.dataset.path = entry.path;
      btn.classList.toggle("active", entry.path === activePath);
      btn.addEventListener("click", () => handlers.onOpenFile(entry.path));
      treeEl.appendChild(btn);
    }
  };

  const navigateTo = async (path: string): Promise<void> => {
    if (!rootPath || !isInsideRoot(path, rootPath)) return;
    currentPath = normalizePath(path);
    updateHeader();
    await renderBrowse();
  };

  backBtn.addEventListener("click", () => {
    if (rootPath && currentPath && !pathsEqual(currentPath, rootPath)) {
      void navigateTo(dirname(currentPath));
    }
  });
  pane.querySelector(".folder-panel-refresh")!.addEventListener("click", () => void renderBrowse());
  pane.querySelector(".folder-panel-open")!.addEventListener("click", handlers.onOpenFolder);

  const openFolder = async (path: string): Promise<void> => {
    rootPath = normalizePath(path);
    savePreferences({ openFolder: rootPath });
    await navigateTo(rootPath);
  };

  const setActivePath = (path: string | null): void => {
    activePath = path;
    treeEl.querySelectorAll<HTMLElement>(".tree-file").forEach((el) => {
      el.classList.toggle("active", el.dataset.path === path);
    });
    // Follow the open document into its folder when it lives under the root.
    if (!path || !rootPath) return;
    const parent = normalizePath(dirname(path));
    if (isInsideRoot(parent, rootPath) && !pathsEqual(parent, currentPath ?? "")) {
      void navigateTo(parent);
    }
  };

  const saved = loadPreferences().openFolder;
  if (saved) {
    rootPath = normalizePath(saved);
    void navigateTo(rootPath);
  } else {
    updateHeader();
  }

  return { openFolder, refresh: renderBrowse, setActivePath };
}
