import { writeBytes } from "./api";
import { refreshDiagramsForExport } from "./diagram-renderer";

/** Export rendered editor content to a PDF file on disk. */
export async function exportEditorToPdf(
  source: HTMLElement,
  outputPath: string,
  title: string
): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js");
  const theme = document.documentElement.getAttribute("data-theme") ?? "notebook";
  const styles = getComputedStyle(document.documentElement);

  const wrapper = document.createElement("div");
  wrapper.className = "pdf-export-root";
  wrapper.setAttribute("data-theme", theme);
  wrapper.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: 760px;
    padding: 36px 24px 48px;
    background: ${styles.getPropertyValue("--bg").trim() || "#fff"};
    color: ${styles.getPropertyValue("--fg").trim() || "#111"};
    font-family: ${styles.getPropertyValue("--font-content").trim() || "serif"};
    font-size: ${styles.getPropertyValue("--content-size").trim() || "16.5px"};
    line-height: ${styles.getPropertyValue("--content-leading").trim() || "1.78"};
  `;

  const heading = document.createElement("h1");
  heading.textContent = title;
  heading.style.cssText =
    "font-size:1.35em;margin:0 0 0.75em;font-weight:700;letter-spacing:-0.02em;";

  refreshDiagramsForExport(source);

  const body = source.cloneNode(true) as HTMLElement;
  body.style.padding = "0";
  body.querySelectorAll("[contenteditable]").forEach((el) => {
    el.removeAttribute("contenteditable");
  });

  wrapper.append(heading, body);
  document.body.appendChild(wrapper);

  try {
    const blob = (await html2pdf()
      .set({
        margin: [12, 14, 16, 14],
        filename: "document.pdf",
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor:
            styles.getPropertyValue("--bg").trim() || "#ffffff",
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(wrapper)
      .outputPdf("blob")) as Blob;

    await writeBytes(outputPath, new Uint8Array(await blob.arrayBuffer()));
  } finally {
    wrapper.remove();
  }
}
