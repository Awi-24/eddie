import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/kit/prose/view";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import { createCodeBlockRenderPreview } from "./diagram-renderer";
import { markdownExtras, splitFrontMatter } from "./markdown-extras";
import { findPlugin } from "./find";

export interface EditorHandle {
  getMarkdown: () => string;
  /** The ProseMirror view, for find and outline. */
  view: () => EditorView;
  /** Subscribe to document changes (already debounced by Milkdown's listener). */
  onDocChange: (fn: () => void) => void;
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

/** Collapsible "Properties" panel showing the document's YAML front matter. */
function frontMatterPanel(
  yaml: string,
  readOnly: boolean,
  onEdit: (yaml: string) => void
): HTMLElement {
  const panel = document.createElement("details");
  panel.className = "front-matter";
  const summary = document.createElement("summary");
  summary.textContent = "Properties";
  const area = document.createElement("textarea");
  area.value = yaml;
  area.readOnly = readOnly;
  area.spellcheck = false;
  area.rows = Math.min(12, yaml.split("\n").length + 1);
  area.addEventListener("input", () => onEdit(area.value));
  panel.append(summary, area);
  return panel;
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
  // Edit with LF (CRLF leaks `\r` into code blocks and raw HTML); save with the
  // file's original line endings.
  const eol = value.includes("\r\n") ? "\r\n" : "\n";
  const [originalFrontMatter, yaml, body] = splitFrontMatter(value.replace(/\r\n/g, "\n"));
  let frontMatter = originalFrontMatter;
  // Serialization normalizes Markdown (escapes, bullets…); until the document
  // actually changes, hand back the original text so opening, switching tabs
  // or saving never rewrites a file the user did not edit.
  let baseline: string | null = null;
  const toFile = (md: string): string =>
    md === baseline && frontMatter === originalFrontMatter
      ? value
      : (frontMatter + md).replace(/\n/g, eol);

  const crepe = new Crepe({
    root: host,
    defaultValue: body,
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

  crepe.editor
    .config(markdownExtras.config)
    .use(markdownExtras.plugins)
    .use(findPlugin);

  const docListeners: (() => void)[] = [];

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      onChange(toFile(markdown));
      docListeners.forEach((fn) => fn());
    });
  });

  await crepe.create();
  baseline = crepe.getMarkdown();

  if (frontMatter) {
    host.prepend(
      frontMatterPanel(yaml, readerMode, (next) => {
        frontMatter = `---\n${next}\n---\n\n`;
        onChange(toFile(crepe.getMarkdown()));
      })
    );
  }

  const detachReaderGuard = readerMode ? attachReaderModeGuard(host) : null;

  return {
    getMarkdown: () => toFile(crepe.getMarkdown()),
    view: () => crepe.editor.ctx.get(editorViewCtx),
    onDocChange: (fn) => docListeners.push(fn),
    destroy: async () => {
      detachReaderGuard?.();
      await crepe.destroy();
    },
  };
}
