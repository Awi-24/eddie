import DOMPurify from "dompurify";
import {
  InitReady,
  remarkPluginsCtx,
  remarkStringifyOptionsCtx,
} from "@milkdown/kit/core";
import type { Ctx, MilkdownPlugin } from "@milkdown/kit/ctx";
import { $prose, $remark, $view } from "@milkdown/kit/utils";
import { htmlSchema } from "@milkdown/kit/preset/commonmark";
import { imageBlockSchema } from "@milkdown/kit/component/image-block";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";

/* ---------------------------------------------------------------------------
   Front matter: kept out of the editor (remark would read it as <hr> + heading
   and rewrite it on save) and glued back on when the document is serialized.
--------------------------------------------------------------------------- */

const FRONT_MATTER =
  /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)(?:[ \t]*\r?\n)*/;

/** Split a leading YAML front matter block off the document: [raw block, yaml, body]. */
export function splitFrontMatter(markdown: string): [string, string, string] {
  const m = FRONT_MATTER.exec(markdown);
  // Require at least one `key:` line so a leading `---` rule isn't mistaken for YAML.
  if (!m || !/^[\w-]+\s*:/m.test(m[1])) return ["", "", markdown];
  return [m[0], m[1], markdown.slice(m[0].length)];
}

/* ---------------------------------------------------------------------------
   Embedded HTML. remark emits `<kbd>`, `Ctrl`, `</kbd>` as three sibling nodes,
   so Milkdown shows each tag as raw text. Merge an opening tag through its
   matching close into one `html` node holding the exact source slice, then
   render that node sanitized inside a shadow root.
--------------------------------------------------------------------------- */

interface MdPoint {
  offset?: number;
}
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  position?: { start: MdPoint; end: MdPoint };
}

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "source", "track", "wbr",
]);
const OPEN_TAG = /^<([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/;
const BR = /^<br\s*\/?\s*>$/i;
const PROTECTED_BR = "ezProtectedHtml";

function htmlValue(node: MdNode): string | null {
  if (node.type === "html") return node.value ?? "";
  const only = node.type === "paragraph" && node.children?.length === 1
    ? node.children[0]
    : null;
  return only?.type === "html" ? only.value ?? "" : null;
}

function tagBalance(html: string, tag: string): number {
  const opens = html.match(new RegExp(`<${tag}\\b[^>]*?(?<!/)>`, "gi"))?.length ?? 0;
  const closes = html.match(new RegExp(`</${tag}\\s*>`, "gi"))?.length ?? 0;
  return opens - closes;
}

function mergeHtml(parent: MdNode, source: string, contained: boolean): void {
  const kids = parent.children;
  if (!kids) return;
  for (let i = 0; i < kids.length; i++) {
    const first = htmlValue(kids[i]);
    const open = first === null ? null : OPEN_TAG.exec(first.trim());
    if (open && !open[2] && !VOID_TAGS.has(open[1].toLowerCase())) {
      let depth = 0;
      let end = -1;
      for (let j = i; j < kids.length; j++) {
        const h = htmlValue(kids[j]);
        if (h === null) continue;
        depth += tagBalance(h, open[1]);
        if (depth <= 0) {
          end = j;
          break;
        }
      }
      const start = kids[i].position?.start;
      const stop = end > i ? kids[end].position?.end : undefined;
      if (start?.offset !== undefined && stop?.offset !== undefined) {
        const raw = source.slice(start.offset, stop.offset);
        // Inside lists/quotes the source carries `> ` / indentation prefixes that
        // the serializer re-adds, so only merge single-line spans there. A blank
        // line means Markdown lives inside the tags (GitHub renders it), so keep
        // the tags as separate markers and let the editor own the content.
        const markdownInside = /\n[ \t]*\n/.test(raw);
        if (!markdownInside && (!contained || !raw.includes("\n"))) {
          kids.splice(i, end - i + 1, {
            type: "html",
            value: raw,
            position: { start, end: stop },
          });
          continue;
        }
      }
    }
    const child = kids[i];
    mergeHtml(child, source, contained || (child.type !== "root" && child.type !== "paragraph"));
  }
}

/** Hide inline `<br>` from Milkdown's empty-line plugin, which deletes every `<br>`. */
function protectInlineBreaks(node: MdNode, rename: [string, string]): void {
  const kids = node.children;
  if (!kids) return;
  for (const child of kids) {
    if (child.type === rename[0] && kids.length > 1 && BR.test(child.value?.trim() ?? "")) {
      child.type = rename[1];
    }
    protectInlineBreaks(child, rename);
  }
}

/** Runs before every preset remark plugin (hence the manual prepend). */
const mergeHtmlPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
  await ctx.wait(InitReady);
  const entry = {
    plugin: () => (tree: MdNode, file: { value: unknown }) => {
      mergeHtml(tree, String(file.value ?? ""), false);
      protectInlineBreaks(tree, ["html", PROTECTED_BR]);
    },
    options: {},
  };
  ctx.update(remarkPluginsCtx, (rp) => [entry as (typeof rp)[number], ...rp]);
  return () => ctx.update(remarkPluginsCtx, (rp) => rp.filter((x) => x !== entry));
};

/** Runs after the preset plugins: give protected `<br>` back its real type. */
const restoreBreaksPlugin = $remark("ezRestoreBreaks", () => () => (tree: unknown) => {
  protectInlineBreaks(tree as MdNode, [PROTECTED_BR, "html"]);
});

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "base", "link", "meta"],
    ADD_ATTR: ["target", "open"],
  });
}

