import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { icons } from "./icons";

interface Match {
  from: number;
  to: number;
}

interface FindState {
  query: string;
  caseSensitive: boolean;
  matches: Match[];
  current: number;
}

type FindMeta = Partial<Pick<FindState, "query" | "caseSensitive" | "current">>;

const findKey = new PluginKey<FindState>("find");
const EMPTY: FindState = { query: "", caseSensitive: false, matches: [], current: -1 };

function search(doc: ProseNode, query: string, caseSensitive: boolean): Match[] {
  if (!query) return [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Flatten the block to text, remembering the doc position of each char.
    let text = "";
    const at: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) at.push(start + i);
        text += child.text;
      } else {
        at.push(start);
        text += "￼";
      }
    });
    const hay = caseSensitive ? text : text.toLowerCase();
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
      matches.push({ from: at[i], to: at[i + needle.length - 1] + 1 });
    }
    return false;
  });
  return matches;
}

/** ProseMirror plugin: holds the query and paints match decorations. */
export const findPlugin = $prose(
  () =>
    new Plugin<FindState>({
      key: findKey,
      state: {
        init: () => EMPTY,
        apply(tr, prev) {
          const meta = tr.getMeta(findKey) as FindMeta | undefined;
          if (!meta && !tr.docChanged) return prev;
          const next = { ...prev, ...meta };
          if (!next.query) return EMPTY;
          const matches = search(tr.doc, next.query, next.caseSensitive);
          const current = matches.length
            ? Math.min(Math.max(next.current, 0), matches.length - 1)
            : -1;
          return { ...next, matches, current };
        },
      },
      props: {
        decorations(state) {
          const { matches, current } = findKey.getState(state) ?? EMPTY;
          if (!matches.length) return null;
          return DecorationSet.create(
            state.doc,
            matches.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                class: i === current ? "find-match find-match-current" : "find-match",
              })
            )
          );
        },
      },
    })
);

const stateOf = (view: EditorView): FindState => findKey.getState(view.state) ?? EMPTY;

function reveal(view: EditorView): void {
  const { matches, current } = stateOf(view);
  const match = matches[current];
  if (!match) return;
  const tr = view.state.tr.setSelection(
    TextSelection.create(view.state.doc, match.from, match.to)
  );
  view.dispatch(tr.scrollIntoView());
}

function setQuery(view: EditorView, query: string, caseSensitive: boolean): void {
  // Start at the first match after the cursor, like most editors.
  const cursor = view.state.selection.from;
  const matches = search(view.state.doc, query, caseSensitive);
  const after = matches.findIndex((m) => m.from >= cursor);
  view.dispatch(
    view.state.tr.setMeta(findKey, {
      query,
      caseSensitive,
      current: after === -1 ? 0 : after,
    } satisfies FindMeta)
  );
}

function step(view: EditorView, dir: 1 | -1): void {
  const { matches, current } = stateOf(view);
  if (!matches.length) return;
  const next = (current + dir + matches.length) % matches.length;
  view.dispatch(view.state.tr.setMeta(findKey, { current: next } satisfies FindMeta));
  reveal(view);
}

function replaceCurrent(view: EditorView, text: string): void {
  const { matches, current } = stateOf(view);
  const match = matches[current];
  if (!match) return;
  const tr = text
    ? view.state.tr.insertText(text, match.from, match.to)
    : view.state.tr.delete(match.from, match.to);
  view.dispatch(tr);
  reveal(view);
}

function replaceAll(view: EditorView, text: string): void {
  const { matches } = stateOf(view);
  if (!matches.length) return;
  // Back to front so earlier positions stay valid; one transaction = one undo.
  const tr = view.state.tr;
  for (const m of [...matches].reverse()) {
    if (text) tr.insertText(text, m.from, m.to);
    else tr.delete(m.from, m.to);
  }
  view.dispatch(tr);
}

export interface FindBarHandle {
  open: (withReplace: boolean) => void;
  close: () => void;
  /** Re-apply the query after the editor was remounted (tab switch). */
  refresh: () => void;
}

