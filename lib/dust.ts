import { whoosh } from "@/lib/whoosh";

/**
 * The dissolve a trashed note leaves behind.
 *
 * A snapshot of the open note is laid over the pane and erased left to right by a
 * gradient mask, with dust thrown off the erase front and tinted from the note's
 * own folder colour - a fixed particle colour reads as confetti thrown ON the page
 * rather than the page coming apart.
 *
 * It has to be a snapshot, not the live pane: the trash call moves the selection,
 * React swaps the pane for the next note, and a mask applied to the real element
 * goes with it. What the erase uncovers is that NEXT note, blurred and sharpening
 * into place - uncovered only once the erase has bitten in, because the trash call
 * can return in 80ms and would otherwise have the new note sharp while the old one
 * was still whole.
 *
 * Creeps, then rips: ~11% across at the halfway mark, and the last 70% of the note
 * goes in the final 0.35s. A harder curve reads as frozen.
 */
const DURATION = 1200;
const EASE = "cubic-bezier(0.45, 0, 0.75, 0.1)";

/**
 * Colours taken off the note itself, plus its folder tint.
 *
 * A single fixed particle colour reads as confetti thrown ON the page rather
 * than as the page coming apart - the dust has to look like it came out of what
 * is being erased.
 */
function bandColours(pane: HTMLElement, tint: string) {
  const found = new Set<string>([tint]);
  const elements = pane.querySelectorAll<HTMLElement>("*");
  const step = Math.max(1, Math.floor(elements.length / 60));
  for (let i = 0; i < elements.length && found.size < 8; i += step) {
    const style = getComputedStyle(elements[i]);
    for (const colour of [style.color, style.backgroundColor, style.borderTopColor]) {
      // Skip what cannot be seen: transparent, and the white page under it all.
      if (!colour || colour.includes("rgba(0, 0, 0, 0)")) continue;
      if (/^rgba?\(2[45]\d, 2[45]\d, 2[45]\d/.test(colour)) continue;
      found.add(colour);
    }
  }
  return [...found];
}

export async function dissolve(pane: HTMLElement, tint: string, work: () => Promise<void>) {
  const stage = pane.parentElement;
  if (!stage || typeof pane.animate !== "function" || prefersReducedMotion()) {
    await work();
    return;
  }

  const colours = bandColours(pane, tint);
  const shot = snapshot(pane);
  stage.appendChild(shot);
  whoosh();

  const started = performance.now();
  shot.animate([{ "--erase": "0%" } as Keyframe, { "--erase": "112%" } as Keyframe], {
    duration: DURATION,
    easing: EASE,
    fill: "forwards",
  });
  const stopDust = spawnDust(shot, colours, started);

  await work();

  await sleep(Math.max(0, DURATION - (performance.now() - started)));
  stopDust();
  shot.remove();

  const next = stage.querySelector<HTMLElement>(".note-html");
  next?.classList.add("arriving");
  setTimeout(() => next?.classList.remove("arriving"), 400);
}

/** A copy of the note as it looks right now, frozen over the real pane. */
function snapshot(pane: HTMLElement) {
  const clone = pane.cloneNode(true) as HTMLElement;
  clone.classList.add("dissolving");
  clone.classList.remove("arriving");
  clone.removeAttribute("style");
  clone.scrollTop = pane.scrollTop;
  clone.style.cssText = `position:absolute;inset:0;z-index:15;overflow:hidden;zoom:${
    getComputedStyle(pane).zoom || 1
  }`;
  // The clone keeps the scroll offset by shifting its content, not by scrolling:
  // a detached copy has no scroll position to restore.
  const shift = pane.scrollTop;
  if (shift) clone.style.setProperty("--shift", `-${shift}px`);
  return clone;
}

/** Dust off the erase front: fastest where the erase is fastest. */
function spawnDust(stage: HTMLElement, colours: string[], started: number) {
  const layer = document.createElement("div");
  layer.className = "dust-layer";
  stage.appendChild(layer);

  let frame = requestAnimationFrame(function tick() {
    const t = (performance.now() - started) / DURATION;
    if (t >= 1) return;
    const front = ease(t) * layer.clientWidth;
    // More dust as the tear accelerates, so the rip is where the mess is.
    const count = 1 + Math.floor(ease(Math.min(1, t + 0.05)) * 6);
    for (let i = 0; i < count; i++) emit(layer, front, colours[(Math.random() * colours.length) | 0]);
    frame = requestAnimationFrame(tick);
  });

  return () => {
    cancelAnimationFrame(frame);
    layer.remove();
  };
}

function emit(layer: HTMLElement, x: number, tint: string) {
  const speck = document.createElement("i");
  const size = 1 + Math.random() * 3;
  speck.style.cssText = `width:${size}px;height:${size}px;background:${tint};left:${x}px;top:${
    Math.random() * layer.clientHeight
  }px`;
  layer.appendChild(speck);
  const drift = speck.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 0.9 },
      {
        transform: `translate(${20 + Math.random() * 70}px, ${(Math.random() - 0.6) * 90}px) scale(0)`,
        opacity: 0,
      },
    ],
    { duration: 500 + Math.random() * 500, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" },
  );
  drift.finished.then(() => speck.remove(), () => speck.remove());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** The same curve as the mask, in JS, so the dust knows where the erase front is. */
function ease(x: number) {
  const curve = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (curve(mid, 0.45, 0.75) < x) lo = mid;
    else hi = mid;
  }
  return curve((lo + hi) / 2, 0, 0.1);
}
