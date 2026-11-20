import { notFound } from "next/navigation";
import { getActivity, simplify } from "@/lib/queries";
import Editor from "./Editor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const a = await getActivity(Number((await params).id));
  if (!a) notFound();
  const isNew = (await searchParams).new === "1";
  return (
    <Editor
      isNew={isNew}
      activity={{ id: a.id, sport: a.sport, title: a.title, caption: a.caption, status: a.status, extra: a.extra, distanceM: a.distanceM, movingSec: a.movingSec, elevGainM: a.elevGainM, avgSpeed: a.avgSpeed, calories: a.calories, integrity: a.integrity, integrityReasons: a.integrityReasons }}
      points={simplify(a.points).map((p) => ({ lat: p.lat, lng: p.lng }))}
      photos={a.photos.map((p) => p.id)}
    />
  );
}
