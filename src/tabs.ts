import { icons } from "./icons";
import { nameFromPath, titleFromMarkdown } from "./naming";

export interface Tab {
  id: number;
  /** Absolute path on disk, or null for an unsaved scratch buffer. */
  path: string | null;
  /** Display / save base name (no extension). */
  name: string;
  /** When true, the tab name is not auto-updated from the document title. */
  nameLocked: boolean;
  /** Content as last persisted to disk (or initial empty for scratch). */
  savedContent: string;
  /** In-memory working copy reflecting unsaved edits. */
  workingContent: string;
  dirty: boolean;
}

let nextId = 1;

/**
 * Owns the set of open tabs and renders the tab bar. Pure state + DOM; the
 * editor lifecycle and file IO live in main.ts, driven through the callbacks.
 */
export class TabsManager {
  private tabs: Tab[] = [];
  private activeId: number | null = null;
  private editingId: number | null = null;
  /** Called after every render (names, dirty flags or the active tab changed). */
  onRender: () => void = () => {};

  constructor(
    private readonly bar: HTMLElement,
    private readonly onActivate: (tab: Tab) => void,
    private readonly onClose: (tab: Tab) => void,
    private readonly onRename: (tab: Tab, newName: string) => void
  ) {}

  get active(): Tab | null {
    return this.tabs.find((t) => t.id === this.activeId) ?? null;
  }

  list(): Tab[] {
    return this.tabs;
  }

  findByPath(path: string): Tab | undefined {
    return this.tabs.find((t) => t.path === path);
  }

  open(path: string | null, content: string): Tab {
    const tab: Tab = {
      id: nextId++,
      path,
      name: path ? nameFromPath(path) : titleFromMarkdown(content),
      nameLocked: false,
      savedContent: content,
      workingContent: content,
      dirty: false,
    };
    this.tabs.push(tab);
    this.activeId = tab.id;
    this.render();
    this.onActivate(tab);
    return tab;
  }

  activate(id: number): void {
    if (id === this.activeId) return;
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    this.activeId = id;
    this.render();
    this.onActivate(tab);
  }

  /** Record working content / dirty flag for a tab (called on edits). */
  setWorking(id: number, content: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.workingContent = content;
    if (!tab.path && !tab.nameLocked) {
      const inferred = titleFromMarkdown(content);
      if (inferred !== tab.name) {
        tab.name = inferred;
        this.render();
      }
    }
    const dirty = content !== tab.savedContent;
    if (dirty !== tab.dirty) {
      tab.dirty = dirty;
      this.render();
    }
  }

  setName(id: number, name: string, locked = true): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.name = name;
    tab.nameLocked = locked;
    this.render();
  }

  markSaved(id: number, path: string, content: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.path = path;
    tab.name = nameFromPath(path);
    tab.nameLocked = false;
    tab.savedContent = content;
    tab.workingContent = content;
    tab.dirty = false;
    this.render();
  }

  updatePath(id: number, path: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.path = path;
    tab.name = nameFromPath(path);
    this.render();
  }

  /** Update working+saved content from an external on-disk change. */
  reloadFromDisk(id: number, content: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.savedContent = content;
    tab.workingContent = content;
    tab.dirty = false;
    this.render();
  }

  close(id: number): void {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [tab] = this.tabs.splice(idx, 1);
    if (this.editingId === id) this.editingId = null;
    if (this.activeId === id) {
      const next = this.tabs[idx] ?? this.tabs[idx - 1] ?? null;
      this.activeId = next?.id ?? null;
      this.render();
      if (next) this.onActivate(next);
      else this.onClose(tab);
    } else {
      this.render();
    }
  }

  closeOthers(keepId: number): void {
    const keep = this.tabs.find((t) => t.id === keepId);
    if (!keep) return;
    this.tabs = this.tabs.filter((t) => t.id === keepId);
    this.activeId = keepId;
    this.editingId = null;
    this.render();
    this.onActivate(keep);
  }

  /** Show the inline rename field on a tab. */
  startRename(id: number): void {
    if (!this.tabs.some((t) => t.id === id)) return;
    this.editingId = id;
    this.render();
  }

  /** Activate the next (1) or previous (-1) tab, wrapping around. */
  cycle(dir: 1 | -1): void {
    const idx = this.tabs.findIndex((t) => t.id === this.activeId);
    if (idx === -1 || this.tabs.length < 2) return;
    this.activate(this.tabs[(idx + dir + this.tabs.length) % this.tabs.length].id);
  }

  paths(): string[] {
    return this.tabs.map((t) => t.path).filter((p): p is string => !!p);
  }

  render(): void {
    this.bar.innerHTML = "";
    for (const tab of this.tabs) {
      const el = document.createElement("div");
      el.className = "tab" + (tab.id === this.activeId ? " active" : "") + (tab.dirty ? " dirty" : "");
      el.dataset.tabId = String(tab.id);
      el.title = (tab.path ?? `${tab.name}.md`) + (tab.dirty ? " (unsaved)" : "");

      if (this.editingId === tab.id) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "tab-rename-input";
        input.value = tab.name;
        input.spellcheck = false;
        input.addEventListener("click", (e) => e.stopPropagation());
        input.addEventListener("mousedown", (e) => e.stopPropagation());
        const commit = (): void => {
          const next = input.value.trim();
          this.editingId = null;
          if (next && next !== tab.name) this.onRename(tab, next);
          else this.render();
        };
        input.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            this.editingId = null;
            this.render();
          }
        });
        input.addEventListener("blur", commit);
        el.appendChild(input);
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
      } else {
        const label = document.createElement("span");
        label.className = "tab-label";
        label.textContent = tab.name;
        label.title = "Double-click to rename";
        label.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          if (document.documentElement.dataset.readerMode === "true") return;
          this.startRename(tab.id);
        });
        el.appendChild(label);
      }

      const close = document.createElement("button");
      close.className = "tab-close";
      close.innerHTML = icons.close;
      close.title = "Close";
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        this.close(tab.id);
      });
      el.appendChild(close);

      el.addEventListener("click", () => {
        if (this.editingId !== tab.id) this.activate(tab.id);
      });
      this.bar.appendChild(el);
    }
    this.onRender();
  }
}
