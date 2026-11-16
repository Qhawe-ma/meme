/**
 * Fills the rank with coins, trades and candle history through the real API,
 * so the ledger stays balanced. Needs the app on APP_URL and DATABASE_URL.
 */
import sharp from "sharp";
import postgres from "postgres";

const base = process.env.APP_URL || "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { max: 4, types: { bigint: postgres.BigInt } });

const coins = [
  ["KOEKS", "Koeksister", "Sticky, twisted, gone by lunch."],
  ["BRAAI", "Braai Season", "Saturday fire. No cash value."],
  ["TAXI", "Taxi Rank", "The destination board, but for jokes."],
  ["VETKOEK", "Vetkoek", "Fried dough energy."],
  ["GATSBY", "Gatsby", "A Cape Town loaf, overstuffed."],
  ["SHISA", "Shisa Nyama", "Smoke, salt, a queue."],
  ["KOPPIE", "The Koppie", "Whoever is on top of the rank."],
  ["NOWNOW", "Now Now", "It means soon. Or not."],
  ["LEKKER", "Lekker", "The only review that matters."],
  ["EISH", "Eish", "Said when the candle dumps."],
  ["SHARP", "Sharp Sharp", "We good. See you."],
  ["ZOLO", "Zol", "A small one, passed around."],
  ["AMANDLA", "Amandla", "Power, shouted, not sold."],
  ["DURBAN", "Durban Heat", "Curry so hot the chart sweats."],
  ["JOZI", "Jozi", "City of gold, fake rand."],
  ["SOWETO", "Soweto", "The township that made the weekend."],
  ["PAP", "Pap en Vleis", "The plate, not the portfolio."],
  ["CHILLI", "Chilli Bites", "Snack-sized volatility."],
  ["ROBOT", "Robot", "The traffic light. Green means go."],
  ["SKOP", "Skop", "A kick. Sometimes deserved."],
  ["BILTONG", "Biltong", "Dried, salty, lasts."],
  ["SAMP", "Samp", "Slow cooked. Still here."],
];

const palettes = [
  ["#ffe14a", "#1a1408", "#c6f135"],
  ["#ff4b2b", "#140c0a", "#f4f1e6"],
  ["#c6f135", "#10140c", "#0e0f0c"],
  ["#f4f1e6", "#2a2118", "#ffe14a"],
  ["#7d9a3a", "#10140c", "#ffe14a"],
  ["#e8d7b0", "#3a2418", "#ff4b2b"],
];

function art(name, i) {
  const [a, b, c] = palettes[i % palettes.length];
  const kind = i % 4;
  const motif =
    kind === 0
      ? `<rect x="0" y="0" width="320" height="320" fill="${b}"/><rect x="0" y="0" width="28" height="320" fill="${a}"/><circle cx="210" cy="120" r="70" fill="${c}"/>`
      : kind === 1
        ? `<rect width="320" height="320" fill="${b}"/>${Array.from({ length: 8 }, (_, n) => `<rect x="${n * 40}" y="0" width="16" height="320" fill="${n % 2 ? a : c}"/>`).join("")}`
        : kind === 2
          ? `<rect width="320" height="320" fill="${b}"/><polygon points="40,280 160,30 280,280" fill="${a}"/><rect x="130" y="180" width="60" height="100" fill="${c}"/>`
          : `<rect width="320" height="320" fill="${b}"/><circle cx="160" cy="160" r="110" fill="none" stroke="${a}" stroke-width="18"/><circle cx="160" cy="160" r="40" fill="${c}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">${motif}<text x="24" y="300" font-family="Arial Narrow, Impact, sans-serif" font-size="42" fill="${a}">${name}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function jar(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return raw.map((line) => line.split(";")[0]).join("; ");
}

async function signup(email, handle) {
  const res = await fetch(`${base}/api/auth/sign-up`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      handle,
      displayName: handle,
      dateOfBirth: "1992-04-04",
      acceptTerms: true,
    }),
  });
  if (!res.ok && res.status !== 409) throw new Error(`signup ${handle} ${res.status} ${await res.text()}`);
  let body = "";
  for (let i = 0; i < 20; i += 1) {
    const [row] = await sql`SELECT body FROM email_messages WHERE to_email = ${email} ORDER BY id DESC LIMIT 1`;
    body = row?.body ?? "";
    if (body.includes("token=")) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  const link = body.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no mail for ${email}`);
  const verify = await fetch(link, { redirect: "manual" });
  return jar(verify);
}

