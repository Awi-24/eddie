import { icons } from "./icons";
import { loadPreferences, savePreferences, type SidebarTab } from "./preferences";

export interface SidebarHandle {
  toggle: () => void;
  isCollapsed: () => boolean;
  /** Switch to a pane, expanding the sidebar if it is collapsed. */
  showTab: (tab: SidebarTab) => void;
  activeTab: () => SidebarTab;
  /** Subscribe to pane switches (to refresh the pane that just became visible). */
  onTabChange: (fn: (tab: SidebarTab) => void) => void;
}

/**
 * Left sidebar: app menus, a Files / Outline switcher, and the mascot at the
 * bottom. Collapses to an icon rail; the state and the open pane persist.
 */
export function initSidebar(sidebar: HTMLElement): SidebarHandle {
  const root = document.documentElement;
  const toggleBtn = sidebar.querySelector("#sidebar-toggle") as HTMLButtonElement;
  const tabs = [...sidebar.querySelectorAll<HTMLButtonElement>(".sidebar-tab")];
  const panes: Record<SidebarTab, HTMLElement> = {
    files: sidebar.querySelector("#sidebar-files") as HTMLElement,
    outline: sidebar.querySelector("#sidebar-outline") as HTMLElement,
  };
  const listeners: ((tab: SidebarTab) => void)[] = [];

  // Icons come from icons.ts so they share the flat line style.
  sidebar.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => {
    const icon = icons[el.dataset.icon as keyof typeof icons];
    if (icon) el.insertAdjacentHTML("afterbegin", icon);
  });
  toggleBtn.innerHTML = icons.sidebar;

  const prefs = loadPreferences();
  let collapsed = prefs.sidebarCollapsed;
  let tab: SidebarTab = prefs.sidebarTab;

  const render = (): void => {
    root.dataset.sidebarCollapsed = String(collapsed);
    toggleBtn.title = collapsed ? "Expand sidebar (Ctrl+\\)" : "Collapse sidebar (Ctrl+\\)";
    toggleBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    for (const btn of tabs) {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    }
    for (const [name, pane] of Object.entries(panes)) pane.hidden = name !== tab;
  };

  const setCollapsed = (value: boolean): void => {
    collapsed = value;
    savePreferences({ sidebarCollapsed: value });
    render();
  };

  const showTab = (next: SidebarTab): void => {
    tab = next;
    savePreferences({ sidebarTab: next });
    if (collapsed) setCollapsed(false);
    else render();
    listeners.forEach((fn) => fn(next));
  };

  toggleBtn.addEventListener("click", () => setCollapsed(!collapsed));
  for (const btn of tabs) {
    btn.addEventListener("click", () => {
      const next = btn.dataset.tab as SidebarTab;
      // Clicking the open tab of an expanded sidebar collapses it, like VS Code.
      if (!collapsed && next === tab) setCollapsed(true);
      else showTab(next);
    });
  }

  render();

  return {
    toggle: () => setCollapsed(!collapsed),
    isCollapsed: () => collapsed,
    showTab,
    activeTab: () => tab,
    onTabChange: (fn) => listeners.push(fn),
  };
}