/** Floating find / replace bar over the editor. */
export function initFindBar(
  host: HTMLElement,
  getView: () => EditorView | null,
  isReadOnly: () => boolean
): FindBarHandle {
  const bar = document.createElement("div");
  bar.className = "find-bar";
  bar.hidden = true;
  bar.innerHTML = `
    <div class="find-row">
      <input class="find-input" type="text" placeholder="Find" spellcheck="false" aria-label="Find" />
      <span class="find-count" aria-live="polite"></span>
      <button type="button" class="icon-btn find-case" title="Match case" aria-label="Match case" aria-pressed="false">Aa</button>
      <button type="button" class="icon-btn find-prev" title="Previous (Shift+Enter)" aria-label="Previous match">${icons.chevronUp}</button>
      <button type="button" class="icon-btn find-next" title="Next (Enter)" aria-label="Next match">${icons.chevronDown}</button>
      <button type="button" class="icon-btn find-close" title="Close (Esc)" aria-label="Close">${icons.close}</button>
    </div>
    <div class="find-row find-replace-row edit-only">
      <input class="find-replace-input" type="text" placeholder="Replace" spellcheck="false" aria-label="Replace" />
      <button type="button" class="btn find-replace-one">Replace</button>
      <button type="button" class="btn find-replace-all">All</button>
    </div>`;
  host.appendChild(bar);

  const input = bar.querySelector(".find-input") as HTMLInputElement;
  const replaceInput = bar.querySelector(".find-replace-input") as HTMLInputElement;
  const replaceRow = bar.querySelector(".find-replace-row") as HTMLElement;
  const count = bar.querySelector(".find-count") as HTMLElement;
  const caseBtn = bar.querySelector(".find-case") as HTMLButtonElement;
  let caseSensitive = false;

  const updateCount = (): void => {
    const view = getView();
    const { matches, current } = view ? stateOf(view) : EMPTY;
    count.textContent = input.value
      ? matches.length ? `${current + 1}/${matches.length}` : "No results"
      : "";
  };

  const run = (): void => {
    const view = getView();
    if (!view) return;
    setQuery(view, bar.hidden ? "" : input.value, caseSensitive);
    if (!bar.hidden) reveal(view);
    updateCount();
  };

  const withView = (fn: (view: EditorView) => void) => (): void => {
    const view = getView();
    if (!view) return;
    fn(view);
    updateCount();
  };
  const next = withView((v) => step(v, 1));
  const prev = withView((v) => step(v, -1));

  input.addEventListener("input", run);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    }
  });
  replaceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      withView((v) => replaceCurrent(v, replaceInput.value))();
    }
  });
  bar.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  caseBtn.addEventListener("click", () => {
    caseSensitive = !caseSensitive;
    caseBtn.setAttribute("aria-pressed", String(caseSensitive));
    run();
  });
  bar.querySelector(".find-next")!.addEventListener("click", next);
  bar.querySelector(".find-prev")!.addEventListener("click", prev);
  bar.querySelector(".find-close")!.addEventListener("click", () => close());
  bar.querySelector(".find-replace-one")!.addEventListener(
    "click",
    withView((v) => replaceCurrent(v, replaceInput.value))
  );
  bar.querySelector(".find-replace-all")!.addEventListener(
    "click",
    withView((v) => replaceAll(v, replaceInput.value))
  );

  const open = (withReplace: boolean): void => {
    const view = getView();
    if (!view) return;
    const wasHidden = bar.hidden;
    bar.hidden = false;
    replaceRow.hidden = !withReplace || isReadOnly();
    // Seed with the selected text, like VS Code.
    const { from, to } = view.state.selection;
    const selected = view.state.doc.textBetween(from, to, " ");
    if (selected && !selected.includes("\n") && selected.length < 200) input.value = selected;
    input.focus();
    input.select();
    if (wasHidden || selected) run();
  };

  function close(): void {
    if (bar.hidden) return;
    bar.hidden = true;
    run();
    getView()?.focus();
  }

  return { open, close, refresh: run };
}
