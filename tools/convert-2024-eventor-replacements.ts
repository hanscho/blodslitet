const data: {
  id: number;
  newId: number;
  r: [string, string];
  eOld: [string, string, string];
  eNew: [string, string, string];
}[] = [
  {
    id: 2990,
    newId: 81191,
    r: ['Roar', 'Fjeldbo'],
    eOld: ['*Roar', 'Fjeldbo', 'Sandefjord OK'],
    eNew: ['Roar', 'Fjeldbo', 'Sandefjord OK'],
  },
  {
    id: 5705,
    newId: 26900,
    r: ['Stræte Tuva', 'Aas'],
    eOld: ['XTuva', 'XAas Stræte', 'Ringerike OL'],
    eNew: ['Tuva Aas', 'Stræte', 'Ringerike OL'],
  },
];

// Replacing eventor id. Discovered when finding name mismatch and manually investigating eventor competitors
export const eventorReplacements = new Map<number, { newId: number; r: [string, string]; e: [string, string] }>(
  data.map((i) => [i.id, { newId: i.newId, r: i.r, e: [i.eNew[0], i.eNew[1]] }]),
);
