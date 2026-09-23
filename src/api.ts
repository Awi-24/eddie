import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_markdown: boolean;
}

export const readFile = (path: string): Promise<string> =>
  invoke("read_file", { path });

export const writeFile = (path: string, content: string): Promise<void> =>
  invoke("write_file", { path, content });

export const renameFile = (from: string, to: string): Promise<void> =>
  invoke("rename_file", { from, to });

export const listDir = (path: string): Promise<DirEntry[]> =>
  invoke("list_dir", { path });

export interface FileMeta {
  size: number;
  modified_ms: number | null;
}

export const fileMeta = (path: string): Promise<FileMeta> =>
  invoke("file_meta", { path });

export const takePendingOpen = (): Promise<string[]> =>
  invoke("take_pending_open");

export const setWatchedPaths = (paths: string[]): Promise<void> =>
  invoke("set_watched_paths", { paths });

/** Basename of a path, handling both `/` and `\` separators. */
export const basename = (path: string): string =>
  path.split(/[\\/]/).pop() || path;

/** Parent directory of a path. */
export const dirname = (path: string): string => {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join("/");
};
