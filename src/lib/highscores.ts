export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  distance: number;
  chapter: number;
  hearts: number;
  date: number;
}

const KEY = "anjali-run-scores-v1";
const NAME_KEY = "anjali-run-name-v1";
const MUTE_KEY = "anjali-run-muted-v1";
export const MAX_ENTRIES = 8;

function safeParse(raw: string | null): ScoreEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((d): d is ScoreEntry => !!d && typeof d.score === "number")
      .map((d) => ({
        id: String(d.id ?? Math.random().toString(36).slice(2)),
        name: String(d.name ?? "Runner").slice(0, 14),
        score: Math.max(0, Math.floor(d.score)),
        distance: Math.max(0, Math.floor(d.distance ?? 0)),
        chapter: Math.max(1, Math.floor(d.chapter ?? 1)),
        hearts: Math.max(0, Math.floor(d.hearts ?? 0)),
        date: Number(d.date ?? Date.now()),
      }));
  } catch {
    return [];
  }
}

export function loadScores(): ScoreEntry[] {
  try {
    return safeParse(localStorage.getItem(KEY)).sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function persist(list: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable */
  }
}

export function addScore(entry: Omit<ScoreEntry, "id" | "date">): { list: ScoreEntry[]; id: string; rank: number } {
  const id = Math.random().toString(36).slice(2);
  const full: ScoreEntry = { ...entry, id, date: Date.now() };
  const list = [...loadScores(), full].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  persist(list);
  const rank = list.findIndex((e) => e.id === id);
  return { list, id, rank };
}

export function renameScore(id: string, name: string): ScoreEntry[] {
  const list = loadScores().map((e) => (e.id === id ? { ...e, name: name.slice(0, 14) || "Runner" } : e));
  persist(list);
  return list;
}

export function clearScores(): ScoreEntry[] {
  persist([]);
  return [];
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, 14));
  } catch {
    /* ignore */
  }
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function bestOf(list: ScoreEntry[]): number {
  return list.length ? list[0].score : 0;
}