const SHADOW_CSS = `<style>
  :host { display: inline; }
  :host(.md-html-block) { display: block; margin: 0.25em 0; }
  img, video { max-width: 100%; height: auto; }
  a { color: inherit; text-decoration: underline; }
  p { margin: 0.5em 0; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid var(--border); padding: 4px 8px; }
  kbd {
    font: 0.85em var(--font-mono, monospace);
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--panel);
  }
  summary { cursor: pointer; }
  .marker { color: var(--muted); font: 0.75em var(--font-mono, monospace); }
</style>`;

const BLOCK_START =
  /^<(address|article|aside|blockquote|center|details|dialog|div|dl|figure|footer|h[1-6]|header|hr|main|nav|ol|p|picture|pre|section|table|ul|video|audio)\b/i;

const LONE_TAG = /^<\/?([a-zA-Z][\w-]*)[^<>]*>$/;

let resolveImage: (src: string) => string = (src) => src;

/** Let the app map relative `<img src>` inside HTML to asset URLs. */
export function setHtmlImageResolver(fn: (src: string) => string): void {
  resolveImage = fn;
}

/** Render sanitized HTML into `host` through an isolated shadow root. */
function renderHtmlInto(host: HTMLElement, html: string): void {
  const clean = sanitizeHtml(html);
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  root.innerHTML = SHADOW_CSS + clean;
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) img.src = resolveImage(src);
  });
  // Shadow content does not survive cloneNode(); PDF export reads this instead.
  host.dataset.ezHtml = clean;
}

const isReaderMode = (): boolean =>
  document.documentElement.dataset.readerMode === "true";

function openHtmlSourceEditor(
  anchor: HTMLElement,
  value: string,
  onCommit: (next: string) => void
): void {
  const pop = document.createElement("div");
  pop.className = "md-html-editor";
  const area = document.createElement("textarea");
  area.value = value;
  area.spellcheck = false;
  area.rows = Math.min(16, Math.max(3, value.split("\n").length + 1));
  const hint = document.createElement("div");
  hint.className = "md-html-editor-hint";
  hint.textContent = "Ctrl+Enter to apply · Esc to cancel";
  pop.append(area, hint);
  document.body.appendChild(pop);

  const rect = anchor.getBoundingClientRect();
  const width = Math.min(560, window.innerWidth - 32);
  pop.style.width = `${width}px`;
  pop.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))}px`;
  pop.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - pop.offsetHeight - 16)}px`;

  let done = false;
  const close = (commit: boolean): void => {
    if (done) return;
    done = true;
    pop.remove();
    if (commit && area.value !== value) onCommit(area.value);
  };
  area.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") close(false);
    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) close(true);
  });
  area.addEventListener("blur", () => close(true));
  requestAnimationFrame(() => area.focus());
}

