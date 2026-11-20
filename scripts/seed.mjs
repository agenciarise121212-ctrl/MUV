import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const ACHIEVEMENTS = [
  ["first_activity", "Primeiro movimento", "Registre sua primeira atividade.", "geral", "🌱", "activities", null, 1, "atividades", "bronze", 120, 10],
  ["run_5k", "Cinco quilômetros", "Complete uma corrida de 5 km.", "corrida", "🏃", "longest_run_m", "run", 5000, "m", "bronze", 150, 15],
  ["run_10k", "Dez voando", "Complete uma corrida de 10 km.", "corrida", "🔟", "longest_run_m", "run", 10000, "m", "prata", 250, 25],
  ["run_21k", "Meia maratona", "Complete 21,1 km em uma única corrida.", "corrida", "🥈", "longest_run_m", "run", 21100, "m", "ouro", 500, 60],
  ["run_total_42", "Maratonista", "Acumule 42 km de corrida.", "corrida", "🏅", "sport_distance_m", "run", 42195, "m", "ouro", 400, 40],
  ["run_total_100", "Cem km de asfalto", "Acumule 100 km de corrida.", "corrida", "💯", "sport_distance_m", "run", 100000, "m", "ouro", 700, 80],
  ["ride_20k", "Primeiro pedal", "Complete um pedal de 20 km.", "ciclismo", "🚴", "longest_ride_m", "ride", 20000, "m", "bronze", 150, 15],
  ["ride_50k", "Cinquenta na estrada", "Complete um pedal de 50 km.", "ciclismo", "🛣️", "longest_ride_m", "ride", 50000, "m", "prata", 300, 30],
  ["ride_100k", "Pedal centenário", "Complete 100 km em um único pedal.", "ciclismo", "🥇", "longest_ride_m", "ride", 100000, "m", "ouro", 800, 100],
  ["ride_total_500", "500 km de pedal", "Acumule 500 km de ciclismo.", "ciclismo", "⚙️", "sport_distance_m", "ride", 500000, "m", "ouro", 900, 110],
  ["ride_climb_500", "Alpinista de pedal", "Acumule 500 m de ganho em ciclismo.", "ciclismo", "⛰️", "sport_elev_m", "ride", 500, "m", "prata", 300, 30],
  ["ride_climb_2000", "Montanha vencida", "Acumule 2.000 m de ganho em ciclismo.", "ciclismo", "🏔️", "sport_elev_m", "ride", 2000, "m", "ouro", 800, 90],
  ["walk_10k_total", "Passo firme", "Acumule 10 km de caminhada.", "caminhada", "🚶", "sport_distance_m", "walk", 10000, "m", "bronze", 150, 15],
  ["walk_50k_total", "Andarilho", "Acumule 50 km de caminhada.", "caminhada", "🧭", "sport_distance_m", "walk", 50000, "m", "prata", 350, 35],
  ["hike_climb_300", "Cume alcançado", "Acumule 300 m de ganho em trilhas.", "trilha", "🥾", "sport_elev_m", "hike", 300, "m", "prata", 300, 30],
  ["trail_run_10k", "Trail 10k", "Complete 10 km de trail running.", "trilha", "⛰️", "longest_sport_m", "run_trail", 10000, "m", "ouro", 450, 45],
  ["streak_3", "Três dias seguidos", "Atividades em 3 dias consecutivos.", "constância", "🔥", "streak", null, 3, "dias", "bronze", 200, 20],
  ["streak_7", "Semana perfeita", "Atividades em 7 dias consecutivos.", "constância", "🔥", "streak", null, 7, "dias", "prata", 450, 45],
  ["streak_30", "Mês imparável", "Atividades em 30 dias consecutivos.", "constância", "☄️", "streak", null, 30, "dias", "ouro", 1200, 150],
  ["early_bird", "Aurora", "Conclua uma atividade antes das 6h.", "constância", "🌅", "early_activity", null, 1, "treinos", "bronze", 120, 12],
  ["night_owl", "Coruja do pedal", "Conclua uma atividade depois das 22h.", "constância", "🌙", "night_activity", null, 1, "treinos", "bronze", 120, 12],
  ["weekend_5", "Guerreiro de fim de semana", "5 atividades em sábados ou domingos.", "constância", "🎉", "weekend_activities", null, 5, "treinos", "prata", 250, 25],
  ["elev_total_1000", "Mil metros verticais", "Acumule 1.000 m de ganho total.", "geral", "🧗", "elev_total_m", null, 1000, "m", "prata", 350, 35],
  ["activities_25", "Vinte e cinco", "Complete 25 atividades.", "geral", "📚", "activities", null, 25, "atividades", "prata", 400, 40],
  ["photographer", "Fotógrafo de trilha", "Publique 10 fotos em atividades.", "social", "📸", "photos", null, 10, "fotos", "prata", 300, 30],
  ["territory_1", "Território dominado", "Domine seu primeiro território.", "território", "🗺️", "territories", null, 1, "territórios", "prata", 400, 40],
  ["territory_5", "Cartógrafo", "Domine 5 territórios.", "território", "🧭", "territories", null, 5, "territórios", "ouro", 900, 100],
  ["social_kudos", "Torcedor", "Receba 25 kudos nas suas atividades.", "social", "👏", "kudos_received", null, 25, "kudos", "bronze", 200, 20],
  ["segment_cr", "Rei do segmento", "Seja o mais rápido em um segmento.", "segmento", "👑", "segment_crs", null, 1, "CRs", "ouro", 600, 70],
  ["challenge_done", "Desafio concluído", "Conclua um desafio.", "desafio", "🏆", "challenges_completed", null, 1, "desafios", "prata", 350, 35],
];

