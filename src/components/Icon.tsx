import type { SVGProps } from "react";

// Ícones de traço uniforme (1.6px), grade 24px — linguagem única MUV
const paths: Record<string, React.ReactNode> = {
  run: <><circle cx="14.5" cy="4.5" r="1.8" /><path d="M8 21l3.2-5.4 3 2.4V22M6.5 12.5l2.7-3.3 4.3-.7 2.2 3.3 3 1" /><path d="M13.5 8.5l-2.3 7.1" /></>,
  street_run: <><circle cx="14.5" cy="4.5" r="1.8" /><path d="M8 19l3.2-4.4 3 2.4V20M6.5 11.5l2.7-3.3 4.3-.7 2.2 3.3 3 1M13.5 7.5l-2.3 7.1" /><path d="M2 22h20" /></>,
  trail_run: <><circle cx="15" cy="4" r="1.7" /><path d="M9 16l2.6-4.4 2.6 2v4M7.6 9.6l2.4-2.8 3.8-.6 2 2.8 2.6.8M13.8 6.2l-2 6.1" /><path d="M2 22l5-5 3 2.5L15 15l7 7" /></>,
  indoor_run: <><circle cx="13" cy="4" r="1.7" /><path d="M8 15l2.6-4.4 2.6 2v3M6.6 8.6l2.4-2.8 3.8-.6 2 2.8 2.6.8M12.2 5.4l-2 6.1" /><path d="M3 19h15l3-3M5 19v3M17 19v3" /></>,
  walk: <><circle cx="13" cy="4" r="1.8" /><path d="M10 21l2-6 2.5 2.5V21M8.5 12l1.5-4 3-.5 2 3.5 2.5 1M12.8 7.8L12 15" /></>,
  leisure_walk: <><circle cx="11" cy="4" r="1.8" /><path d="M8 21l2-6 2.5 2.5V21M6.5 12l1.5-4 3-.5 2 3.5M10.8 7.8L10 15" /><path d="M18 21V9m0 0l-2.5 3M18 9l2.5 3M18 13l-2 2" /></>,
  long_walk: <><circle cx="12" cy="4" r="1.8" /><path d="M9 21l2-6 2.5 2.5V21M7.5 12l1.5-4 3-.5 2 3.5M11.8 7.8L11 15" /><path d="M14.5 8h3.5v6h-3" /></>,
  hike: <><circle cx="11" cy="4" r="1.8" /><path d="M8 21l2-6 2.5 2.5V21M6.5 12l1.5-4 3-.5 2 3.5M10.8 7.8L10 15" /><path d="M17.5 7L16 21M13 10.5h2.5" /></>,
  road_bike: <><circle cx="5.5" cy="16.5" r="3.8" /><circle cx="18.5" cy="16.5" r="3.8" /><path d="M5.5 16.5L9 9h7l2.5 7.5M9 9l3.5 7.5L16 9M8 6.5h3M15 6.5l1 2.5" /></>,
  mtb: <><circle cx="5.5" cy="16.5" r="3.8" strokeWidth="2.4" /><circle cx="18.5" cy="16.5" r="3.8" strokeWidth="2.4" /><path d="M5.5 16.5L9 9h7l2.5 7.5M9 9l3.5 7.5L16 9M8 6.5h3M14.5 5.5h3" /></>,
  urban_bike: <><circle cx="5.5" cy="16.5" r="3.8" /><circle cx="18.5" cy="16.5" r="3.8" /><path d="M5.5 16.5l4-7.5M9.5 9l3 7.5h-7M12.5 16.5L16 7h2.5M8 9h3" /></>,
  gravel: <><circle cx="5.5" cy="15.5" r="3.8" /><circle cx="18.5" cy="15.5" r="3.8" /><path d="M5.5 15.5L9 8h7l2.5 7.5M9 8l3.5 7.5L16 8M8 5.5h3" /><path d="M3 22h1M8 22h1.5M14 22h1M19 22h2" /></>,
  ebike: <><circle cx="5.5" cy="16.5" r="3.8" /><circle cx="18.5" cy="16.5" r="3.8" /><path d="M5.5 16.5L9 9h7l2.5 7.5M9 9l3.5 7.5L16 9M8 6.5h3" /><path d="M13 2l-2 3h3l-2 3" /></>,
  gym: <path d="M3 12h18M6 8v8M18 8v8M3.5 10v4M20.5 10v4" />,
  weights: <path d="M3 12h18M6 8v8M18 8v8M3.5 10v4M20.5 10v4" />,
  functional: <><circle cx="12" cy="4.5" r="1.8" /><path d="M4 9l8 1.5L20 9M12 10.5V15l-4 6M12 15l4 6" /></>,
  swim: <><circle cx="16.5" cy="7" r="1.8" /><path d="M5 12l5-4 3.5 3.5M2 17c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 21c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /></>,
  soccer: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5l4 3-1.5 4.5h-5L8 10.5zM12 3v4.5M16 10.5l4.5-1.5M14.5 15l2.5 4M9.5 15L7 19M8 10.5L3.5 9" /></>,
  skate: <><path d="M3 14h18l-2 2.5H5z" /><circle cx="7" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></>,
  inline: <><path d="M6 3h5l1 7h5a3 3 0 013 3v3H6z" /><circle cx="8" cy="20" r="1.5" /><circle cx="13" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></>,
  yoga: <><circle cx="12" cy="4.5" r="1.8" /><path d="M12 7.5v6M5 10l7 2 7-2M6 19l6-5.5 6 5.5M4 19h16" /></>,
  // UI
  home: <path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />,
  map: <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20" />,
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  locate: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" /><circle cx="12" cy="12" r="7.5" /></>,
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  feed: <path d="M4 5h16M4 12h16M4 19h10" />,
  record: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  pin: <><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8a3.5 3.5 0 000-7H8a3.5 3.5 0 010-7h8" /></>,
  mountain: <path d="M2 20l7-12 4 6 3-4 6 10z" />,
  trophy: <><path d="M7 4h10v5a5 5 0 01-10 0zM12 14v4M8 21h8M7 6H3.5a3 3 0 003.5 4M17 6h3.5a3 3 0 01-3.5 4" /></>,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  heart: <path d="M12 20s-8-4.8-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6.2-8 11-8 11z" />,
  thumb: <path d="M7 10v11H3V10zM7 10l4-7a2.5 2.5 0 012.5 3L13 10h6a2 2 0 012 2.3l-1.3 7A2 2 0 0117.7 21H7" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  share: <><path d="M12 3v13M7 8l5-5 5 5" /><path d="M5 13v7h14v-7" /></>,
  compare: <path d="M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  camera: <><path d="M3 8h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" /><circle cx="9" cy="10" r="1.8" /><path d="M3 18l6-5 4 3.5 3-2.5 5 4" /></>,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  lock: <><rect x="5" y="11" width="14" height="10" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
  grid: <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" />,
  menu: <path d="M3 7h18M3 17h18" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  medal: <><circle cx="12" cy="15" r="6" /><path d="M8 3l2.5 6.5M16 3l-2.5 6.5M12 12.5l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" /></>,
};

export default function Icon({ name, size = 22, className = "", ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden {...rest}>
      {paths[name] ?? paths.run}
    </svg>
  );
}
