import mermaid from "mermaid";

import { sanitizeHtml } from "./markdown-extras";

let mermaidTone: string | null = null;
let mermaidId = 0;
let renderQueue: Promise<void> = Promise.resolve();

function ensureMermaid(): void {
  // Re-initialize when the theme flips between light and dark.
  const tone = document.documentElement.dataset.themeTone ?? "light";
  if (tone === mermaidTone) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: tone === "dark" ? "dark" : "neutral",
    securityLevel: "antiscript",
    fontFamily: "inherit",
    suppressErrorRendering: true,
  });
  mermaidTone = tone;
}

function queueRender(task: () => Promise<void>): void {
  renderQueue = renderQueue.then(task).catch(() => {});
}

async function renderMermaidSvg(source: string): Promise<string | null> {
  const trimmed = source.trim();
  if (!trimmed) return null;

  ensureMermaid();
  try {
    await mermaid.parse(trimmed);
    const id = `ez-mermaid-${++mermaidId}`;
    const { svg, bindFunctions } = await mermaid.render(id, trimmed);
    const host = document.createElement("div");
    host.innerHTML = svg;
    bindFunctions?.(host);
    return host.innerHTML;
  } catch {
    return null;
  }
}

/** Crepe / Milkdown code-block renderPreview for mermaid and html fences. */
export function createCodeBlockRenderPreview() {
  return (
    language: string,
    content: string,
    applyPreview: (value: null | string | HTMLElement) => void
  ): void | null | string | HTMLElement => {
    const lang = language.toLowerCase();

    if (lang === "mermaid") {
      queueRender(async () => {
        const svg = await renderMermaidSvg(content);
        applyPreview(
          svg ?? (content.trim() ? "Could not render Mermaid diagram." : null)
        );
      });
      return;
    }

    if (lang === "html") {
      const trimmed = content.trim();
      if (!trimmed) {
        applyPreview(null);
        return null;
      }
      // Return markup, not an element: Crepe runs previews through DOMPurify,
      // which serializes elements and would drop a shadow root (blank preview).
      // sanitizeHtml already strips <style>/<script>, so nothing leaks out.
      return sanitizeHtml(trimmed);
    }

    return null;
  };
}

/** Resolves once queued Mermaid renders have landed in their previews. */
export function diagramsSettled(): Promise<void> {
  return renderQueue;
}