const COLUMNS = ["key", "name", "description", "category", "icon", "metric", "sport", "threshold", "unit", "tier", "xp_reward", "coins_reward"];

const TERRITORIES = [
  ["Parque Ibirapuera", "Sul · São Paulo", "Clássico ponto de encontro de corredores e ciclistas.", "🌳", -23.5874, -46.6576, 1400, 250, 25],
  ["Parque do Carmo", "Leste · São Paulo", "Percurso longo e arborizado, favorito de longas caminhadas.", "🌸", -23.5653, -46.5064, 1300, 250, 25],
  ["Parque Villa-Lobos", "Oeste · São Paulo", "Ciclovia interna muito usada para treinos de pedal.", "🚲", -23.5468, -46.7235, 1100, 250, 25],
  ["USP Cidade Universitária", "Oeste · São Paulo", "Campus plano e seguro para tiros de velocidade.", "🎓", -23.5595, -46.7313, 1600, 250, 25],
  ["Represa Billings", "Sul · São Bernardo", "Subidas e descidas com vista para a água.", "🌊", -23.6821, -46.5809, 2200, 400, 40],
  ["Serra da Cantareira", "Norte · São Paulo", "Trilhas de montanha com ganho acumulado elevado.", "🏔️", -23.4306, -46.6206, 2600, 500, 50],
  ["Avenida Paulista", "Centro · São Paulo", "Rota urbana icônica de cicloturismo.", "🏙️", -23.5614, -46.6559, 1100, 250, 25],
  ["Praia do Boqueirão", "Litoral · São Vicente", "Rota plana de calçadão para treinos de resistência.", "🏖️", -23.9669, -46.3364, 1800, 300, 30],
];

const CHALLENGES = [
  ["Desafio 100 km de pedal", "Acumule 100 km em pedais durante o mês.", "ride", "distance_m", 100000, "km", "🚴", 30],
  ["Subida total 1.000 m", "Some 1.000 metros de ganho em ciclismo.", "ride", "elev_gain_m", 1000, "m", "⛰️", 30],
  ["Corrida 50 km", "Corra 50 km no período do desafio.", "run", "distance_m", 50000, "km", "🏃", 21],
  ["Trail 10 horas", "Acumule 10 horas em trilhas e caminhadas.", "hike", "moving_sec", 36000, "h", "🥾", 45],
  ["Constância: 12 treinos", "Complete 12 atividades de qualquer modalidade.", null, "activities_count", 12, "treinos", "🔥", 30],
  ["Caminhada 40 km", "Caminhe 40 km no mês.", "walk", "distance_m", 40000, "km", "🚶", 30],
];

const REWARDS = [
  ["Garrafa térmica MUV 750 ml", "Garrafa inox com tampa térmica da comunidade.", "kit", "🥤", 120, "MUV Store", 40],
  ["Camiseta dry-fit edição territórios", "Camiseta oficial com mapa dos territórios.", "kit", "👕", 260, "MUV Store", 25],
  ["Meias de compressão (par)", "Para treinos longos de pedal e corrida.", "kit", "🧦", 180, "RunLab", 30],
  ["Desconto R$ 40 em produtos de ciclismo", "Cupom para lojas parceiras de bike.", "cupom", "🎟️", 320, "PedalShop", 20],
  ["Serviço de bike fit", "Ajuste completo de posição na bicicleta.", "serviço", "🔧", 900, "Bike Studio SP", 6],
  ["Inscrição em corrida de rua 10 km", "Vaga em evento parceiro da cidade.", "evento", "🎽", 1200, "Circuito MUV", 5],
  ["Day use em base de trilha", "Acesso ao parque com guia por um dia.", "experiência", "🏕️", 700, "Trilha Viva", 8],
  ["Nutrição esportiva (kit gels)", "Cinco géis carboidrato + sal refill.", "kit", "🍬", 240, "EnduraBR", 35],
];

