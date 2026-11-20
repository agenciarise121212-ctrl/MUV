import Recorder from "./Recorder";

export default async function RecordPage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const { sport } = await searchParams;
  return <Recorder initialSport={sport} />;
}
