import { isTauri } from "@tauri-apps/api/core";
import { icons } from "./icons";
import { showShortcutsDialog } from "./shortcuts-dialog";
import { showReleaseNotesDialog } from "./release-notes-dialog";
import {
  clearRecentFiles,
  loadPreferences,
  normalizeRecentPath,
  savePreferences,
} from "./preferences";
import { THEME_GROUPS, THEME_LABELS } from "./themes";
import {
  checkForUpdates,
  installUpdate,
  onUpdateStatus,
  type UpdateStatus,
} from "./updater";
import { basename } from "./api";
import type { SidebarTab } from "./preferences";

const GITHUB_USER = "https://github.com/Awi-24";
const GITHUB_REPO = "https://github.com/Awi-24/eddie";

export interface NavbarHandlers {
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRename: () => void;
  onExportPdf: () => void;
  onCloseTab: () => void;
  onOpenRecent: (path: string) => void;
  onFind: (withReplace: boolean) => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: () => boolean;
  onShowSidebarTab: (tab: SidebarTab) => void;
  onToggleMascot: () => void;
  isMascotVisible: () => boolean;
}

export interface NavbarButtons {
  file: HTMLButtonElement;
  view: HTMLButtonElement;
  settings: HTMLButtonElement;
  help: HTMLButtonElement;
}

export interface NavbarHandle {
  refresh: () => void;
  closeMenus: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  checked?: boolean;
  submenu?: MenuItem[];
  action?: () => void;
}

