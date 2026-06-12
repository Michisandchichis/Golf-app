export type Tee = {
  name: string;
  rating: number;
  slope: number;
  yards: number[];
};

export type PresetCourse = {
  name: string;
  holes: number;
  tees: Tee[];
  pars: number[];
  handicaps: number[];
};

export const PRESET_COURSES: PresetCourse[] = [
  {
    name: 'Valley Oaks - Valley Course',
    holes: 9,
    tees: [
      { name: 'Blue', rating: 70.8, slope: 125, yards: [476, 374, 361, 396, 168, 354, 209, 402, 490] },
      { name: 'White', rating: 69.1, slope: 121, yards: [468, 359, 335, 386, 152, 341, 200, 389, 482] },
    ],
    pars: [5, 4, 4, 4, 3, 4, 3, 4, 5],
    handicaps: [8, 4, 5, 1, 7, 6, 2, 3, 9],

  },
  {
    name: 'Valley Oaks - Oaks Course',
    holes: 9,
    tees: [
      { name: 'Blue', rating: 70.8, slope: 125, yards: [369, 376, 517, 509, 151, 381, 385, 204, 432] },
      { name: 'White', rating: 69.0, slope: 122, yards: [351, 331, 492, 501, 140, 369, 385, 189, 408] },
    ],
    pars: [4, 4, 5, 5, 3, 4, 4, 3, 4],
    handicaps: [5, 3, 7, 6, 9, 8, 4, 1, 2],
  },
  {
    name: 'Valley Oaks - Lakes Course',
    holes: 9,
    tees: [
      { name: 'Blue', rating: 70.2, slope: 122, yards: [372, 480, 333, 185, 366, 362, 169, 429, 545] },
      { name: 'White', rating: 68.5, slope: 118, yards: [359, 472, 312, 167, 358, 341, 159, 413, 516] },
    ],
    pars: [4, 5, 4, 3, 4, 4, 3, 4, 5],
    handicaps: [8, 9, 7, 4, 6, 2, 5, 1, 3],
  },
];

export function searchCourses(query: string): PresetCourse[] {
  if (query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return PRESET_COURSES.filter((c) => c.name.toLowerCase().includes(q));
}