const SEGMENTS = [
  ["Subida da Av.acuário Fonseca", "Subida clássica com inclinação média constante.", "ride", "São Paulo", 1900, 3.4, -23.5480, -46.7210, -23.5435, -46.7262],
  ["Volta completa do Ibirapuera", "Laço de 3 km usado por corredores e ciclistas.", "run", "São Paulo", 3000, 0.4, -23.5880, -46.6620, -23.5881, -46.6618],
  ["Reta do Rio Pinheiros", "Trecho plano e rápido para tiros de velocidade.", "ride", "São Paulo", 4200, 0.2, -23.5660, -46.7010, -23.5750, -46.6900],
  ["Escadaria do Carmo", "Subida curta e íngreme para testar força.", "run", "São Paulo", 900, 6.1, -23.5665, -46.5080, -23.5652, -46.5072],
  ["Descida da Cantareira", "Descida técnica de mountain bike.", "mtb", "São Paulo", 2600, -4.2, -23.4310, -46.6180, -23.4380, -46.6120],
];

const USERS = [
  { username: "ana", name: "Ana Souza", email: "ana@muv.app", bio: "Ciclista urbana e corredora de rua. Sempre em busca de novos territórios.", city: "São Paulo, SP", color: "flame", weight: 63, sex: "f" },
  { username: "bruno", name: "Bruno Lima", email: "bruno@muv.app", bio: "Trail runner de fim de semana e mountain bike nos feriados.", city: "São Paulo, SP", color: "mint", weight: 78, sex: "m" },
  { username: "carla", name: "Carla Dias", email: "carla@muv.app", bio: "Caminhadas longas, fotografia de trilha e desafios de constância.", city: "Santo André, SP", color: "sky", weight: 68, sex: "f" },
];

const CENTER_SP = { lat: -23.5874, lng: -46.6576 };

function buildTrack({ center, distanceM, speedKmh, startTime, hills = 18, seed = 1 }) {
  const dt = 3;
  const speed = speedKmh / 3.6;
  const totalSec = distanceM / speed;
  const steps = Math.max(60, Math.round(totalSec / dt));
  const track = [];
  const baseRadius = distanceM / (2 * Math.PI);
  let angle = seed;
  let elevation = 600;
  for (let i = 0; i < steps; i += 1) {
    const progress = i / steps;
    const radius = baseRadius * (0.62 + 0.38 * Math.abs(Math.sin(progress * Math.PI * 2 + seed)));
    angle += (speed * dt) / radius;
    const dLat = (Math.cos(angle) * speed * dt) / 110540;
    const dLng = (Math.sin(angle) * speed * dt) / (111320 * Math.cos((center.lat * Math.PI) / 180));
    const prev = track[track.length - 1];
    const lat = (prev?.lat ?? center.lat) + dLat;
    const lng = (prev?.lng ?? center.lng) + dLng;
    elevation += Math.sin(progress * Math.PI * hills + seed) * 1.35;
    const acc = 6 + Math.round(Math.abs(Math.sin(progress * 9 + seed)) * 9);
    track.push({
      t: startTime + i * dt * 1000,
      lat,
      lng,
      alt: Number(elevation.toFixed(1)),
      acc,
      spd: Number((speedKmh * (0.9 + 0.2 * Math.abs(Math.sin(progress * 7)))).toFixed(2)),
    });
  }
  return track;
}

