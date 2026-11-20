export default function Loading() {
  return (
    <div className="px-4 pb-nav" aria-busy="true" aria-label="Carregando">
      <div className="-mx-4 border-b border-line" style={{ height: "calc(3rem + env(safe-area-inset-top))" }} />
      <div className="skel h-10 w-2/3 mt-6" />
      <div className="grid grid-cols-3 gap-2 mt-5">{[0, 1, 2].map((i) => <div key={i} className="skel h-[92px]" />)}</div>
      <div className="skel h-40 mt-6" />
      <div className="skel h-24 mt-3" />
      <div className="skel h-24 mt-3" />
    </div>
  );
}
