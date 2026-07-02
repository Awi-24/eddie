import mermaid from "mermaid";

let mermaidReady = false;

function ensureMermaid(): void {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "strict",
    fontFamily: "inherit",
  });
  mermaidReady = true;
}

function blockLanguage(block: Element): string | null {
  const langEl = block.querySelector("[data-language]");
  const fromData = langEl?.getAttribute("data-language");
  if (fromData) return fromData.toLowerCase();

  const picker = block.querySelector(".language-button, .language-picker");
  const pickerText = picker?.textContent?.trim().toLowerCase();
  if (pickerText && pickerText !== "text") return pickerText;

  const className = block.className || "";
  const match = className.match(/language-(\w+)/i);
  if (match) return match[1].toLowerCase();

  const cm = block.querySelector(".cm-content");
  if (cm?.parentElement) {
    const cmMatch = cm.parentElement.className.match(/language-(\w+)/i);
    if (cmMatch) return cmMatch[1].toLowerCase();
  }
  return null;
}

function blockText(block: Element): string {
  const cm = block.querySelector(".cm-content");
  if (cm) return cm.textContent ?? "";
  const pre = block.querySelector("pre");
  if (pre) return pre.textContent ?? "";
  return block.textContent ?? "";
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

async function renderMermaidPreview(
  preview: HTMLElement,
  source: string
): Promise<void> {
  ensureMermaid();
  const id = `ez-mermaid-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const { svg } = await mermaid.render(id, source.trim());
    preview.innerHTML = svg;
    preview.classList.remove("diagram-preview-error");
  } catch {
    preview.textContent = "Could not render Mermaid diagram.";
    preview.classList.add("diagram-preview-error");
  }
}

function renderHtmlPreview(preview: HTMLElement, source: string): void {
  preview.innerHTML = sanitizeHtml(source.trim());
  preview.classList.remove("diagram-preview-error");
}

function findCodeBlocks(root: HTMLElement): Element[] {
  const blocks = new Set<Element>();
  root.querySelectorAll(".milkdown-code-block").forEach((el) => blocks.add(el));
  root.querySelectorAll("pre").forEach((el) => {
    if (el.closest(".diagram-preview, .html-preview")) return;
    blocks.add(el.closest(".milkdown-code-block") ?? el);
  });
  return [...blocks];
}

export interface DiagramRendererHandle {
  refresh: () => void;
  destroy: () => void;
}

/** Attach live Mermaid/HTML previews below fenced code blocks. */
export function attachDiagramRenderer(host: HTMLElement): DiagramRendererHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const refresh = (): void => {
    if (destroyed) return;
    for (const block of findCodeBlocks(host)) {
      const lang = blockLanguage(block);
      if (lang !== "mermaid" && lang !== "html") {
        block.querySelector(".diagram-preview, .html-preview")?.remove();
        continue;
      }

      const source = blockText(block);
      let preview = block.querySelector<HTMLElement>(
        lang === "mermaid" ? ".diagram-preview" : ".html-preview"
      );

      if (!preview) {
        preview = document.createElement("div");
        preview.className =
          lang === "mermaid" ? "diagram-preview" : "html-preview";
        block.appendChild(preview);
      }

      if (lang === "mermaid") {
        void renderMermaidPreview(preview, source);
      } else {
        renderHtmlPreview(preview, source);
      }
    }
  };

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refresh, 320);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(host, { childList: true, subtree: true, characterData: true });

  schedule();

  return {
    refresh,
    destroy: () => {
      destroyed = true;
      observer.disconnect();
      if (timer) clearTimeout(timer);
    },
  };
}

/** Force synchronous refresh before PDF export. */
export function refreshDiagramsForExport(root: HTMLElement): void {
  for (const block of findCodeBlocks(root)) {
    const lang = blockLanguage(block);
    if (lang !== "html") continue;
    const preview = block.querySelector<HTMLElement>(".html-preview");
    if (preview) renderHtmlPreview(preview, blockText(block));
  }
}
