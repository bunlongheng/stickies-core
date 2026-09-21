import Board from "@/components/Board";
import { listNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";

/**
 * The server hands the client the list it already has, so the board paints with
 * real rows on the first frame instead of flashing empty and then filling in.
 */
export default async function Page() {
  return <Board initial={await listNotes()} />;
}
