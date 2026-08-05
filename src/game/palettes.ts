export interface Palette {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  orb: string;
  orbGlow: string;
  moon: boolean;
  hillFar: string;
  hillNear: string;
  skyline: string;
  window: string;
  groundTop: string;
  groundBottom: string;
  road: string;
  roadLine: string;
  accent: string;
  petal: string;
  cloud: string;
  starDensity: number;
}

export const PALETTES: Palette[] = [
  {
    name: "Golden Dusk",
    skyTop: "#3f2168",
    skyMid: "#c2477f",
    skyBottom: "#ffb26b",
    orb: "#fff3d0",
    orbGlow: "#ff9a5a",
    moon: false,
    hillFar: "#75418f",
    hillNear: "#4a2467",
    skyline: "#33174e",
    window: "#ffd48a",
    groundTop: "#2a1240",
    groundBottom: "#170925",
    road: "#3a1c54",
    roadLine: "#ffd9a0",
    accent: "#ffcb6b",
    petal: "#ff9ec4",
    cloud: "rgba(255,190,180,0.28)",
    starDensity: 0.25,
  },
  {
    name: "Rose Night",
    skyTop: "#0d0524",
    skyMid: "#3b1361",
    skyBottom: "#a3266e",
    orb: "#fff8e7",
    orbGlow: "#c9a8ff",
    moon: true,
    hillFar: "#3f1c6a",
    hillNear: "#26113f",
    skyline: "#170a2b",
    window: "#ffd166",
    groundTop: "#1b0b32",
    groundBottom: "#0b0320",
    road: "#2a1146",
    roadLine: "#f9c8e0",
    accent: "#c9a8ff",
    petal: "#ffc2dd",
    cloud: "rgba(190,160,255,0.16)",
    starDensity: 1,
  },
  {
    name: "Dawn Bloom",
    skyTop: "#4b3d9e",
    skyMid: "#ff7f9c",
    skyBottom: "#ffd6a0",
    orb: "#fffbe8",
    orbGlow: "#ffb36b",
    moon: false,
    hillFar: "#8a63b5",
    hillNear: "#57397e",
    skyline: "#3d2360",
    window: "#fff0c0",
    groundTop: "#3a2154",
    groundBottom: "#22123a",
    road: "#4a2a63",
    roadLine: "#ffe9c0",
    accent: "#ffd6a0",
    petal: "#fff0f5",
    cloud: "rgba(255,235,225,0.34)",
    starDensity: 0.08,
  },
  {
    name: "Monsoon Neon",
    skyTop: "#04121f",
    skyMid: "#0e5b6e",
    skyBottom: "#ff6f91",
    orb: "#e9fff9",
    orbGlow: "#5ff0d0",
    moon: true,
    hillFar: "#12414f",
    hillNear: "#0a2c38",
    skyline: "#07202b",
    window: "#7ef0d0",
    groundTop: "#0b2430",
    groundBottom: "#04121b",
    road: "#123543",
    roadLine: "#7ef0d0",
    accent: "#7ef0d0",
    petal: "#a8f6e6",
    cloud: "rgba(120,240,220,0.14)",
    starDensity: 0.6,
  },
];

export function paletteFor(chapter: number): Palette {
  return PALETTES[(chapter - 1) % PALETTES.length];
}
