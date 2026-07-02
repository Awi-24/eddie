import mermaid from "mermaid";

let mermaidReady = false;
let mermaidId = 0;
let renderQueue: Promise<void> = Promise.resolve();

function ensureMermaid(): void {
  if (mermaidReady) return;
  const dark = document.documentElement.dataset.themeTone === "dark";
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "neutral",
    securityLevel: "antiscript",
    fontFamily: "inherit",
    suppressErrorRendering: true,
  });
  mermaidReady = true;
}

function queueRender(task: () => Promise<void>): void {
  renderQueue = renderQueue.then(task).catch(() => {});
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
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
      return sanitizeHtml(trimmed);
    }

    return null;
  };
}

function blockText(block: Element): string {
  const cm = block.querySelector(".cm-content");
  if (cm) {
    const lines = cm.querySelectorAll(".cm-line");
    if (lines.length > 0) {
      return Array.from(lines, (line) => line.textContent ?? "").join("\n");
    }
    return cm.textContent ?? "";
  }
  return "";
}

function blockLanguage(block: Element): string | null {
  const picker = block.querySelector(".language-button, .language-picker");
  const pickerText = picker?.textContent?.trim().toLowerCase();
  if (pickerText && pickerText !== "text") return pickerText;
  return block.getAttribute("data-language")?.toLowerCase() ?? null;
}

/** Ensure mermaid/html previews are visible in a clone before PDF export. */
export async function prepareDiagramsForExport(root: HTMLElement): Promise<void> {
  const blocks = root.querySelectorAll(".milkdown-code-block");
  for (const block of blocks) {
    const lang = blockLanguage(block);
    if (lang !== "mermaid" && lang !== "html") continue;

    const preview = block.querySelector<HTMLElement>(".preview");
    if (!preview) continue;

    const source = blockText(block);
    if (lang === "mermaid") {
      const svg = await renderMermaidSvg(source);
      preview.innerHTML =
        svg ??
        (source.trim() ? "Could not render Mermaid diagram." : "");
    } else {
      preview.innerHTML = sanitizeHtml(source.trim());
    }

    block.querySelector(".preview-panel")?.classList.remove("hidden");
    block.querySelector(".codemirror-host")?.classList.add("hidden");
  }
}

export interface DiagramRendererHandle {
  refresh: () => void;
  destroy: () => void;
}

/** @deprecated previews are handled by Crepe codeMirror config */
export function attachDiagramRenderer(
  _host: HTMLElement,
  _options: { readOnly?: boolean } = {}
): DiagramRendererHandle {
  return { refresh: () => {}, destroy: () => {} };
}

/** @deprecated use prepareDiagramsForExport */
export function refreshDiagramsForExport(root: HTMLElement): void {
  void prepareDiagramsForExport(root);
}
