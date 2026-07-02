import { isTauri } from "@tauri-apps/api/core";

import { icons } from "./icons";

declare const __APP_VERSION__: string;

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string; notes: string }
  | { state: "downloading"; progress: number }
  | { state: "ready" }
  | { state: "uptodate" }
  | { state: "error"; message: string };

type Listener = (status: UpdateStatus) => void;

let status: UpdateStatus = { state: "idle" };
let pending: import("@tauri-apps/plugin-updater").Update | null = null;
const listeners = new Set<Listener>();

function emit(next: UpdateStatus): void {
  status = next;
  for (const fn of listeners) fn(status);
}

export function onUpdateStatus(fn: Listener): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

export function updateAvailable(): boolean {
  return status.state === "available" || status.state === "downloading";
}

function showUpdateResult(title: string, message: string): void {
  const existing = document.getElementById("update-result-dialog");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "update-result-dialog";
  backdrop.className = "app-dialog-backdrop";
  backdrop.innerHTML = `
    <div class="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="update-result-title">
      <header class="app-dialog-header">
        <h2 id="update-result-title" class="app-dialog-title">${title}</h2>
        <button type="button" class="app-dialog-close" aria-label="Close">${icons.close}</button>
      </header>
      <div class="app-dialog-body">
        <p class="update-result-message"></p>
      </div>
    </div>`;

  backdrop.querySelector(".update-result-message")!.textContent = message;

  const close = (): void => backdrop.remove();

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(".app-dialog-close")?.addEventListener("click", close);

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => {
    backdrop.querySelector<HTMLButtonElement>(".app-dialog-close")?.focus();
  });
}

export async function checkForUpdates(silent = false): Promise<void> {
  if (!isTauri()) return;

  emit({ state: "checking" });
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      pending = null;
      emit(silent ? { state: "idle" } : { state: "uptodate" });
      if (!silent) {
        showUpdateResult(
          "Up to date",
          `ez.down ${__APP_VERSION__} is the latest version.`
        );
      }
      return;
    }
    pending = update;
    emit({
      state: "available",
      version: update.version,
      notes: update.body ?? "",
    });
  } catch (e) {
    pending = null;
    const message = e instanceof Error ? e.message : String(e);
    emit(silent ? { state: "idle" } : { state: "error", message });
    if (!silent) {
      showUpdateResult(
        "Update check failed",
        `${message}\n\nIf you are running a dev build, in-app updates only work in release installers.`
      );
    }
  }
}

export async function installUpdate(): Promise<void> {
  if (!isTauri() || !pending) return;

  try {
    emit({ state: "downloading", progress: 0 });
    let downloaded = 0;
    let total = 0;

    await pending.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          emit({
            state: "downloading",
            progress: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0,
          });
          break;
        case "Finished":
          break;
      }
    });

    emit({ state: "ready" });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    emit({ state: "error", message });
  }
}

/** Background check on launch and every few hours. */
export function initUpdateChecker(): void {
  if (!isTauri()) return;

  window.setTimeout(() => void checkForUpdates(true), 10_000);
  window.setInterval(() => void checkForUpdates(true), 4 * 60 * 60 * 1000);
}
