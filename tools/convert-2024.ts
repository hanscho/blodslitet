import * as fs from 'node:fs';
import type { Club } from './club.model.ts';
import { type Competitor } from './competitor.model.ts';
import { firstYear, nameRegex, sqlSourcePath } from './constants.ts';
import { clubCorrections } from './convert-2024-club-corrections.ts';
import { encodingCorrections, eventorEncodingCorrections } from './convert-2024-encoding-corrections.ts';
import { eventorClubs } from './convert-2024-eventor-clubs.ts';
import { eventorNameCorrections } from './convert-2024-eventor-name-corrections.ts';
import { eventorReplacements } from './convert-2024-eventor-replacements.ts';
import { eventorUnlinkMismatches } from './convert-2024-eventor-unlink-mismatch.ts';
import { eventorUnlinkMissings } from './convert-2024-eventor-unlink-missing.ts';
import { lastNameCorrections } from './convert-2024-last-name-corrections.ts';
import { mergeCompetitors, mergeDuplicates, mergeEventorDuplicates } from './merge.service.ts';
import { webRead, webWrite } from './web.service.ts';

function normalizeName(name: string): string {
  name = name.trim();
  name = name.normalize('NFC');
  name = name.toLowerCase();
  name = name.replaceAll(/  +/g, ' ');
  name = name.replaceAll(/(^|[- /])./g, (substring: string) => substring.toUpperCase());
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

  // with one exception, handled by clubCorrections
  name = name.replaceAll('ï¿½', 'å');
  name = name.replaceAll('Ï¿½', 'Å');

  name = name.replaceAll(/(^|[ -])(Omegn|Og|O-Lag|Lag)(?=[ ,]|$)/g, (substring: string) => substring.toLowerCase());
  name = name.replaceAll(
    /(^|[ ])(Ok|Ol|If|Ifk|Sk|Il|Ik|Oc|Fk|Sok|Soc|Sf|Of|Fso|Fl|Aik|Bil)(?=[ ]|$)/g,
    (substring: string) => substring.toUpperCase(),
  );

  const correction = clubCorrections.get(name);
  unused.clubCorrections.delete(name);
  return correction ?? name;
}

function normalizeClass(name: string): string {
  name = name.replaceAll('ï¿½', 'å');
  name = name.replaceAll('Ã¥', 'å');
  return name;
}

function fixName(competitor: Competitor) {
  const name = `${competitor.firstName} ${competitor.lastName}`;

  if (!nameRegex.test(name)) {
    const manualCorrection = encodingCorrections.get(name);
    if (manualCorrection) {
      unused.encodingCorrection.delete(name);
      competitor.firstName = manualCorrection.firstName ?? competitor.firstName;
      competitor.lastName = manualCorrection.lastName ?? competitor.lastName;
    } else {
      const eventorEncodingCorrection = eventorEncodingCorrections.get(name);
      if (eventorEncodingCorrection) {
        unused.eventorEncodingCorrection.delete(name);
        competitor.firstName = eventorEncodingCorrection.firstName;
        competitor.lastName = eventorEncodingCorrection.lastName;
      } else {
        throw new Error(`Missing encoding correction for ${name}`);
      }
    }
  }

  if (competitor.eventorId !== undefined) {
    const eventorCorrection = eventorNameCorrections.get(competitor.eventorId);
    if (
      eventorCorrection &&
      competitor.firstName === eventorCorrection.r[0] &&
      competitor.lastName === eventorCorrection.r[1]
    ) {
      unused.eventorNameCorrections.delete(competitor.eventorId);
      competitor.firstName = eventorCorrection.e[0];
      competitor.lastName = eventorCorrection.e[1];
    }

    const eventorReplacement = eventorReplacements.get(competitor.eventorId);
    if (
      eventorReplacement &&
      competitor.firstName === eventorReplacement.r[0] &&
      competitor.lastName === eventorReplacement.r[1]
    ) {
      unused.eventorReplacements.delete(competitor.eventorId);
      competitor.eventorId = eventorReplacement.newId;
      competitor.firstName = eventorReplacement.e[0];
      competitor.lastName = eventorReplacement.e[1];
    }

    const unlink1 = eventorUnlinkMismatches.get(competitor.eventorId);
    if (unlink1 && competitor.firstName === unlink1.r[0] && competitor.lastName === unlink1.r[1]) {
      unused.eventorUnlinkMismatches.delete(competitor.eventorId);
      competitor.eventorId = undefined;
    } else {
      const unlink2 = eventorUnlinkMissings.get(competitor.eventorId);
      if (unlink2 && competitor.firstName === unlink2[0] && competitor.lastName === unlink2[1]) {
        unused.eventorUnlinkMissings.delete(competitor.eventorId);
        competitor.eventorId = undefined;
      }
    }
  }

  const lastNameCorrection = lastNameCorrections.get(name);
  if (lastNameCorrection) {
    unused.lastNameCorrections.delete(name);
    competitor.firstName = lastNameCorrection.firstName;
    competitor.lastName = lastNameCorrection.lastName;
  }
}

