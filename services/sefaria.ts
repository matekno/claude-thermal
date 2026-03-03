import type { Pasuk } from "../handlers/types.ts";

// Pirkei Avot chapter → max verse count
const PIRKEI_AVOT_CHAPTERS: Record<number, number> = {
  1: 18,
  2: 16,
  3: 18,
  4: 20,
  5: 23,
  6: 11,
};

let kv: Deno.Kv | null = null;
async function getKv(): Promise<Deno.Kv> {
  if (!kv) kv = await Deno.openKv();
  return kv;
}

// Returns a random Pirkei Avot pasuk, with KV caching to avoid hammering Sefaria
export async function getRandomPasuk(): Promise<Pasuk> {
  const chapter = randomInt(1, 6);
  const maxVerse = PIRKEI_AVOT_CHAPTERS[chapter];
  const verse = randomInt(1, maxVerse);

  const cacheKey = ["sefaria", "avot", chapter, verse];

  try {
    const db = await getKv();
    const cached = await db.get<Pasuk>(cacheKey);
    if (cached.value) return cached.value;

    const pasuk = await fetchFromSefaria(chapter, verse);

    // Cache for 7 days
    await db.set(cacheKey, pasuk, { expireIn: 7 * 24 * 60 * 60 * 1000 });
    return pasuk;
  } catch (_err) {
    // Fallback: try fetching without cache on KV error
    try {
      return await fetchFromSefaria(chapter, verse);
    } catch {
      return fallbackPasuk();
    }
  }
}

async function fetchFromSefaria(chapter: number, verse: number): Promise<Pasuk> {
  const url = `https://www.sefaria.org/api/texts/Pirkei_Avot.${chapter}.${verse}?lang=en&context=0`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Sefaria API error: ${res.status}`);

  const data = await res.json();

  // Sefaria returns `text` as string or string[] depending on the text
  let text: string;
  if (Array.isArray(data.text)) {
    text = data.text.join(" ");
  } else {
    text = data.text ?? "";
  }

  // Strip HTML tags from Sefaria response
  text = text.replace(/<[^>]+>/g, "").trim();

  // Truncate at word boundary to max 140 chars
  text = truncateAtWord(text, 140);

  return {
    text,
    ref: `Avot ${chapter}:${verse}`,
    chapter,
    verse,
  };
}

function fallbackPasuk(): Pasuk {
  const fallbacks = [
    { text: "Be deliberate in judgment, raise up many disciples, and make a fence for the Torah.", ref: "Avot 1:1", chapter: 1, verse: 1 },
    { text: "In a place where there are no people, strive to be a person.", ref: "Avot 2:5", chapter: 2, verse: 5 },
    { text: "Who is wise? One who learns from every person.", ref: "Avot 4:1", chapter: 4, verse: 1 },
    { text: "Do not judge your fellow until you have reached their place.", ref: "Avot 2:4", chapter: 2, verse: 4 },
    { text: "Say little and do much, and receive every person with a pleasant countenance.", ref: "Avot 1:15", chapter: 1, verse: 15 },
  ];
  return fallbacks[randomInt(0, fallbacks.length - 1)];
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.lastIndexOf(" ", maxLen);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, maxLen)) + "...";
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
