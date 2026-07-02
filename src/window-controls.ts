import { isTauri } from "@tauri-apps/api/core";
import { icons } from "./icons";

/** Wire custom window controls for frameless Tauri window. */
export function initWindowControls(container: HTMLElement): void {
  const minimizeBtn = container.querySelector<HTMLButtonElement>(".win-btn.minimize");
  const maximizeBtn = container.querySelector<HTMLButtonElement>(".win-btn.maximize");
  const closeBtn = container.querySelector<HTMLButtonElement>(".win-btn.close");

  if (!minimizeBtn || !maximizeBtn || !closeBtn) return;

  if (!isTauri()) {
    container.hidden = true;
    return;
  }

  void (async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();

    const syncMaximizeIcon = async (): Promise<void> => {
      const maximized = await win.isMaximized();
      maximizeBtn.innerHTML = maximized ? icons.restore : icons.maximize;
      maximizeBtn.title = maximized ? "Restore" : "Maximize";
      maximizeBtn.setAttribute("aria-label", maximizeBtn.title);
    };

    await syncMaximizeIcon();
    await win.onResized(() => void syncMaximizeIcon());

    minimizeBtn.innerHTML = icons.minimize;
    closeBtn.innerHTML = icons.close;

    minimizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void win.minimize();
    });
    maximizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void win.toggleMaximize();
    });
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void win.close();
    });
  })();
}