// Clubs with most competitors get indexes first so they'll encode as 1 byte.
// Do not modify this list, as that would change lots of indexes and create a huge diff.
// Except if a club changes name, then this list must be modified accordingly.
const largeClubs = [
  'Asker Skiklubb',
  'Bækkelagets SK',
  'Eiker OL',
  'FSO',
  'Fossum IF',
  'Fredrikstad SK',
  'Gimle IF',
  'Gjø-Vard OL',
  'Halden SK',
  'Heming Orientering',
  'Horsens OK',
  'Indre Østfold OK',
  'Kongsberg OL',
  'Konnerud IL',
  'Kristiansand OK',
  'Larvik OK',
  'Lillomarka OL',
  'NTNUI',
  'Nittedal OL',
  'Nordre Follo Orientering',
  'Nydalens SK',
  'OK Moss',
  'OK Pan Århus',
  'OL Tønsberg og omegn',
  'Oppsal Orientering',
  'Porsgrunn OL',
  'Raumar Orientering',
  'Ringerike OL',
  'Sandefjord OK',
  'Sarpsborg OL',
  'Sturla, IF',
  'Trøsken IL',
  'Tyrving IL',
  'Østmarka OK',
];

function createClubs(competitors: Competitor[]): Map<string, Club> {
  const largeIndexes = largeClubs.reduce((m, v, i) => m.set(v, i), new Map<string, number>());

  const clubs = new Map<string, Club>();
  for (const competitor of competitors) {
    if (competitor.club !== undefined && !clubs.has(competitor.club)) {
      unused.eventorClubs.delete(competitor.club);
      const club: Club = {
        lineIndex: largeIndexes.get(competitor.club),
        eventorId: eventorClubs.get(competitor.club),
        name: competitor.club,
      };
      unused.largeClubs.delete(club.name);
      clubs.set(club.name, club);
    }
  }

  return clubs;
}

function convertCompetitors(): { competitors: Competitor[]; clubs: Club[] } {
  // 2024.jsonl was was created by search/replace with old SQL INSERT INTO statements
  const oldFile = fs.readFileSync(sqlSourcePath, { encoding: 'utf-8' });
  const oldLines = oldFile.split('\n').filter((l) => l.length > 0);

  console.log(`Converting ${oldLines.length} competitors`);

  let competitors: Competitor[] = [];
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

    fixName(competitor);
    competitors.push(competitor);
  }

  competitors = mergeDuplicates(competitors);
  competitors = mergeEventorDuplicates(competitors);
  competitors = mergeCompetitors(competitors, '2024-merge-perfect.txt');

  const clubs = createClubs(competitors);
  for (const competitor of competitors) {
    if (competitor.club !== undefined) {
      const club = clubs.get(competitor.club);
      if (club === undefined) {
        throw new Error(`Missing club '${competitor.club}`);
      }
    }
  }

  return { competitors: competitors, clubs: [...clubs.values()] };
}

const unused = {
  encodingCorrection: new Set<string>(encodingCorrections.keys()),
  eventorEncodingCorrection: new Set<string>(eventorEncodingCorrections.keys()),
  lastNameCorrections: new Set<string>(lastNameCorrections.keys()),
  eventorReplacements: new Set<number>(eventorReplacements.keys()),
  eventorNameCorrections: new Set<number>(eventorNameCorrections.keys()),
  eventorUnlinkMismatches: new Set<number>(eventorUnlinkMismatches.keys()),
  eventorUnlinkMissings: new Set<number>(eventorUnlinkMissings.keys()),
  eventorClubs: new Set<string>(eventorClubs.keys()),
  clubCorrections: new Set<string>(clubCorrections.keys()),
  largeClubs: new Set<string>(largeClubs),
};

const _existingCompetitors = webRead();
const result = convertCompetitors();
webWrite(result.competitors, result.clubs);

// any message below indicate some kind of data inconsistency that needs to be investigated
for (const [name, set] of Object.entries(unused)) {
  if (set.size > 0) {
    console.log(`\n\nUNUSED KEYS IN ${name}: ` + JSON.stringify([...set.keys()], null, 2));
  }
}
