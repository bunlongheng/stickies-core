import { toCanvas } from "html-to-image";

/** WebP needs an encoder; Safari before 16 has none, and the menu hides it then. */
export const canWebp = (() => {
  if (typeof document === "undefined") return false;
  try {
    return document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
})();

/**
 * Save the whole note as one image - the entire document, not the part that
 * happens to be on screen.
 *
 * Drawn at 2x for a sharp file, backed off only when a very long note would
 * otherwise ask for a bitmap measured in gigabytes: ~60 MP is about 240 MB of
 * pixels, past which the file stops being useful and starts being a memory
 * spike. The white fill matters - a note's HTML assumes a page under it, and
 * every gap would otherwise come out transparent, which reads as black the
 * moment the file lands in a dark viewer.
 */
export async function saveImage(title: string, format: "png" | "webp" = "png") {
  const pane = document.querySelector<HTMLElement>(".note-html");
  if (!pane) return { ok: false, message: "There is no note open to save." };

  const width = pane.scrollWidth;
  const height = pane.scrollHeight;
  if (!width || !height) return { ok: false, message: "The note produced no printable page." };

  const MAX_PIXELS = 60_000_000;
  let scale = 2;
  if (width * height * scale * scale > MAX_PIXELS) {
    scale = Math.max(1, Math.sqrt(MAX_PIXELS / (width * height)));
  }

  try {
    const canvas = await toCanvas(pane, {
      backgroundColor: "#ffffff",
      width,
      height,
      pixelRatio: scale,
      style: { overflow: "visible", height: `${height}px`, zoom: "1" },
    });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, format === "webp" ? "image/webp" : "image/png"),
    );
    if (!blob) return { ok: false, message: "The image was too large to draw." };

    const name = `${title.replace(/[^\w\s-]/g, "").trim() || "note"}.${format}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, message: `Saved ${name} (${Math.round(blob.size / 1024)} KB)` };
  } catch (e) {
    return { ok: false, message: `Could not save it: ${e instanceof Error ? e.message : "failed"}` };
  }
}