async function launch(cookie, coin, index) {
  const [existing] = await sql`SELECT 1 FROM coins WHERE ticker = ${coin[0]}`;
  if (existing) return false;
  const png = await art(coin[0], index);
  const form = new FormData();
  form.set("name", coin[1]);
  form.set("ticker", coin[0]);
  form.set("description", coin[2]);
  form.set("file", new Blob([png], { type: "image/png" }), "coin.png");
  const res = await fetch(`${base}/api/coins`, { method: "POST", headers: { cookie }, body: form });
  if (!res.ok) throw new Error(`launch ${coin[0]} ${res.status} ${await res.text()}`);
  return true;
}

async function trade(cookie, ticker, side, amountUfr) {
  const res = await fetch(`${base}/api/trades`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(
      side === "buy"
        ? { ticker, side, amountUfr: String(amountUfr), minSharesOut: "1" }
        : { ticker, side, shares: "all", minPayoutUfr: "1" },
    ),
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("MAX_POSITION") || text.includes("INSUFFICIENT") || text.includes("too small")) return;
    throw new Error(`trade ${ticker} ${res.status} ${text}`);
  }
}

async function paintCandles() {
  const rows = await sql`SELECT id, price_ufr_per_1m FROM coins WHERE status = 'live'`;
  for (const coin of rows) {
    const price = Number(coin.price_ufr_per_1m);
    let cursor = price;
    const now = Date.now();
    for (let i = 72; i >= 0; i -= 1) {
      const drift = 1 + (Math.sin(i / 5) * 0.012 + ((i * 17) % 7) / 700 - 0.008);
      const open = Math.max(1, Math.round(cursor / drift));
      const close = i === 0 ? price : Math.max(1, Math.round(cursor));
      const high = Math.max(open, close) + Math.round(price * 0.004);
      const low = Math.min(open, close) - Math.round(price * 0.003);
      const bucket = new Date(now - i * 5 * 60 * 1000);
      bucket.setUTCSeconds(0, 0);
      bucket.setUTCMinutes(Math.floor(bucket.getUTCMinutes() / 5) * 5);
      const vol = BigInt(2_000_000 + ((i * 13) % 9) * 1_000_000);
      await sql`
        INSERT INTO candles (coin_id, interval, bucket_start, open, high, low, close, volume_ufr, buy_volume_ufr, sell_volume_ufr, trades, first_seq, last_seq)
        VALUES (${coin.id}, '5m', ${bucket}, ${BigInt(open)}, ${BigInt(high)}, ${BigInt(low)}, ${BigInt(close)}, ${vol}, ${vol / 2n}, ${vol / 2n}, 3, 1, 1)
        ON CONFLICT (coin_id, interval, bucket_start) DO NOTHING
      `;
      cursor = open;
    }
  }
}

const stamp = Date.now().toString().slice(-6);
const creators = [];
for (let i = 0; i < 8; i += 1) {
  const handle = `rank${stamp}${i}`;
  creators.push(await signup(`${handle}@example.com`, handle));
  process.stdout.write(`creator ${i + 1} `);
}
const traders = [];
for (let i = 0; i < 4; i += 1) {
  const handle = `buy${stamp}${i}`;
  traders.push(await signup(`${handle}@example.com`, handle));
}
console.log("\naccounts ready");

for (let i = 0; i < coins.length; i += 1) {
  await launch(creators[i % creators.length], coins[i], i);
  process.stdout.write(`${coins[i][0]} `);
}
console.log("\nlaunched");

for (let i = 0; i < coins.length; i += 1) {
  const ticker = coins[i][0];
  const buyer = traders[i % traders.length];
  const gross = BigInt(4 + (i % 5) * 3) * 1_000_000n;
  await trade(buyer, ticker, "buy", gross);
  if (i % 3 === 0) await trade(buyer, ticker, "sell");
  if (i % 4 === 0) await trade(traders[(i + 1) % traders.length], ticker, "buy", 2_000_000n);
}
console.log("traded");
await paintCandles();
console.log("candles painted");
await sql.end();
