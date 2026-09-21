import Board from "@/components/Board";
import { listNotes } from "@/lib/notes";
import { warm } from "@/lib/search-index";

export const dynamic = "force-dynamic";

/**
 * The server hands the client the list it already has, so the board paints with
 * real rows on the first frame instead of flashing empty and then filling in.
 */
export default async function Page() {
  // Start building the body index now, so the palette is already fast the first
  // time it is opened rather than paying for the build on the first keystroke.
  warm();
  return <Board initial={await listNotes()} />;
}
