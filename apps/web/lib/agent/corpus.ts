/** A canned, offline "search index" for the demo agent. Values are in SI-ish base units. */
export interface Doc {
  id: string;
  title: string;
  url: string;
  snippet: string;
  keywords: string[];
  value: number | null;
  unit: string | null;
}

export type ScoredDoc = Doc & { score: number };

const kb = (slug: string) => `https://kb.retrace.dev/${slug}`;

export const CORPUS: Doc[] = [
  { id: "moon", title: "Earth–Moon distance", url: kb("moon-distance"), snippet: "The average distance from Earth to the Moon is about 384,400 km.", keywords: ["moon", "lunar", "distance", "far", "reach"], value: 384_400_000, unit: "m" },
  { id: "marathon", title: "Marathon distance", url: kb("marathon"), snippet: "An official marathon is 42.195 km long.", keywords: ["marathon", "marathons", "race", "run"], value: 42_195, unit: "m" },
  { id: "everest", title: "Mount Everest", url: kb("everest"), snippet: "Mount Everest's summit is 8,849 m above sea level.", keywords: ["everest", "mountain", "tallest", "tall", "height"], value: 8_849, unit: "m" },
  { id: "eiffel", title: "Eiffel Tower", url: kb("eiffel-tower"), snippet: "The Eiffel Tower is about 330 m tall including its antennas.", keywords: ["eiffel", "tower", "towers", "paris", "tall"], value: 330, unit: "m" },
  { id: "light", title: "Speed of light", url: kb("speed-of-light"), snippet: "Light travels at 299,792,458 metres per second in a vacuum.", keywords: ["light", "speed", "seconds"], value: 299_792_458, unit: "m/s" },
  { id: "python", title: "Python (programming language)", url: kb("python"), snippet: "Python was first released by Guido van Rossum in 1991.", keywords: ["python", "programming", "released", "language"], value: 1991, unit: "year" },
  { id: "greatwall", title: "Great Wall of China", url: kb("great-wall"), snippet: "A 2012 survey measured all sections of the Great Wall at about 21,196 km.", keywords: ["great", "wall", "china", "length"], value: 21_196_000, unit: "m" },
  { id: "water", title: "Boiling point of water", url: kb("boiling-point"), snippet: "At sea level, water boils at 100 °C.", keywords: ["water", "boil", "boiling", "temperature"], value: 100, unit: "°C" },
  { id: "genome", title: "Human genome", url: kb("human-genome"), snippet: "The human genome contains roughly 3.1 billion base pairs.", keywords: ["genome", "human", "dna", "base", "pairs"], value: 3_100_000_000, unit: "bp" },
  { id: "pacific", title: "Pacific Ocean", url: kb("pacific"), snippet: "The Pacific Ocean covers about 165 million square kilometres.", keywords: ["pacific", "ocean", "area", "large"], value: 165_000_000, unit: "km²" },
];

export function search(query: string, k = 3): ScoredDoc[] {
  const words = new Set(query.toLowerCase().match(/[a-z]+/g) ?? []);
  return CORPUS.map((d) => ({ ...d, score: d.keywords.filter((w) => words.has(w)).length }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, k);
}
