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

const GITHUB_USER = "https://github.com/Awi-24";
const GITHUB_REPO = "https://github.com/Awi-24/ez.down";

export interface NavbarHandlers {
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onToggleFolderPanel: () => void;
  onSave: () => void;
  onExportPdf: () => void;
  onCloseTab: () => void;
  onOpenRecent: (path: string) => void;
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

/** Top navbar with File / Settings / Help dropdown menus. */
export function initNavbar(
  handlers: NavbarHandlers,
  fileBtn: HTMLButtonElement,
  settingsBtn: HTMLButtonElement,
  helpBtn: HTMLButtonElement
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

    items.push(
      { id: "sep-save", label: "", separator: true },
      { id: "save", label: "Save", shortcut: "Ctrl+S", action: handlers.onSave },
      { id: "pdf", label: "Export to PDF", action: handlers.onExportPdf },
      { id: "close", label: "Close tab", action: handlers.onCloseTab }
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
    const prefs = loadPreferences();
    const items: MenuItem[] = [
      {
        id: "wide",
        label: "Wide reading column",
        checked: prefs.wideColumn,
        action: () => savePreferences({ wideColumn: !prefs.wideColumn }),
      },
      {
        id: "statusbar",
        label: "Show status bar",
        checked: prefs.showStatusbar,
        action: () => savePreferences({ showStatusbar: !prefs.showStatusbar }),
      },
      {
        id: "reader",
        label: "Reader mode",
        checked: prefs.readerMode,
        action: () => savePreferences({ readerMode: !prefs.readerMode }),
      },
    ];

    if (prefs.openFolder) {
      items.push({
        id: "folder-panel",
        label: "Folder panel",
        checked: prefs.folderPanelVisible,
        action: handlers.onToggleFolderPanel,
      });
    }

    items.push(
      { id: "sep-theme", label: "", separator: true },
      {
        id: "theme-submenu",
        label: "Theme",
        submenu: buildThemeSubmenu(),
      }
    );

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

    items.push(
      { id: "sep-about", label: "", separator: true },
      {
        id: "about",
        label: `About ez.down ${__APP_VERSION__}`,
        action: () => void openExternal(GITHUB_REPO),
      }
    );

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

      const shortcut = item.shortcut
        ? `<span class="context-menu-shortcut">${item.shortcut}</span>`
        : item.checked
          ? `<span class="context-menu-shortcut">✓</span>`
          : item.disabled && !item.action
            ? `<span class="context-menu-shortcut"></span>`
            : "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "context-menu-item";
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

    const rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;

    const menuRect = menu.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;
    if (menuRect.right > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuRect.width - 8);
    }
    if (menuRect.bottom > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuRect.height - 4);
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  const refresh = (): void => {
    if (openTrigger === fileBtn && !menuRoot.hidden) {
      showMenu(fileBtn, buildFileItems());
    } else if (openTrigger === settingsBtn && !menuRoot.hidden) {
      showMenu(settingsBtn, buildSettingsItems());
    }
  };

  fileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showMenu(fileBtn, buildFileItems());
  });
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showMenu(settingsBtn, buildSettingsItems());
  });
  helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showMenu(helpBtn, buildHelpItems());
  });

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
