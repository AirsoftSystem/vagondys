export interface CibleStats {
  total: number;
  timeouts: number;
  perZone: Record<number, number>;
}

export interface ZoneColor {
  bg: string;
  text: string;
  border: string;
}

export const ZONE_COLORS: Record<number, ZoneColor> = {
  [-1]: { bg: 'bg-zinc-700', text: 'text-zinc-300', border: 'border-zinc-600' }, // timeout
  [0]: { bg: 'bg-black', text: 'text-white', border: 'border-zinc-800' },
  [5]: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
  [10]: { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-600' },
  [15]: { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600' },
  [25]: { bg: 'bg-blue-300', text: 'text-black', border: 'border-blue-400' },
  [50]: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
  [100]: { bg: 'bg-cyan-500', text: 'text-white', border: 'border-cyan-600' },
  [150]: { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600' },
  [200]: { bg: 'bg-cyan-400', text: 'text-black', border: 'border-cyan-500' },
  [250]: { bg: 'bg-purple-700', text: 'text-white', border: 'border-purple-800' },
};

export const POINTS_CIBLE_1: number[] = [250, 200, 150, 100, 0];
export const POINTS_CIBLES: number[] = [50, 25, 15, 10, 5, 0];
