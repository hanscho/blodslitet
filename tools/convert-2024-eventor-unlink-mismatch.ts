const data: { id: number; r: [string, string]; e: [string, string] }[] = [
  {
    id: 4,
    r: ['Aksel', 'Jacobsen'],
    e: ['Jan Kåre', 'Vatne'],
  },

  {
    id: 27335,
    r: ['Anne Mette', 'Schmidt'],
    e: ['Amanda', 'Smith'],
  },

  {
    id: 14,
    r: ['Berthe', 'Teslo'],
    e: ['Øystein Grande', 'Jaren'],
  },
  {
    id: 19044,
    r: ['Dahl Jensen Jeppe', 'Kejser'],
    e: ['Jeff', 'Jensen'],
  },
  {
    id: 6,
    r: ['Elise', 'Hafsfjord'],
    e: ['Ole-Kristian', 'Kaspersen'],
  },
  {
    id: 11,
    r: ['Gøril', 'Skyttersæter'],
    e: ['Dag', 'Aalvik'],
  },
  {
    id: 2159,
    r: ['Jenny', 'Braseth'],
    e: ['Leif', 'Skunberg'],
  },
  {
    id: 11591,
    r: ['Jon', 'Marcussen'],
    e: ['John', 'Morrison'],
  },
  {
    id: 23,
    r: ['Katrine', 'Veggan'],
    e: ['Mette', 'Solbergseter'],
  },
  {
    id: 25379,
    r: ['Kristian', 'Mork'],
    e: ['Kristen', 'Myers'],
  },
  {
    id: 5,
    r: ['Line', 'Bjørnås'],
    e: ['Even-Johan', 'Kaspersen'],
  },
  {
    id: 11593,
    r: ['Lise', 'Marcussen'],
    e: ['Lisa', 'Morrison'],
  },
  {
    id: 12347,
    r: ['Maja', 'Alm'],
    e: ['Monica', 'Alleman'],
  },
  {
    id: 6734,
    r: ['Maria', 'Dahl'],
    e: ['Ria', 'Dalal'],
  },
  {
    id: 8,
    r: ['Morten Roger', 'Andersen'],
    e: ['Einar', 'Tommelstad'],
  },
  {
    id: 1703,
    r: ['Morten', 'Johannessen'],
    e: ['Elisabeth Holth', 'Johannessen'],
  },
  {
    id: 13,
    r: ['Runa', 'Skyttersæter'],
    e: ['Rune', 'Rystad'],
  },
  {
    id: 12,
    r: ['Toini', 'Skyttersæter'],
    e: ['Nicole', 'Ragvin'],
  },
];

// 2024 database names with eventor id that does not match name in eventor
export const eventorUnlinkMismatches = new Map<
  number,
  {
    r: [string, string];
    e: [string, string];
  }
>(data.map((i) => [i.id, { r: i.r, e: i.e }]));
