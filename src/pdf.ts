import { diagramsSettled } from "./diagram-renderer";

/**
 * Crepe only mounts code blocks (highlighting, Mermaid/HTML previews) while
 * they are near the viewport; the rest are plain <pre> placeholders. Mount
 * them all through their ProseMirror node view, then give the highlighting
 * grammars a moment to load.
 */
async function mountAllCodeBlocks(root: HTMLElement): Promise<void> {
  const placeholders = root.querySelectorAll(".milkdown-code-block-placeholder");
  if (placeholders.length === 0) return;
  placeholders.forEach((pre) => {
    // ponytail: Milkdown internal (CodeMirrorBlock.initializeCodeMirror via
    // pmViewDesc.spec); re-check if code blocks print as plain text after an upgrade.
    const block = pre.closest(".milkdown-code-block") as
      | (HTMLElement & { pmViewDesc?: { spec?: { initializeCodeMirror?: () => void } } })
      | null;
    block?.pmViewDesc?.spec?.initializeCodeMirror?.();
  });
  await new Promise((r) => setTimeout(r, 300));
}

/**
 * Print the open document through the WebView's native print engine; the
 * system dialog offers "Save as PDF". `@media print` in styles.css strips the
 * chrome, so the PDF is the live editor as rendered: vector text, theme,
 * diagrams and embedded HTML (shadow roots included).
 */
export async function exportEditorToPdf(
  root: HTMLElement,
  title: string
): Promise<void> {
  await mountAllCodeBlocks(root);
  await diagramsSettled();

  // Chromium leaves @page margins white; paint them with the theme background.
  const pageStyle = document.createElement("style");
  const bg = getComputedStyle(document.body).backgroundColor;
  pageStyle.textContent = `@page { background: ${bg}; }`;
  document.head.append(pageStyle);

  const previous = document.title;
  document.title = title; // default file name in the print dialog
  window.addEventListener(
    "afterprint",
    () => {
      document.title = previous;
      pageStyle.remove();
    },
    { once: true }
  );
  window.print();
}