function trackStats(track, movingSec, sportKey, weight) {
  let distance = 0;
  let gain = 0;
  let loss = 0;
  let maxSpeed = 0;
  let base = null;
  let accSum = 0;
  for (let i = 1; i < track.length; i += 1) {
    const a = track[i - 1];
    const b = track[i];
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    distance += 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
    if (base === null) base = a.alt;
    const delta = b.alt - base;
    if (delta > 1.5) {
      gain += delta;
      base = b.alt;
    } else if (delta < -1.5) {
      loss += -delta;
      base = b.alt;
    }
    maxSpeed = Math.max(maxSpeed, b.spd);
    accSum += b.acc ?? 8;
  }
  const hours = movingSec / 3600;
  const km = distance / 1000;
  const kmh = km / hours;
  let met = 9.8;
  if (sportKey.startsWith("ride") || sportKey === "mtb" || sportKey === "gravel") met = Math.min(3.5 + kmh * 0.42, 18);
  else if (sportKey.startsWith("walk") || sportKey === "hike") met = Math.min(Math.max(1.35 * kmh + 0.6, 2.5), 12);
  else met = Math.min(1.05 * kmh + 1.2, 26);
  return {
    distance: Math.round(distance),
    gain: Math.round(gain),
    loss: Math.round(loss),
    maxSpeed: Number(maxSpeed.toFixed(2)),
    avgSpeed: Number(kmh.toFixed(2)),
    pace: distance > 30 ? Number((movingSec / km).toFixed(2)) : 0,
    calories: Math.round(met * weight * hours),
    accuracy: Number((accSum / track.length).toFixed(1)),
  };
}

function photoSvg(label, colorA, colorB) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colorA}"/>
      <stop offset="100%" stop-color="${colorB}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#sky)"/>
  <circle cx="940" cy="190" r="90" fill="#ffffff" opacity="0.55"/>
  <polygon points="0,700 260,470 470,700" fill="#0b0f14" opacity="0.85"/>
  <polygon points="330,700 610,430 900,700" fill="#12181f" opacity="0.9"/>
  <polygon points="700,700 960,500 1200,700" fill="#0b0f14" opacity="0.85"/>
  <rect y="700" width="1200" height="200" fill="#05070b" opacity="0.9"/>
  <text x="60" y="800" font-family="sans-serif" font-size="54" font-weight="700" fill="#c9ff4b">${label}</text>
  <text x="60" y="855" font-family="sans-serif" font-size="34" fill="#8a97a8">foto do treino · MUV</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

const PHOTOS = [
  ["Nascer do sol no parque", "#ff9a3d", "#3b2a5a"],
  ["Grupo acelerando na reta", "#59b7ff", "#0b1f33"],
  ["Cume depois de 800 m de subida", "#c9ff4b", "#14331c"],
  ["Trilha de terra batida", "#8ce99a", "#1d2a1f"],
  ["Pelotão no Rio Pinheiros", "#ffd43b", "#2b2a12"],
  ["Fim de treino, sorriso garantido", "#ff8fa3", "#3a1b24"],
];