/** App menus (File / View / Settings / Help), opened from the sidebar as flyouts. */
export function initNavbar(
  handlers: NavbarHandlers,
  { file: fileBtn, view: viewBtn, settings: settingsBtn, help: helpBtn }: NavbarButtons
): NavbarHandle {
  let updateStatus: UpdateStatus = { state: "idle" };
  let openTrigger: HTMLButtonElement | null = null;

  const menuRoot = document.createElement("div");
  menuRoot.id = "nav-dropdown-root";
  menuRoot.hidden = true;
  document.body.appendChild(menuRoot);

  const closeMenus = (): void => {
    cancelSubmenuHide();
    menuRoot.hidden = true;
    menuRoot.innerHTML = "";
    if (openTrigger) {
      openTrigger.setAttribute("aria-expanded", "false");
      openTrigger = null;
    }
  };

  const renderUpdateBadge = (): void => {
    settingsBtn.classList.toggle(
      "has-update",
      updateStatus.state === "available" || updateStatus.state === "downloading"
    );
  };

  const buildFileItems = (): MenuItem[] => {
    const prefs = loadPreferences();
    const seen = new Set<string>();
    const recent: MenuItem[] = [];
    for (const path of prefs.recentFiles) {
      const key = normalizeRecentPath(path);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recent.push({
        id: `recent-${key}`,
        label: basename(path),
        action: () => handlers.onOpenRecent(path),
      });
    }

    const items: MenuItem[] = [
      { id: "new", label: "New document", shortcut: "Ctrl+N", action: handlers.onNewFile },
      { id: "open", label: "Open file…", shortcut: "Ctrl+O", action: handlers.onOpenFile },
      { id: "folder", label: "Open folder…", action: handlers.onOpenFolder },
    ];

    if (recent.length > 0) {
      items.push({ id: "sep-recent", label: "", separator: true });
      items.push(...recent);
      items.push({
        id: "clear-recent",
        label: "Clear recent",
        action: () => {
          clearRecentFiles();
          refresh();
        },
      });
    }

    items.push({ id: "sep-save", label: "", separator: true });
    if (!prefs.readerMode) {
      items.push(
        { id: "save", label: "Save", shortcut: "Ctrl+S", action: handlers.onSave },
        { id: "save-as", label: "Save as…", shortcut: "Ctrl+Shift+S", action: handlers.onSaveAs },
        { id: "rename", label: "Rename…", shortcut: "F2", action: handlers.onRename }
      );
    }
    items.push(
      { id: "pdf", label: "Export to PDF", action: handlers.onExportPdf },
      { id: "sep-close", label: "", separator: true },
      { id: "close", label: "Close tab", shortcut: "Ctrl+W", action: handlers.onCloseTab }
    );

    return items;
  };

  const buildViewItems = (): MenuItem[] => {
    const prefs = loadPreferences();
    const items: MenuItem[] = [
      {
        id: "reader",
        label: "Reader mode",
        shortcut: "Ctrl+Shift+E",
        checked: prefs.readerMode,
        action: () => savePreferences({ readerMode: !prefs.readerMode }),
      },
      { id: "sep-find", label: "", separator: true },
      { id: "find", label: "Find…", shortcut: "Ctrl+F", action: () => handlers.onFind(false) },
    ];
    if (!prefs.readerMode) {
      items.push({
        id: "replace",
        label: "Replace…",
        shortcut: "Ctrl+H",
        action: () => handlers.onFind(true),
      });
    }
    items.push(
      { id: "sep-panels", label: "", separator: true },
      {
        id: "sidebar",
        label: "Sidebar",
        shortcut: "Ctrl+\\",
        checked: !handlers.isSidebarCollapsed(),
        action: handlers.onToggleSidebar,
      },
      { id: "files", label: "Files", action: () => handlers.onShowSidebarTab("files") },
      {
        id: "outline",
        label: "Outline",
        shortcut: "Ctrl+Shift+O",
        action: () => handlers.onShowSidebarTab("outline"),
      },
      {
        id: "mascot",
        label: "Mascot",
        checked: handlers.isMascotVisible(),
        action: handlers.onToggleMascot,
      },
      { id: "sep-layout", label: "", separator: true },
      {
        id: "wide",
        label: "Wide reading column",
        checked: prefs.wideColumn,
        action: () => savePreferences({ wideColumn: !prefs.wideColumn }),
      },
      {
        id: "statusbar",
        label: "Status bar",
        checked: prefs.showStatusbar,
        action: () => savePreferences({ showStatusbar: !prefs.showStatusbar }),
      }
    );
    return items;
  };

  const buildThemeSubmenu = (): MenuItem[] => {
    const prefs = loadPreferences();
    const items: MenuItem[] = [];
    for (const group of THEME_GROUPS) {
      items.push({ id: `theme-sep-${group.label}`, label: group.label, disabled: true });
      for (const id of group.ids) {
        items.push({
          id: `theme-${id}`,
          label: THEME_LABELS[id],
          checked: prefs.theme === id,
          action: () => {
            savePreferences({ theme: id });
            refresh();
          },
        });
      }
    }
    return items;
  };

  const buildSettingsItems = (): MenuItem[] => {
    const items: MenuItem[] = [
      { id: "theme-submenu", label: "Theme", submenu: buildThemeSubmenu() },
    ];

    if (isTauri()) {
      items.push({ id: "sep-updates", label: "", separator: true });
      if (updateStatus.state === "available") {
        items.push({
          id: "install-update",
          label: `Install ${updateStatus.version}…`,
          action: () => void installUpdate(),
        });
      }
      items.push({
        id: "check-updates",
        label:
          updateStatus.state === "checking"
            ? "Checking for updates…"
            : updateStatus.state === "uptodate"
              ? "Up to date"
              : updateStatus.state === "error"
                ? "Update check failed"
                : "Check for updates",
        disabled:
          updateStatus.state === "checking" || updateStatus.state === "downloading",
        action: () => void checkForUpdates(false),
      });
    }

    return items;
  };

  const buildHelpItems = (): MenuItem[] => [
    {
      id: "shortcuts",
      label: "Keyboard shortcuts",
      action: () => showShortcutsDialog(),
    },
    {
      id: "release-notes",
      label: `Release notes (${__APP_VERSION__})`,
      action: () => showReleaseNotesDialog(),
    },
    { id: "sep-gh", label: "", separator: true },
    {
      id: "about",
      label: `About Eddie ${__APP_VERSION__}`,
      action: () => void openExternal(GITHUB_REPO),
    },
    {
      id: "repo",
      label: "GitHub repository",
      action: () => void openExternal(GITHUB_REPO),
    },
    {
      id: "author",
      label: "Author on GitHub",
      action: () => void openExternal(GITHUB_USER),
    },
  ];

  let subHideTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelSubmenuHide = (): void => {
    if (subHideTimer !== null) {
      clearTimeout(subHideTimer);
      subHideTimer = null;
    }
  };

  const hideAllSubmenus = (container: HTMLElement): void => {
    container.querySelectorAll(".nav-submenu").forEach((el) => {
      (el as HTMLElement).hidden = true;
    });
  };

  const scheduleSubmenuHide = (sub: HTMLElement): void => {
    cancelSubmenuHide();
    subHideTimer = setTimeout(() => {
      sub.hidden = true;
      subHideTimer = null;
    }, 100);
  };

  const isMovingTo = (
    target: EventTarget | null,
    ...elements: Element[]
  ): boolean => {
    if (!(target instanceof Node)) return false;
    return elements.some((el) => el.contains(target));
  };

  const renderMenuItems = (
    items: MenuItem[],
    container: HTMLElement,
    depth = 0
  ): void => {
    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "context-menu-sep";
        sep.setAttribute("role", "separator");
        sep.addEventListener("mouseenter", () => hideAllSubmenus(container));
        container.appendChild(sep);
        continue;
      }

      if (item.submenu) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "context-menu-item nav-submenu-trigger";
        row.innerHTML = `<span>${item.label}</span><span class="context-menu-shortcut">${icons.chevronRight}</span>`;
        container.appendChild(row);

        const sub = document.createElement("div");
        sub.className = "nav-submenu context-menu";
        sub.hidden = true;
        renderMenuItems(item.submenu, sub, depth + 1);
        container.appendChild(sub);

        const showSubmenu = (): void => {
          cancelSubmenuHide();
          hideAllSubmenus(container);
          sub.hidden = false;
          const rect = row.getBoundingClientRect();
          sub.style.position = "fixed";
          sub.style.left = `${rect.right + 2}px`;
          sub.style.top = `${rect.top}px`;
          const subRect = sub.getBoundingClientRect();
          if (subRect.right > window.innerWidth - 8) {
            sub.style.left = `${rect.left - subRect.width - 2}px`;
          }
          if (subRect.bottom > window.innerHeight - 8) {
            sub.style.top = `${Math.max(8, window.innerHeight - subRect.height - 8)}px`;
          }
        };

        row.addEventListener("mouseenter", showSubmenu);
        row.addEventListener("mouseleave", (e) => {
          if (isMovingTo(e.relatedTarget, row, sub)) return;
          scheduleSubmenuHide(sub);
        });
        sub.addEventListener("mouseenter", cancelSubmenuHide);
        sub.addEventListener("mouseleave", (e) => {
          if (isMovingTo(e.relatedTarget, row, sub)) return;
          scheduleSubmenuHide(sub);
        });
        continue;
      }

      // Toggles show their state (✓) on the right; their shortcut moves to the tooltip.
      const isToggle = item.checked !== undefined;
      const right = isToggle
        ? item.checked ? "✓" : ""
        : item.shortcut ?? (item.disabled && !item.action ? "" : null);
      const shortcut = right === null ? "" : `<span class="context-menu-shortcut">${right}</span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "context-menu-item";
      if (isToggle && item.shortcut) btn.title = item.shortcut;
      btn.disabled = !!item.disabled && !item.action;
      btn.innerHTML = `<span>${item.label}</span>${shortcut}`;
      btn.addEventListener("mouseenter", () => hideAllSubmenus(container));
      if (item.action) {
        btn.addEventListener("click", () => {
          closeMenus();
          item.action?.();
        });
      }
      container.appendChild(btn);
    }
  };

  const showMenu = (
    trigger: HTMLButtonElement,
    items: MenuItem[]
  ): void => {
    if (openTrigger === trigger && !menuRoot.hidden) {
      closeMenus();
      return;
    }
    closeMenus();
    openTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");

    const menu = document.createElement("div");
    menu.className = "context-menu nav-dropdown";
    menu.setAttribute("role", "menu");
    renderMenuItems(items, menu);
    menuRoot.appendChild(menu);
    menuRoot.hidden = false;

    // Flyout to the right of the sidebar item, kept inside the window.
    const rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    const menuRect = menu.getBoundingClientRect();
    // Flush against the sidebar's edge, first item level with the trigger.
    const edge = trigger.closest(".sidebar")?.getBoundingClientRect().right ?? rect.right;
    const inset = parseFloat(getComputedStyle(menu).paddingTop) || 0;
    const left = Math.min(edge + 4, window.innerWidth - menuRect.width - 8);
    const top = Math.max(8, Math.min(rect.top - inset, window.innerHeight - menuRect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  const menus = new Map<HTMLButtonElement, () => MenuItem[]>([
    [fileBtn, buildFileItems],
    [viewBtn, buildViewItems],
    [settingsBtn, buildSettingsItems],
    [helpBtn, buildHelpItems],
  ]);

  const refresh = (): void => {
    const trigger = openTrigger;
    const build = trigger && !menuRoot.hidden ? menus.get(trigger) : undefined;
    if (!trigger || !build) return;
    closeMenus(); // showMenu toggles on the same trigger; rebuild from closed.
    showMenu(trigger, build());
  };

  for (const [btn, build] of menus) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showMenu(btn, build());
    });
    // Menu-bar feel: with a menu open, hovering another trigger switches to it.
    btn.addEventListener("mouseenter", () => {
      if (openTrigger && openTrigger !== btn && !menuRoot.hidden) showMenu(btn, build());
    });
  }

  document.addEventListener("mousedown", (e) => {
    if (menuRoot.hidden) return;
    const target = e.target as Element;
    if (target.closest(".nav-menu-btn")) return;
    if (!target.closest(".context-menu")) closeMenus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenus();
  });

  onUpdateStatus((next) => {
    updateStatus = next;
    renderUpdateBadge();
    refresh();
  });

  renderUpdateBadge();

  return { refresh, closeMenus };
}

declare const __APP_VERSION__: string;

async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
