export type Tee = {
  name: string;
  rating: number;
  slope: number;
};

export type PresetCourse = {
  name: string;
  holes: number;
  tees: Tee[];
  pars: number[];
};

export const PRESET_COURSES: PresetCourse[] = [
  {
    name: 'Valley Oaks - Valley Course',
    holes: 9,
    tees: [
      { name: 'Blue', rating: 70.8, slope: 125 },
      { name: 'White', rating: 69.1, slope: 121 },
    ],
    pars: [5, 4, 4, 4, 3, 4, 3, 4, 5],
  },
  {
    name: 'Valley Oaks - Oaks Course',
    holes: 9,
    tees: [
      { name: 'Blue', rating: 70.8, slope: 125 },
      { name: 'White', rating: 69.0, slope: 122 },
    ],
    pars: [4, 4, 5, 5, 3, 4, 4, 3, 4],
  },
  {
    name: 'Valley Oaks - Lakes Course',
    holes: 9,
    tees: [
      { name: 'Blue', rating: 70.2, slope: 122 },
      { name: 'White', rating: 68.5, slope: 118 },
    ],
    pars: [4, 5, 4, 3, 4, 4, 3, 4, 5],
  },
];

export function searchCourses(query: string): PresetCourse[] {
  if (query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return PRESET_COURSES.filter((c) => c.name.toLowerCase().includes(q));
}