function quoteValue(value, index) {
  if (index === 6 && value === null) return "null";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  await client.connect();
  await client.query(`truncate table reward_redemptions, rewards, territory_claims, territories, segment_efforts, segments,
    personal_records, user_achievements, achievements, challenge_participants, challenges, comments, kudos, activity_photos,
    activities, follows, sessions, users restart identity cascade`);

  // Catálogo de conquistas
  const achValues = ACHIEVEMENTS.map((row) => `(${row.map(quoteValue).join(",")})`);
  await client.query(`insert into achievements (${COLUMNS.join(",")}) values ${achValues.join(",")}`);

  // Atletas
  const userIds = {};
  for (const [i, u] of USERS.entries()) {
    const res = await client.query(
      `insert into users (username, name, email, password_hash, bio, city, avatar_color, weight_kg, sex, auto_pause, xp, coins)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,0,120) returning id`,
      [u.username, u.name, u.email, hashPassword("muv1234"), u.bio, u.city, u.color, u.weight, u.sex],
    );
    userIds[u.username] = res.rows[0].id;
    void i;
  }
  await client.query(`insert into follows (follower_id, following_id) values ($1,$2),($2,$1),($1,$3),($3,$1),($2,$3),($3,$2)`, [
    userIds.ana,
    userIds.bruno,
    userIds.carla,
  ]);

  // Territórios, desafios, recompensas e segmentos
  const territoryIds = [];
  for (const t of TERRITORIES) {
    const res = await client.query(
      `insert into territories (name, region, description, emoji, center_lat, center_lng, radius_m, xp_reward, coins_reward)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      t,
    );
    territoryIds.push(res.rows[0].id);
  }
  const challengeIds = [];
  for (const [name, description, sport, metric, target, unit, emoji, days] of CHALLENGES) {
    const res = await client.query(
      `insert into challenges (name, description, sport, metric, target, unit, emoji, start_at, end_at, is_public)
       values ($1,$2,$3,$4,$5,$6,$7, now() - interval '7 days', now() + ($8 || ' days')::interval, true) returning id`,
      [name, description, sport, metric, target, unit, emoji, String(days)],
    );
    challengeIds.push(res.rows[0].id);
  }
  for (const r of REWARDS) {
    await client.query(
      `insert into rewards (name, description, category, emoji, cost, partner, stock) values ($1,$2,$3,$4,$5,$6,$7)`,
      r,
    );
  }
  const segmentIds = [];
  for (const [name, description, sport, city, distanceM, grade, startLat, startLng, endLat, endLng] of SEGMENTS) {
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;
    const path = [];
    const steps = 60;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      path.push({
        t: i * 1000,
        lat: startLat + (endLat - startLat) * t + Math.sin(t * Math.PI * 3) * 0.0004,
        lng: startLng + (endLng - startLng) * t + Math.cos(t * Math.PI * 3) * 0.0004,
        alt: 600 + Math.sin(t * Math.PI * 2) * 30,
      });
    }
    void midLat;
    void midLng;
    const res = await client.query(
      `insert into segments (name, description, sport, city, distance_m, avg_grade_pct, start_lat, start_lng, end_lat, end_lng, path)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [name, description, sport, city, distanceM, grade, startLat, startLng, endLat, endLng, JSON.stringify(path)],
    );
    segmentIds.push({ id: res.rows[0].id, sport, distanceM });
  }

  // Atividades com trilhas GPS reais na cidade
  const plans = [
    { user: "ana", sport: "ride", name: "Pedal madrugador no Ibirapuera", location: "Parque Ibirapuera, São Paulo", center: TERRITORIES[0], distanceM: 28400, speedKmh: 27.4, dayOffset: 1, hour: 6, seed: 0.4, photos: [0, 1] },
    { user: "ana", sport: "ride", name: "Treino de subidas no Rio Pinheiros", location: "Rio Pinheiros, São Paulo", center: { lat: -23.566, lng: -46.698 }, distanceM: 41200, speedKmh: 29.8, dayOffset: 4, hour: 6, seed: 1.2, photos: [4] },
    { user: "ana", sport: "run", name: "Tiros no campus da USP", location: "USP, São Paulo", center: TERRITORIES[3], distanceM: 10450, speedKmh: 12.2, dayOffset: 6, hour: 7, seed: 2.1, photos: [2] },
    { user: "ana", sport: "ride", name: "Pedal urbano até a Paulista", location: "Av. Paulista, São Paulo", center: TERRITORIES[6], distanceM: 18600, speedKmh: 22.5, dayOffset: 9, hour: 22, seed: 3.3, photos: [] },
    { user: "bruno", sport: "run_trail", name: "Trail na Serra da Cantareira", location: "Serra da Cantareira, São Paulo", center: TERRITORIES[5], distanceM: 15300, speedKmh: 9.4, dayOffset: 2, hour: 7, seed: 1.7, photos: [3, 2] },
    { user: "bruno", sport: "mtb", name: "MTB na Represa Billings", location: "Represa Billings, São Bernardo", center: TERRITORIES[4], distanceM: 34700, speedKmh: 18.6, dayOffset: 5, hour: 8, seed: 2.4, photos: [1] },
    { user: "bruno", sport: "run", name: "Longão de domingo", location: "Parque Villa-Lobos, São Paulo", center: TERRITORIES[2], distanceM: 21600, speedKmh: 11.4, dayOffset: 12, hour: 7, seed: 4.1, photos: [] },
    { user: "bruno", sport: "hike", name: "Caminhada no Parque do Carmo", location: "Parque do Carmo, São Paulo", center: TERRITORIES[1], distanceM: 9800, speedKmh: 5.4, dayOffset: 14, hour: 9, seed: 5.2, photos: [5] },
    { user: "carla", sport: "walk", name: "Caminhada de manhã no Carmo", location: "Parque do Carmo, São Paulo", center: TERRITORIES[1], distanceM: 7400, speedKmh: 5.2, dayOffset: 1, hour: 8, seed: 0.9, photos: [0, 5] },
    { user: "carla", sport: "walk_rec", name: "Passeio no Boqueirão", location: "Praia do Boqueirão, São Vicente", center: TERRITORIES[7], distanceM: 11200, speedKmh: 5.6, dayOffset: 3, hour: 10, seed: 1.5, photos: [4] },
    { user: "carla", sport: "walk_long", name: "Caminhada longa Pinheiros", location: "Rio Pinheiros, São Paulo", center: { lat: -23.569, lng: -46.695 }, distanceM: 16400, speedKmh: 5.8, dayOffset: 7, hour: 7, seed: 2.8, photos: [3] },
    { user: "carla", sport: "hike", name: "Trilha leve na Cantareira", location: "Serra da Cantareira, São Paulo", center: TERRITORIES[5], distanceM: 8600, speedKmh: 4.8, dayOffset: 11, hour: 8, seed: 3.6, photos: [2] },
    { user: "ana", sport: "run", name: "Rodagem leve no Ibirapuera", location: "Parque Ibirapuera, São Paulo", center: TERRITORIES[0], distanceM: 8200, speedKmh: 10.6, dayOffset: 15, hour: 6, seed: 6.1, photos: [] },
    { user: "bruno", sport: "gravel", name: "Gravel no interior da Billings", location: "Represa Billings, São Bernardo", center: TERRITORIES[4], distanceM: 52300, speedKmh: 24.1, dayOffset: 16, hour: 7, seed: 7.4, photos: [1, 3] },
    { user: "carla", sport: "walk", name: "Caminhada noturna na Paulista", location: "Av. Paulista, São Paulo", center: TERRITORIES[6], distanceM: 6100, speedKmh: 5.0, dayOffset: 17, hour: 21, seed: 8.2, photos: [] },
  ];

  const activityIds = [];
  for (const plan of plans) {
    const start = new Date(Date.now() - plan.dayOffset * 86400000);
    start.setHours(plan.hour, 12, 0, 0);
    const startTime = start.getTime();
    const center = Array.isArray(plan.center) ? { lat: plan.center[4], lng: plan.center[5] } : plan.center;
    const track = buildTrack({ center, distanceM: plan.distanceM, speedKmh: plan.speedKmh, startTime, seed: plan.seed });
    const pauses = plan.sport.startsWith("ride") ? 2 : 1;
    const movingSec = Math.round(track.length * 3);
    const elapsedSec = movingSec + pauses * 95;
    const stats = trackStats(track, movingSec, plan.sport, USERS.find((u) => u.username === plan.user).weight);
    const res = await client.query(
      `insert into activities (user_id, sport, name, notes, location, started_at, ended_at, elapsed_sec, moving_sec, distance_m,
        avg_speed_kmh, max_speed_kmh, pace_sec_per_km, elev_gain_m, elev_loss_m, max_elev_m, calories, pauses, auto_pauses,
        gps_points, avg_accuracy_m, device, is_indoor, visibility, status, track)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,false,'public','published',$23)
       returning id`,
      [
        userIds[plan.user],
        plan.sport,
        plan.name,
        `${plan.location} — trajeto gravado com GPS do celular, média de ${stats.avgSpeed} km/h.`,
        plan.location,
        new Date(startTime),
        new Date(startTime + elapsedSec * 1000),
        elapsedSec,
        movingSec,
        stats.distance,
        stats.avgSpeed,
        stats.maxSpeed,
        stats.pace,
        stats.gain,
        stats.loss,
        Math.max(...track.map((p) => p.alt)),
        stats.calories,
        pauses,
        plan.sport.startsWith("ride") ? 3 : 1,
        track.length,
        stats.accuracy,
        "GPS do dispositivo (alta precisão)",
        JSON.stringify(track),
      ],
    );
    activityIds.push({ id: res.rows[0].id, user: plan.user, sport: plan.sport, distance: stats.distance, gain: stats.gain, movingSec, photos: plan.photos, track });
  }

  // Fotos das atividades
  let photoCount = 0;
  for (const activity of activityIds) {
    for (const [position, index] of activity.photos.entries()) {
      const [caption, colorA, colorB] = PHOTOS[index];
      await client.query(
        `insert into activity_photos (activity_id, user_id, mime_type, data, width, height, caption, position)
         values ($1,$2,'image/svg+xml',$3,1200,900,$4,$5)`,
        [activity.id, userIds[activity.user], photoSvg(caption, colorA, colorB), caption, position],
      );
      photoCount += 1;
    }
  }

  // Kudos e comentários
  const authors = Object.keys(userIds);
  for (const [i, activity] of activityIds.entries()) {
    for (const username of authors) {
      if (username === activity.user) continue;
      if ((i + username.length) % 2 === 0) {
        await client.query(`insert into kudos (activity_id, user_id) values ($1,$2)`, [activity.id, userIds[username]]);
      }
    }
    if (i % 3 === 0) {
      const commenter = authors.find((a) => a !== activity.user);
      await client.query(`insert into comments (activity_id, user_id, body) values ($1,$2,$3)`, [
        activity.id,
        userIds[commenter],
        "Que treino forte! Vou marcar esse trajeto para repetir no fim de semana.",
      ]);
    }
  }

  // Territórios dominados a partir das trilhas
  const claimsByUser = {};
  for (const activity of activityIds) {
    for (const [idx, t] of TERRITORIES.entries()) {
      const [name, , , emoji, lat, lng, radius] = t;
      let inside = 0;
      for (let i = 1; i < activity.track.length; i += 1) {
        const a = activity.track[i - 1];
        const b = activity.track[i];
        const midLat = (a.lat + b.lat) / 2;
        const midLng = (a.lng + b.lng) / 2;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(midLat - lat);
        const dLng = toRad(midLng - lng);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(midLat)) * Math.sin(dLng / 2) ** 2;
        if (2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h))) <= radius) {
          inside += 3;
        }
      }
      if (inside >= 250) {
        const exists = await client.query(`select 1 from territory_claims where territory_id = $1 and user_id = $2`, [
          territoryIds[idx],
          userIds[activity.user],
        ]);
        if (exists.rowCount === 0) {
          await client.query(
            `insert into territory_claims (territory_id, user_id, activity_id, distance_inside_m) values ($1,$2,$3,$4)`,
            [territoryIds[idx], userIds[activity.user], activity.id, inside],
          );
          claimsByUser[activity.user] = (claimsByUser[activity.user] ?? 0) + 1;
        } else {
          await client.query(`update territory_claims set distance_inside_m = greatest(distance_inside_m, $3) where territory_id = $1 and user_id = $2`, [
            territoryIds[idx],
            userIds[activity.user],
            inside,
          ]);
        }
        void name;
        void emoji;
      }
    }
  }

  // Participações em desafios com progresso real
  for (const [idx, challengeId] of challengeIds.entries()) {
    const sport = CHALLENGES[idx][2];
    const metric = CHALLENGES[idx][3];
    const target = CHALLENGES[idx][4];
    const participants = [authors[idx % 3], authors[(idx + 1) % 3]];
    for (const username of participants) {
      const mine = activityIds.filter((a) => a.user === username && (!sport || a.sport === sport));
      let progress = 0;
      if (metric === "distance_m") progress = mine.reduce((s, a) => s + a.distance, 0);
      else if (metric === "elev_gain_m") progress = mine.reduce((s, a) => s + a.gain, 0);
      else if (metric === "moving_sec") progress = mine.reduce((s, a) => s + a.movingSec, 0);
      else progress = mine.length;
      await client.query(
        `insert into challenge_participants (challenge_id, user_id, progress, completed_at) values ($1,$2,$3,$4)`,
        [challengeId, userIds[username], progress, progress >= target ? new Date() : null],
      );
    }
  }

  // Segmentos: esforços dos pedais/corridas compatíveis
  const effortsByUser = {};
  for (const segment of segmentIds) {
    const candidates = activityIds.filter((a) => a.sport === segment.sport);
    for (const [i, activity] of candidates.entries()) {
      const track = activity.track;
      if (track.length < 10) continue;
      const elapsed = Math.max(60, Math.round(activity.movingSec * (0.12 + 0.02 * i)));
      const avgSpeed = Number((segment.distanceM / 1000 / (elapsed / 3600)).toFixed(2));
      await client.query(
        `insert into segment_efforts (segment_id, activity_id, user_id, elapsed_sec, avg_speed_kmh) values ($1,$2,$3,$4,$5)`,
        [segment.id, activity.id, userIds[activity.user], elapsed, avgSpeed],
      );
      effortsByUser[activity.user] = (effortsByUser[activity.user] ?? 0) + 1;
    }
  }
  const crOwner = Object.entries(effortsByUser).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ana";

  // Recordes pessoais por modalidade
  const prs = [];
  for (const username of authors) {
    const mine = activityIds.filter((a) => a.user === username);
    for (const sport of Array.from(new Set(mine.map((a) => a.sport)))) {
      const list = mine.filter((a) => a.sport === sport);
      const longest = list.reduce((best, a) => (a.distance > best.distance ? a : best), list[0]);
      const climb = list.reduce((best, a) => (a.gain > best.gain ? a : best), list[0]);
      prs.push([userIds[username], sport, "longest_distance_m", `Maior distância · ${sport}`, longest.distance, "m"]);
      prs.push([userIds[username], sport, "biggest_climb_m", "Maior ganho de elevação", climb.gain, "m"]);
    }
  }
  for (const [userId, sport, category, label, value, unit] of prs) {
    await client.query(
      `insert into personal_records (user_id, sport, category, label, value, unit, activity_id) values ($1,$2,$3,$4,$5,$6,null)`,
      [userId, sport, category, label, value, unit],
    );
  }

  // Conquistas desbloqueadas a partir dos dados dos atletas
  const unlocked = {};
  for (const username of authors) {
    const uid = userIds[username];
    const mine = activityIds.filter((a) => a.user === username);
    const ctx = {
      activities: mine.length,
      photos: mine.reduce((s, a) => s + a.photos.length, 0),
      territories: claimsByUser[username] ?? 0,
      kudos: 0,
      streak: 0,
      elev: mine.reduce((s, a) => s + a.gain, 0),
      sportDistance: {},
      longest: {},
      early: mine.filter((a) => new Date(a.track[0].t).getHours() < 6).length,
      night: mine.filter((a) => new Date(a.track[0].t).getHours() >= 22).length,
      weekend: mine.filter((a) => [0, 6].includes(new Date(a.track[0].t).getDay())).length,
      challenges: 1,
      segmentCrs: username === crOwner ? 1 : 0,
    };
    for (const a of mine) {
      const group = a.sport.startsWith("ride") || a.sport === "mtb" || a.sport === "gravel" ? "ride" : a.sport.startsWith("walk") || a.sport === "hike" ? "walk" : "run";
      ctx.sportDistance[group] = (ctx.sportDistance[group] ?? 0) + a.distance;
      ctx.sportDistance[a.sport] = (ctx.sportDistance[a.sport] ?? 0) + a.distance;
      ctx.longest[a.sport] = Math.max(ctx.longest[a.sport] ?? 0, a.distance);
      if (group === "run") ctx.longest.run = Math.max(ctx.longest.run ?? 0, a.distance);
      if (group === "ride") ctx.longest.ride = Math.max(ctx.longest.ride ?? 0, a.distance);
    }
    const kudosRes = await client.query(
      `select count(*)::int as n from kudos k join activities a on a.id = k.activity_id where a.user_id = $1`,
      [uid],
    );
    ctx.kudos = kudosRes.rows[0].n;

    let xp = 0;
    let coins = 0;
    for (const row of ACHIEVEMENTS) {
      const [key, , , , , metric, sport, threshold, , tier, xpReward, coinsReward] = row;
      let value = 0;
      if (metric === "activities") value = ctx.activities;
      else if (metric === "longest_run_m") value = ctx.longest.run ?? 0;
      else if (metric === "longest_ride_m") value = ctx.longest.ride ?? 0;
      else if (metric === "sport_distance_m") value = ctx.sportDistance[sport] ?? 0;
      else if (metric === "sport_elev_m") value = ctx.elev;
      else if (metric === "longest_sport_m") value = ctx.longest[sport] ?? 0;
      else if (metric === "elev_total_m") value = ctx.elev;
      else if (metric === "streak") value = ctx.streak;
      else if (metric === "photos") value = ctx.photos;
      else if (metric === "territories") value = ctx.territories;
      else if (metric === "kudos_received") value = ctx.kudos;
      else if (metric === "segment_crs") value = ctx.segmentCrs;
      else if (metric === "challenges_completed") value = ctx.challenges;
      else if (metric === "early_activity") value = ctx.early;
      else if (metric === "night_activity") value = ctx.night;
      else if (metric === "weekend_activities") value = ctx.weekend;
      if (value >= threshold) {
        await client.query(
          `insert into user_achievements (user_id, achievement_key, progress, activity_id) values ($1,$2,$3,null) on conflict do nothing`,
          [uid, key, threshold],
        );
        xp += xpReward;
        coins += coinsReward;
        unlocked[username] = (unlocked[username] ?? 0) + 1;
      }
    }
    const activityXp = Math.round(mine.reduce((s, a) => s + (a.distance / 1000) * 12 + a.gain * 0.6, 0) + 200);
    const territoryXp = (claimsByUser[username] ?? 0) * 250;
    await client.query(`update users set xp = $2, coins = $3 where id = $1`, [uid, xp + activityXp + territoryXp, coins + 120 + Math.round((activityXp + territoryXp) / 10)]);
  }

  const counts = await client.query(
    `select (select count(*) from users) users, (select count(*) from activities) activities,
            (select count(*) from activity_photos) photos, (select count(*) from territories) territories,
            (select count(*) from challenges) challenges, (select count(*) from segments) segments,
            (select count(*) from user_achievements) achievements`,
  );
  console.log("Seed concluído:", counts.rows[0], "conquistas por atleta:", unlocked);
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  await client.end().catch(() => {});
  process.exit(1);
});
