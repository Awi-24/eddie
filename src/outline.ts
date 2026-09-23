import { TextSelection } from "@milkdown/kit/prose/state";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";

export interface OutlineHandle {
  /** Rebuild from the current editor (after mount or edits). */
  refresh: () => void;
}

interface Heading {
  level: number;
  text: string;
  pos: number;
}

function headingsOf(doc: ProseNode): Heading[] {
  const headings: Heading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ level: node.attrs.level as number, text: node.textContent, pos });
    }
    return node.isBlock && !node.isTextblock;
  });
  return headings;
}

/** Heading list for the sidebar's Outline pane: one row per heading, click to jump. */
export function initOutline(
  pane: HTMLElement,
  getView: () => EditorView | null
): OutlineHandle {
  const list = document.createElement("div");
  list.className = "file-tree outline-list";
  pane.appendChild(list);

  const jump = (index: number): void => {
    const view = getView();
    // Resolve at click time: the list may predate the last few keystrokes.
    const heading = view && headingsOf(view.state.doc)[index];
    if (!view || !heading) return;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, heading.pos + 1))
    );
    view.focus();
    // The browser scrolls the caret into view on its own when the selection
    // lands; scroll afterwards so the heading ends up at the top, exactly.
    requestAnimationFrame(() => {
      const el = view.nodeDOM(heading.pos);
      const scroller = view.dom.closest(".editor-host");
      if (!(el instanceof HTMLElement) || !scroller) return;
      const top =
        el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        16;
      scroller.scrollTo({ top, behavior: "smooth" });
    });
  };

  const refresh = (): void => {
    if (pane.hidden) return; // rebuilt when the pane is shown
    const view = getView();
    list.innerHTML = "";
    const headings = view ? headingsOf(view.state.doc) : [];
    if (!headings.length) {
      const empty = document.createElement("p");
      empty.className = "sidebar-empty";
      empty.textContent = view ? "No headings yet" : "No document open";
      list.appendChild(empty);
      return;
    }
    const top = Math.min(...headings.map((h) => h.level));
    headings.forEach((h, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "tree-row tree-file outline-row";
      row.style.paddingLeft = `${8 + (h.level - top) * 14}px`;
      row.title = h.text;
      const name = document.createElement("span");
      name.className = "tree-name";
      name.textContent = h.text || "Untitled";
      row.appendChild(name);
      row.addEventListener("click", () => jump(index));
      list.appendChild(row);
    });
  };

  refresh();
  return { refresh };
}
