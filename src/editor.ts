import { Crepe } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import {
  attachDiagramRenderer,
  type DiagramRendererHandle,
} from "./diagram-renderer";

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
    },
  });

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      onChange(markdown);
    });
  });

  await crepe.create();
  crepe.setReadonly(readOnly);

  let diagrams: DiagramRendererHandle | null = attachDiagramRenderer(host);

  return {
    getMarkdown: () => crepe.getMarkdown(),
    destroy: async () => {
      diagrams?.destroy();
      diagrams = null;
      await crepe.destroy();
    },
  };
}
