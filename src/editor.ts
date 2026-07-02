import { Crepe, CrepeFeature } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import { createCodeBlockRenderPreview } from "./diagram-renderer";

export interface EditorHandle {
  getMarkdown: () => string;
  destroy: () => Promise<void>;
}

const READER_ALLOWED_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Tab",
  "Escape",
]);

/** Block text edits in reader mode while keeping task-list toggles interactive. */
function attachReaderModeGuard(host: HTMLElement): () => void {
  const blockTyping = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (READER_ALLOWED_KEYS.has(e.key)) return;
    if (
      e.key === " " &&
      e.target instanceof Element &&
      e.target.closest(".label-wrapper")
    ) {
      return;
    }
    if (
      e.key.length === 1 ||
      e.key === "Enter" ||
      e.key === "Backspace" ||
      e.key === "Delete"
    ) {
      e.preventDefault();
    }
  };

  const blockClipboard = (e: Event): void => {
    e.preventDefault();
  };

  host.addEventListener("keydown", blockTyping, true);
  host.addEventListener("paste", blockClipboard, true);
  host.addEventListener("drop", blockClipboard, true);

  return () => {
    host.removeEventListener("keydown", blockTyping, true);
    host.removeEventListener("paste", blockClipboard, true);
    host.removeEventListener("drop", blockClipboard, true);
  };
}

/**
 * Mount a Milkdown Crepe WYSIWYG editor into `host`.
 * In reader mode, code blocks show preview only and text editing is blocked,
 * but task-list checkboxes remain togglable.
 */
export async function mountEditor(
  host: HTMLElement,
  value: string,
  onChange: (markdown: string) => void,
  readerMode = false
): Promise<EditorHandle> {
  const crepe = new Crepe({
    root: host,
    defaultValue: value,
    featureConfigs: {
      placeholder: {
        text: readerMode
          ? "Reading mode — open a document to view formatted Markdown."
          : "Write here… type / to insert blocks",
      },
      [CrepeFeature.CodeMirror]: {
        previewOnlyByDefault: readerMode,
        previewLabel: "Preview",
        renderPreview: createCodeBlockRenderPreview(),
        previewToggleText: (previewOnly: boolean) =>
          previewOnly ? "Show code" : "Show preview",
      },
    },
  });

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      onChange(markdown);
    });
  });

  await crepe.create();

  const detachReaderGuard = readerMode ? attachReaderModeGuard(host) : null;

  return {
    getMarkdown: () => crepe.getMarkdown(),
    destroy: async () => {
      detachReaderGuard?.();
      await crepe.destroy();
    },
  };
}
