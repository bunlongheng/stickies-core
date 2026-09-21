/**
 * Find in note: wraps every match in a <mark>, tracks the current one, scrolls it
 * into view. Ported from the script Noto injects into its web view - WebKit's own
 * find paints a native overlay that dims the page, which is not what a find bar
 * inside the note should look like.
 */
const HIT = "sn-hit";
const CURRENT = "sn-cur";

export function clear(root: HTMLElement) {
  root.querySelectorAll(`mark.${HIT}`).forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
  });
  root.normalize();
}

/** Marks every match and focuses the first. Returns how many there were. */
export function find(root: HTMLElement, term: string) {
  clear(root);
  if (!term) return 0;
  const needle = term.toLowerCase();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue;
      if (!text?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentNode?.nodeName;
      if (parent === "SCRIPT" || parent === "STYLE") return NodeFilter.FILTER_REJECT;
      return text.toLowerCase().includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) targets.push(node as Text);

  for (const node of targets) {
    const text = node.nodeValue ?? "";
    const low = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let i = 0;
    for (let at = low.indexOf(needle, i); at !== -1; at = low.indexOf(needle, i)) {
      if (at > i) frag.append(text.slice(i, at));
      const mark = document.createElement("mark");
      mark.className = HIT;
      mark.textContent = text.substr(at, term.length);
      frag.append(mark);
      i = at + term.length;
    }
    if (i < text.length) frag.append(text.slice(i));
    node.replaceWith(frag);
  }

  const hits = root.querySelectorAll(`mark.${HIT}`);
  if (hits.length) focus(root, 0);
  return hits.length;
}

/** Moves to the next or previous match, wrapping. Returns the 1-based position. */
export function step(root: HTMLElement, direction: number) {
  const hits = root.querySelectorAll(`mark.${HIT}`);
  if (!hits.length) return 0;
  const at = [...hits].findIndex((h) => h.classList.contains(CURRENT));
  const next = (at + direction + hits.length) % hits.length;
  focus(root, next);
  return next + 1;
}

function focus(root: HTMLElement, index: number) {
  const hits = root.querySelectorAll(`mark.${HIT}`);
  hits.forEach((h) => h.classList.remove(CURRENT));
  const hit = hits[index];
  hit?.classList.add(CURRENT);
  hit?.scrollIntoView({ block: "center" });
}
