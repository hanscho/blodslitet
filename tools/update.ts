import * as fs from 'node:fs';

const oldFile = fs.readFileSync('2024.jsonl', { encoding: 'utf-8' });
const oldLines = oldFile.split('\n').filter((l) => l.length > 0);

console.log(oldLines.length);

type Participant = {
  // eventorId
  e?: number;
  // firstName
  f: string;
  // lastName
  l: string;
  // club
  c: string;
  // participations, alternating list of year:number, class:string
  p: (number | string)[];
  s?: string;
};

const participants: Participant[] = [];
const top: string[] = [];

function normalizeName(name: string): string {
  name = name.trim();
  name = name.normalize('NFC');
  name = name.toLowerCase();
  name = name.replaceAll(/  +/g, ' ');
  //name = toLower(name);
  name = name.replaceAll(/(^|[- /])./g, (substring: string) => substring.toUpperCase());
  name = name.replaceAll('ï¿½', 'ø');
  name = name.replaceAll('Ï¿½', 'Ø');
  // needed to safely use \t as field separator
  name = name.replaceAll('\t', ' ');
  return name;
}

function normalizeClub(name: string): string {
  name = normalizeName(name);
  name = name.replace(/,.*/, '');
  name = name.replaceAll(/(^|[ -])(Omegn|Og|O-Lag|Lag)(?=[ ,]|$)/g, (substring: string) => substring.toLowerCase());
  name = name.replaceAll(
    /(^|[ ])(Ok|Ol|If|Sk|Il|Ik|Oc|Fk|Soc|Sf|Of|Ifk|Fso|Fl|Aik|Bil)(?=[ ]|$)/g,
    (substring: string) => substring.toUpperCase(),
  );

  const correction = clubCorrection.get(name);
  return correction ?? name;
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
  ['', ''],
  ['', ''],
  ['', ''],
  ['', ''],
  ['', ''],
]);

const clubs = new Map<string, number>();

const raw: string[] = [];

for (const line of oldLines) {
  const [id, eventorId, count, firstName, lastName, club, ...classes] = JSON.parse(line.replaceAll("'", '"'));

  if (classes.length !== 2029 - 1968 + 1) {
    console.error(`Unexpected class count mismatch for ${firstName} ${lastName}, ${club}`);
  }

  const p: Participant = {
    e: eventorId === 0 ? undefined : eventorId,
    f: normalizeName(firstName),
    l: normalizeName(lastName),
    c: normalizeClub(club),
    p: [],
  };
  p.s = `${p.f}#${p.l}#${p.c}#${p.e}`;

  let tmp = 0;

  for (let i = 0; i < classes.length; i++) {
    const year = 1968 + i;
    const c = classes[i];
    if (c !== null) {
      p.p.push(year, c);
      if (year < 2022) {
        tmp += 1;
      }
    }
  }

  if (tmp >= 27) {
    top.push(`${tmp} ${p.f} ${p.l} ${p.c}`);
  }

  if (count !== p.p.length / 2) {
    console.error(`Origin count mismatch, ${count} <> ${p.p.length / 2} for ${id}/${eventorId}`);
  }

  participants.push(p);
  clubs.set(p.c, 1 + (clubs.get(p.c) ?? 0));

  raw.push(`${firstName} ${lastName} ${club} ${classes.filter((c: string) => c !== null).join(' ')}`);
}

let noCount = 0;
function javascriptString(p: Participant, noTeam: boolean): string {
  if (noTeam) {
    p.c = '';
  }
  return `${p.e ?? ''}\t${p.f}\t${p.l}\t${p.c}\t${p.p.join('\t')}`;
  // return JSON.stringify(p);
  // const eventorId = p.e === undefined ? '' : `e:${p.e},`;
  // const club = noTeam ? '' : `c:${p.c},`;
  // if (noTeam) {
  //   noCount += 1;
  // }
  // return `{${eventorId}f:${JSON.stringify(p.f)},l:${JSON.stringify(p.l)},${club}p:${JSON.stringify(p.p)}}`;
}

const isNoteam = (club: string) => club === 'No Team' || club === 'Noteam' || club === 'Klubbløs' || club === '';

const clubMap = new Map<string, number>();
const sortedClubs = [...clubs.entries()].sort((a, b) => b[1] - a[1]);
for (const [club, _count] of sortedClubs) {
  if (!isNoteam(club)) {
    clubMap.set(club, clubMap.size);
  }
}

const newLines: string[] = [];
participants.sort((a, b) => a.s!.localeCompare(b.s!));
for (const p of participants) {
  const noTeam = isNoteam(p.c);
  if (!noTeam) {
    const clubIndex = clubMap.get(p.c);
    if (clubIndex === undefined) {
      throw new Error(`${p.c} not in clubMap`);
    }
    p.c = clubIndex as unknown as string;
  }
  p.s = undefined;
  newLines.push(javascriptString(p, noTeam));
}

fs.writeFileSync('2026.jsonl', newLines.join('\n'), { encoding: 'utf-8' });

fs.writeFileSync('top-2024-script.txt', top.sort().reverse().join('\n'), { encoding: 'utf-8' });

fs.writeFileSync('clubs.txt', [...clubMap.keys()].join('\n'), { encoding: 'utf-8' });
fs.writeFileSync('raw.txt', raw.sort().join('\n'), { encoding: 'utf-8' });

console.log(noCount);

//['ID2', 'EVENTORID', 'COUNT', 'FIRSTNAME', 'SURNAME', 'CLUB', '1968', '1969', '1970', '1971', '1972', '1973', '1974', '1975', '1976', '1977', '1978', '1979', '1980', '1981', '1982', '1983', '1984', '1985', '1986', '1987', '1988', '1989', '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029']
//[1,0,5,'AMUND','MOEN','KONNERUD IL',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'H -18','H -18','H -18','H -18','H 19-',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL]
