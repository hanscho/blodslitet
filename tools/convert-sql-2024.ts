import * as fs from 'node:fs';
import { type Competitor } from './competitor.model.ts';
import { firstYear } from './constants.ts';
import { webRead, webWrite } from './web.service.ts';

// 2024.jsonl was was created by search/replace with old SQL INSERT INTO statements
const oldFile = fs.readFileSync('data/2024.jsonl', { encoding: 'utf-8' });
const oldLines = oldFile.split('\n').filter((l) => l.length > 0);

console.log(`Processing ${oldLines.length} competitors`);
const competitors: Competitor[] = [];

function normalizeName(name: string): string {
  name = name.trim();
  name = name.normalize('NFC');
  name = name.toLowerCase();
  name = name.replaceAll(/  +/g, ' ');
  name = name.replaceAll(/(^|[- /])./g, (substring: string) => substring.toUpperCase());
  // TBD: sometimes å/Å
  name = name.replaceAll('ï¿½', 'ø');
  name = name.replaceAll('Ï¿½', 'Ø');
  // needed to safely use \t as field separator
  name = name.replaceAll('\t', ' ');
  return name;
}

function normalizeClub(name: string): string | undefined {
  name = normalizeName(name);
  name = name.replace(/,.*/, '');
  if (name === 'No Team' || name === 'Noteam' || name === 'Klubbløs' || name === '') {
    return undefined;
  }

  name = name.replaceAll(/(^|[ -])(Omegn|Og|O-Lag|Lag)(?=[ ,]|$)/g, (substring: string) => substring.toLowerCase());
  name = name.replaceAll(
    /(^|[ ])(Ok|Ol|If|Sk|Il|Ik|Oc|Fk|Soc|Sf|Of|Ifk|Fso|Fl|Aik|Bil)(?=[ ]|$)/g,
    (substring: string) => substring.toUpperCase(),
  );

  const correction = clubCorrection.get(name);
  return correction ?? name;
}

function normalizeClass(name: string): string {
  name = name.replaceAll('ï¿½', 'å');
  return name;
}

const clubCorrection = new Map<string, string>([
  ['Gneist', 'Gneist IL'],
  ['Hauken', 'Hauken IL'],
  ['Hviterusland', 'Hviterussland'],
  ['Nidarøst', 'Nidarøst OK'],
  ['Sturla', 'Sturla IF'],
  ['Trollo', 'Trollo OL'],
  ['Ulrikeshamns OK', 'Ulricehamns OK'],
  ['Vestre Aker SK', 'Vestre Akers SK'],
  ['Vänersborg SK', 'Vänersborgs SK'],
  ['Øvrebø/Vindbjart', 'Øvrebø/Vindbjart Orientering'],
  ['Øvrebø/Vindbjart Orien', 'Øvrebø/Vindbjart Orientering'],
  ['Ålgård', 'Ålgård Orientering'],
  ['Ålgård OK', 'Ålgård Orientering'],
  ['Södertälje Nykvarn', 'Södertälje-Nykvarn Orientering'],
  ['Södertälje Nykvarn Orientering', 'Södertälje-Nykvarn Orientering'],
  ['Steinkjær OK', 'Steinkjer OK'],
  ['Stavanger OK', 'Stavanger Orienteringsklubb'],
  ['Göteborg Majorna OK', 'Göteborg-Majorna OK'],
  ['Gjerstad I.l.', 'Gjerstad IL'],
  ['Fif Hillerød', 'Fif Hillerød Orientering'],
  ['Farum-Tisvilde', 'Farum-Tisvilde OK'],
  ['Falkenbergs', 'Falkenbergs OK'],
  ['Falköpings AIK', 'Falköpings AIK OK'],
  ['Austmarka I.l -orientering', 'Austmarka IL'],
  ['Ntnui', 'NTNUI'],
  ["Dof's Venner", "DOF's venner"],
  // TBD
  ['', ''],
  ['', ''],
  ['', ''],
]);

for (const line of oldLines) {
  const [id, eventorId, count, firstName, lastName, club, ...classes] = JSON.parse(line);

  if (classes.length !== 2029 - firstYear + 1) {
    throw new Error(`Unexpected class count mismatch for ${firstName} ${lastName}, ${club}`);
  }

  const competitor: Competitor = {
    eventorId: eventorId === 0 ? undefined : eventorId,
    firstName: normalizeName(firstName),
    lastName: normalizeName(lastName),
    club: normalizeClub(club),
    participations: [],
  };

  for (let i = 0; i < classes.length; i++) {
    const year = firstYear + i;
    const c = classes[i];
    if (c !== null) {
      competitor.participations.push([year, normalizeClass(c)]);
    }
  }

  if (count !== competitor.participations.length) {
    throw new Error(`Origin count mismatch, ${count} <> ${competitor.participations.length} for ${id}/${eventorId}`);
  }

  competitors.push(competitor);
}

webRead();
webWrite(competitors);
