import { Crepe, CrepeFeature } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import { createCodeBlockRenderPreview } from "./diagram-renderer";

export interface EditorHandle {
  getMarkdown: () => string;
  destroy: () => Promise<void>;
}

/**
 * Mount a Milkdown Crepe WYSIWYG editor into `host`.
 */
export async function mountEditor(
  host: HTMLElement,
  value: string,
  onChange: (markdown: string) => void,
  readOnly = false
): Promise<EditorHandle> {
  const crepe = new Crepe({
    root: host,
    defaultValue: value,
    featureConfigs: {
      placeholder: {
        text: readOnly
          ? "Reading mode — open a document to view formatted Markdown."
          : "Write here… type / to insert blocks",
      },
      [CrepeFeature.CodeMirror]: {
        previewOnlyByDefault: readOnly,
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
  crepe.setReadonly(readOnly);

  return {
    getMarkdown: () => crepe.getMarkdown(),
    destroy: async () => {
      await crepe.destroy();
    },
  };
}