const htmlView = $view(htmlSchema.node, () => (initial, view, getPos) => {
  let node = initial;
  const dom = document.createElement("span");
  dom.className = "md-html";

  const render = (): void => {
    const value = String(node.attrs.value ?? "");
    const trimmed = value.trim();
    dom.classList.toggle("md-html-block", BLOCK_START.test(trimmed) || trimmed.includes("\n"));
    // Comments and lone open/close tags (Markdown sits between them) render as
    // a small muted marker in edit mode and disappear in reader mode.
    const lone = LONE_TAG.exec(trimmed);
    if (trimmed.startsWith("<!--") || (lone && !VOID_TAGS.has(lone[1].toLowerCase()))) {
      dom.classList.add("md-html-marker");
      dom.title = trimmed;
      const label = trimmed.startsWith("<!--") ? "<!-- -->" : trimmed;
      const root = dom.shadowRoot ?? dom.attachShadow({ mode: "open" });
      root.innerHTML = SHADOW_CSS;
      const span = document.createElement("span");
      span.className = "marker";
      span.textContent = label.length > 48 ? `${label.slice(0, 47)}…` : label;
      root.appendChild(span);
      dom.dataset.ezHtml = "";
      return;
    }
    dom.classList.remove("md-html-marker");
    dom.title = isReaderMode() ? "" : "Double-click to edit HTML";
    renderHtmlInto(dom, value);
  };

  dom.addEventListener("dblclick", (e) => {
    if (isReaderMode()) return;
    e.preventDefault();
    openHtmlSourceEditor(dom, String(node.attrs.value ?? ""), (next) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (typeof pos !== "number") return;
      const tr = next.trim()
        ? view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, value: next })
        : view.state.tr.delete(pos, pos + node.nodeSize);
      view.dispatch(tr);
    });
  });

  render();

  return {
    dom,
    update: (next) => {
      if (next.type !== node.type) return false;
      node = next;
      render();
      return true;
    },
    selectNode: () => dom.classList.add("selected"),
    deselectNode: () => dom.classList.remove("selected"),
    ignoreMutation: () => true,
  };
});

/* ---------------------------------------------------------------------------
   GitHub alerts: `> [!NOTE]` quotes get a class; the text itself is untouched.
--------------------------------------------------------------------------- */

const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;

const alertsPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey("md-alerts"),
      props: {
        decorations(state) {
          const decos: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name !== "blockquote") return true;
            const first = node.firstChild;
            const m = first?.isTextblock ? ALERT.exec(first.textContent) : null;
            if (m) {
              const kind = m[1].toLowerCase();
              decos.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: `md-alert md-alert-${kind}`,
                }),
                // +2: into the blockquote, then into its first paragraph.
                Decoration.inline(pos + 2, pos + 2 + m[0].length, {
                  class: "md-alert-marker",
                  "data-alert": kind,
                })
              );
            }
            return true;
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    })
);

/**
 * Crepe's image block stores its resize ratio in the alt text, so
 * `![A cat](cat.png)` saves as `![1.00](cat.png)`. Keep real alt text; only
 * numeric alts are treated as a ratio.
 */
function keepImageAlt(ctx: Ctx): void {
  ctx.update(imageBlockSchema.ctx.key, (base) => (c) => {
    const schema = base(c);
    return {
      ...schema,
      attrs: { ...schema.attrs, alt: { default: "", validate: "string" } },
      parseMarkdown: {
        match: schema.parseMarkdown.match,
        runner: (state, node, type) => {
          const alt = String(node.alt ?? "");
          const ratio = Number(alt);
          const isRatio = alt !== "" && !Number.isNaN(ratio) && ratio !== 0;
          state.addNode(type, {
            src: node.url,
            caption: node.title ?? "",
            ratio: isRatio ? ratio : 1,
            alt: isRatio ? "" : alt,
          });
        },
      },
      toMarkdown: {
        match: schema.toMarkdown.match,
        runner: (state, node) => {
          const ratio = Number.parseFloat(node.attrs.ratio);
          state.openNode("paragraph");
          state.addNode("image", undefined, undefined, {
            title: node.attrs.caption || undefined,
            url: node.attrs.src,
            // ponytail: a resized image with alt text keeps the alt, not the size.
            alt: node.attrs.alt || (ratio && ratio !== 1 ? ratio.toFixed(2) : ""),
          });
          state.closeNode();
        },
      },
    };
  });
}

/** Serializer tweaks: keep `-` bullets / `---` rules and GitHub alert markers. */
function stringifyOptions(ctx: Ctx): void {
  keepImageAlt(ctx);
  ctx.update(remarkStringifyOptionsCtx, (options) => ({
    ...options,
    bullet: "-" as const,
    rule: "-" as const,
    // remark escapes `[` in text, which would turn `[!NOTE]` into `\[!NOTE]`.
    handlers: {
      ...options.handlers,
      text: (node, _parent, state, info) =>
        state
          .safe(node.value, info)
          .replace(/^\\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, "[!$1]"),
    },
  }));
}

/** Everything this module adds to a Milkdown editor. */
export const markdownExtras = {
  config: stringifyOptions,
  plugins: [mergeHtmlPlugin, restoreBreaksPlugin, htmlView, alertsPlugin].flat(),
};
