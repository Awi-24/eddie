export interface ContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
}

export interface ContextMenuHandlers {
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onExportPdf: () => void;
  onOpenFilePath: (path: string) => void;
  onActivateTab: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
  onCloseOtherTabs: (tabId: number) => void;
  getTabId: (target: Element) => number | null;
  getFilePath: (target: Element) => string | null;
}

const SUPPRESS_SELECTOR =
  ".context-menu, .nav-dropdown, .nav-submenu, .milkdown-slash-menu, .milkdown-toolbar, " +
  ".milkdown-link-edit, .milkdown-link-preview, .language-picker, .list-wrapper, " +
  ".navbar, .navbar-menus, .bottom-bar, .statusbar, .icon-btn, " +
  ".tab-close, .milkdown-block-handle, .nav-menu-btn, .window-controls, .win-btn";

/** Custom right-click menus — replaces the default WebView context menu. */
export function initContextMenu(handlers: ContextMenuHandlers): void {
  const menu = document.createElement("div");
  menu.id = "context-menu";
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  document.body.appendChild(menu);

  let open = false;

  const hide = (): void => {
    open = false;
    menu.hidden = true;
    menu.innerHTML = "";
  };

  const runEditorCommand = (command: "cut" | "copy" | "paste" | "selectAll"): void => {
    const prose = document.querySelector("#editor-host .ProseMirror") as HTMLElement | null;
    if (!prose) return;
    prose.focus();
    document.execCommand(command);
  };

  const hasEditorSelection = (): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return false;
    const prose = document.querySelector("#editor-host .ProseMirror");
    if (!prose) return false;
    const anchor = sel.anchorNode;
    return !!anchor && prose.contains(anchor);
  };

  const buildItems = (target: Element): ContextMenuItem[] => {
    if (target.closest(SUPPRESS_SELECTOR)) return [];

    const tabEl = target.closest(".tab");
    if (tabEl) {
      const tabId = handlers.getTabId(tabEl);
      if (tabId == null) return [];
      const tabCount = document.querySelectorAll("#tabbar .tab").length;
      return [
        { id: "close-tab", label: "Close tab", action: () => handlers.onCloseTab(tabId) },
        {
          id: "close-others",
          label: "Close other tabs",
          disabled: tabCount <= 1,
          action: () => handlers.onCloseOtherTabs(tabId),
        },
      ];
    }

    const filePath = handlers.getFilePath(target);
    if (filePath) {
      return [
        {
          id: "open-file",
          label: "Open",
          action: () => handlers.onOpenFilePath(filePath),
        },
      ];
    }

    if (target.closest("#empty-state")) {
      if (document.documentElement.dataset.readerMode === "true") {
        return [
          {
            id: "open-file",
            label: "Open file…",
            shortcut: "Ctrl+O",
            action: handlers.onOpenFile,
          },
          { id: "open-folder", label: "Open folder…", action: handlers.onOpenFolder },
        ];
      }
      return [
        {
          id: "new-file",
          label: "New document",
          shortcut: "Ctrl+N",
          action: handlers.onNewFile,
        },
        {
          id: "open-file",
          label: "Open file…",
          shortcut: "Ctrl+O",
          action: handlers.onOpenFile,
        },
        { id: "sep-1", label: "", separator: true },
        { id: "open-folder", label: "Open folder…", action: handlers.onOpenFolder },
      ];
    }

    if (target.closest("#editor-host .milkdown")) {
      const hasDoc = !!document.querySelector("#editor-host .ProseMirror");
      if (!hasDoc) return [];

      const reader =
        document.documentElement.dataset.readerMode === "true";

      const items: ContextMenuItem[] = reader
        ? [
            {
              id: "copy",
              label: "Copy",
              shortcut: "Ctrl+C",
              disabled: !hasEditorSelection(),
              action: () => runEditorCommand("copy"),
            },
            {
              id: "select-all",
              label: "Select all",
              shortcut: "Ctrl+A",
              action: () => runEditorCommand("selectAll"),
            },
            { id: "sep-doc", label: "", separator: true },
            {
              id: "export-pdf",
              label: "Export to PDF",
              action: handlers.onExportPdf,
            },
          ]
        : [
            {
              id: "cut",
              label: "Cut",
              shortcut: "Ctrl+X",
              disabled: !hasEditorSelection(),
              action: () => runEditorCommand("cut"),
            },
            {
              id: "copy",
              label: "Copy",
              shortcut: "Ctrl+C",
              disabled: !hasEditorSelection(),
              action: () => runEditorCommand("copy"),
            },
            {
              id: "paste",
              label: "Paste",
              shortcut: "Ctrl+V",
              action: () => runEditorCommand("paste"),
            },
            {
              id: "select-all",
              label: "Select all",
              shortcut: "Ctrl+A",
              action: () => runEditorCommand("selectAll"),
            },
            { id: "sep-doc", label: "", separator: true },
            {
              id: "save",
              label: "Save",
              shortcut: "Ctrl+S",
              action: handlers.onSave,
            },
            {
              id: "export-pdf",
              label: "Export to PDF",
              action: handlers.onExportPdf,
            },
          ];

      return items;
    }

    return [];
  };

  const show = (x: number, y: number, items: ContextMenuItem[]): void => {
    menu.innerHTML = items
      .map((item) => {
        if (item.separator) {
          return `<div class="context-menu-sep" role="separator"></div>`;
        }
        const shortcut = item.shortcut
          ? `<span class="context-menu-shortcut">${item.shortcut}</span>`
          : "";
        return `<button type="button" class="context-menu-item" data-id="${item.id}" role="menuitem"${
          item.disabled ? " disabled" : ""
        }><span>${item.label}</span>${shortcut}</button>`;
      })
      .join("");

    items.forEach((item) => {
      if (item.separator || item.disabled || !item.action) return;
      const btn = menu.querySelector<HTMLButtonElement>(`[data-id="${item.id}"]`);
      btn?.addEventListener("click", () => {
        hide();
        item.action?.();
      });
    });

    menu.hidden = false;
    open = true;

    const pad = 8;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const rect = menu.getBoundingClientRect();
    let left = x;
    let top = y;
    if (rect.right > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (rect.bottom > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
      hide();

      const target = e.target;
      if (!(target instanceof Element)) return;

      const tabEl = target.closest(".tab");
      if (tabEl) {
        const tabId = handlers.getTabId(tabEl);
        if (tabId != null) handlers.onActivateTab(tabId);
      }

      const items = buildItems(target);
      if (items.length === 0) return;
      show(e.clientX, e.clientY, items);
    },
    true
  );

  document.addEventListener("mousedown", (e) => {
    if (open && !(e.target as Element).closest("#context-menu")) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
  document.addEventListener("scroll", hide, true);
  window.addEventListener("blur", hide);
}
