import Masthead from "@/components/Masthead";
import Row from "@/components/Row";
import { listFolders } from "@/lib/notes";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const folders = await listFolders();

  return (
    <main>
      <Masthead
        title="Stickies Core"
        caption={`${folders.length} folders`}
        color="#ece5d8"
      />
      {folders.length === 0 ? (
        <Empty />
      ) : (
        <div>
          {folders.map((f, i) => (
            <Row
              key={f.id}
              href={`/f/${f.id}`}
              title={f.title}
              meta={`${f.count} ${f.count === 1 ? "note" : "notes"}`}
              color={f.folder_color}
              index={i}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function Empty() {
  return (
    <p className="text-muted">
      No folders for this owner. Check <code>OWNER_USER_ID</code> and <code>DATABASE_URL</code>.
    </p>
  );
}
