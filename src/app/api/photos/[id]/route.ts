import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityPhotos } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const rows = await db
    .select({ data: activityPhotos.data, mime: activityPhotos.mimeType })
    .from(activityPhotos)
    .where(eq(activityPhotos.id, id))
    .limit(1);
  const photo = rows[0];
  if (!photo) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(photo.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": photo.mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
