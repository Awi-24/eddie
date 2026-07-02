import { basename, fileMeta } from "./api";
import { icons } from "./icons";
import {
  normalizeRecentPath,
  removeRecentFile,
  repairRecentFiles,
  RECENT_EMPTY_COUNT,
} from "./preferences";

/** Recent-file strip on the empty state (validates paths on render). */
export function initEmptyRecent(
  container: HTMLElement,
  list: HTMLElement,
  onOpen: (path: string) => void
): { refresh: () => Promise<void> } {
  const refresh = async (): Promise<void> => {
    const all = repairRecentFiles();
    list.innerHTML = "";

    const valid: string[] = [];
    const seen = new Set<string>();
    for (const path of all) {
      if (valid.length >= RECENT_EMPTY_COUNT) break;
      const key = normalizeRecentPath(path);
      if (!key || seen.has(key)) continue;
      try {
        await fileMeta(path);
        seen.add(key);
        valid.push(path);
      } catch {
        removeRecentFile(path);
      }
    }

    if (valid.length === 0) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    for (const path of valid) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "empty-recent-item";
      btn.title = path;
      btn.innerHTML = `
        <span class="empty-recent-icon">${icons.file}</span>
        <span class="empty-recent-name">${basename(path)}</span>`;
      btn.addEventListener("click", () => onOpen(path));
      list.appendChild(btn);
    }
  };

  return { refresh };
}
