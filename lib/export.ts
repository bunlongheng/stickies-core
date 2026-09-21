import { toBlob } from "html-to-image";

/**
 * Save the whole note as an image - the full scroll height, not the visible
 * window. The node is cloned at its natural size so nothing is cut off at the
 * fold, the way Noto snapshots the entire web view rather than the viewport.
 */
export async function savePng(title: string) {
  const pane = document.querySelector<HTMLElement>(".note-html");
  if (!pane) return;
  const blob = await toBlob(pane, {
    backgroundColor: "#ffffff",
    width: pane.scrollWidth,
    height: pane.scrollHeight,
    style: { overflow: "visible", height: `${pane.scrollHeight}px` },
    pixelRatio: 2,
  });
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^\w\s-]/g, "").trim() || "note"}.png`;
  link.click();
  URL.revokeObjectURL(url);
}
