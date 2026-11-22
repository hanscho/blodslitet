import * as fs from 'node:fs';
import { type Club, type WebClub, mapFromWebClub, mapToWebClub } from './club.model.ts';
import { type Competitor, type WebCompetitor, mapFromWebCompetitor, mapToWebCompetitor } from './competitor.model.ts';
import { clubRegex, nameRegex, webFilePath } from './constants.ts';
import { reportStats } from './report.service.ts';

const clubsStartMarker = '      <pre id="clubs" style="display: none">';
const competitorsStartMarker = '      <pre id="competitors" style="display: none">';
const endMarker = '      </pre>';

let htmlTemplate:
  | undefined
  | {
      lines: string[];
      clubsStartIndex: number;
      competitorsStartIndex: number;
    } = undefined;

export function webRead(): { competitors: Competitor[]; clubs: Club[] } {
  const content = fs.readFileSync(webFilePath, { encoding: 'utf-8' });
  if (content.includes('\r')) {
    throw new Error('fullfort.html contains \\r. Check git config');
  }
  const lines = content.split('\n');

  const clubsStartIndex = 1 + lines.findIndex((l) => l === clubsStartMarker);
  const competitorsStartIndex = 1 + lines.findIndex((l) => l === competitorsStartMarker);
  if (clubsStartIndex === 0) {
    throw new Error(`Missing marker: ${clubsStartMarker}`);
  }
  if (competitorsStartIndex === 0) {
    throw new Error(`Missing marker: ${competitorsStartIndex}`);
  }
  if (clubsStartIndex >= competitorsStartIndex) {
    throw new Error('<pre> for clubs must be before competitors');
  }

  const clubsEndExclusive = lines.findIndex((l, i) => i >= clubsStartIndex && l === endMarker);
  const competitorsEndExclusive = lines.findIndex((l, i) => i >= competitorsStartIndex && l === endMarker);
  if (clubsEndExclusive === -1 || clubsEndExclusive >= competitorsStartIndex) {
    throw new Error(`Missing clubs end marker: ${endMarker} (${clubsEndExclusive}, ${competitorsStartIndex}))`);
  }
  if (competitorsEndExclusive === -1) {
    throw new Error(`Missing competitors end marker: ${endMarker}`);
  }

  // remove from lines (competitors first since clubs removal affects its index)
  const competitorLines = lines.splice(competitorsStartIndex, competitorsEndExclusive - competitorsStartIndex);
  const clubLines = lines.splice(clubsStartIndex, clubsEndExclusive - clubsStartIndex);

  htmlTemplate = {
    lines: lines,
    clubsStartIndex: clubsStartIndex,
    competitorsStartIndex: competitorsStartIndex - clubLines.length,
  };

  const clubs = clubLines.map((line, index) => mapFromWebClub(mapLineToClub(line, index)));
  const competitors = competitorLines.map((line) => mapFromWebCompetitor(mapLineToCompetitor(line), clubs));

  reportStats('Read', competitors, clubs, false);

  return { competitors: competitors, clubs: clubs };
}

function validateNoDuplicates(competitors: Competitor[], clubs: Club[]): void {
  const competitorIds = new Set<number>();
  for (const c of competitors) {
    if (c.eventorId) {
      if (competitorIds.has(c.eventorId)) {
        throw new Error(`Refuse to write competitor with duplicate eventorId: ${JSON.stringify(c)}`);
      }
      competitorIds.add(c.eventorId);
    }
  }
  const clubIds = new Set<number>();
  const clubNames = new Set<string>();
  for (const c of clubs) {
    if (c.eventorId) {
      if (clubIds.has(c.eventorId)) {
        throw new Error(`Refuse to write club with duplicate eventorId: ${JSON.stringify(c)}`);
      }
      clubIds.add(c.eventorId);
    }
    if (clubNames.has(c.name)) {
      throw new Error(`Refuse to write club with duplicate name: ${JSON.stringify(c)}`);
    }
    clubNames.add(c.name);
  }
}

export function webWrite(competitors: Competitor[], clubs: Club[]): void {
  if (htmlTemplate === undefined) {
    throw new Error('Must call readWeb before writeWeb');
  }
  validateNoDuplicates(competitors, clubs);

  const webClubs = createWebClubsMap(clubs);
  const webCompetitors: WebCompetitor[] = competitors.map((c) => mapToWebCompetitor(c, webClubs));

  const competitorLines: string[] = [];
  webCompetitors.sort((a, b) => a.sortKey!.localeCompare(b.sortKey!));
  for (const c of webCompetitors) {
    const name = `${c.firstName} ${c.lastName}`;
    if (!nameRegex.test(name)) {
      // add character to above regex if it looks ok
      console.log(`\n\nUNEXPECTED CHARACTER IN NAME: '${name}'`);
    }

    competitorLines.push(mapCompetitorToLine(c));
  }

  const clubLines: string[] = [];
  for (const club of webClubs.values()) {
    if (!clubRegex.test(club.name)) {
      // add character to above regex if it looks ok
      console.log(`\n\nUNEXPECTED CHARACTER IN CLUB NAME: '${club}'`);
    }

    clubLines.push(mapClubToLine(club));
  }

  reportStats('Writing', competitors, clubs, true);

  const lines = [
    ...htmlTemplate.lines.slice(0, htmlTemplate.clubsStartIndex),
    ...clubLines,
    ...htmlTemplate.lines.slice(htmlTemplate.clubsStartIndex, htmlTemplate.competitorsStartIndex),
    ...competitorLines,
    ...htmlTemplate.lines.slice(htmlTemplate.competitorsStartIndex),
  ];
  fs.writeFileSync(webFilePath, lines.join('\n'), { encoding: 'utf-8' });
}

function createWebClubsMap(clubs: Club[]): Map<string, WebClub> {
  const webClubs = clubs.map(mapToWebClub);
  webClubs.sort((a, b) => a.sortKey!.localeCompare(b.sortKey!));

  const map = new Map<string, WebClub>();
  let nextIndex = 0;
  let processedExisting = false;
  for (const c of webClubs) {
    if (map.has(c.name)) {
      throw new Error(`Duplicate club name '${c.name}'`);
    }
    map.set(c.name, c);

    if (c.lineIndex !== undefined) {
      if (processedExisting) {
        throw Error(`Club sort error, expected no lineIndex but got ${JSON.stringify(c)}`);
      }
      if (c.lineIndex !== nextIndex) {
        throw Error(`Club sort error, expected lineIndex ${nextIndex} but got ${JSON.stringify(c)}`);
      }
    } else {
      processedExisting = true;
      c.lineIndex = nextIndex;
    }
    nextIndex += 1;
  }

  return map;
}

function mapCompetitorToLine(c: WebCompetitor): string {
  return (
    `${c.eventorIdAscii ?? ''}` +
    `\t${c.firstName}` +
    `\t${c.lastName}` +
    `\t${c.clubIndexAscii ?? ''}` +
    `\t${c.participations.join('\t')}`
  );
}
function mapLineToCompetitor(line: string): WebCompetitor {
  const [eventorId, firstName, lastName, clubIndex, ...participations] = line.split('\t');

  if (participations.length % 2 !== 0) {
    throw new Error(`Uneven number of participations ${participations.length} in ${line}`);
  }

  return {
    eventorIdAscii: eventorId === '' ? undefined : eventorId,
    firstName: firstName,
    lastName: lastName,
    clubIndexAscii: clubIndex === '' ? undefined : clubIndex,
    participations: participations,
  };
}

function mapClubToLine(c: WebClub): string {
  return `${c.eventorIdAscii ?? ''}\t${c.name}`;
}

function mapLineToClub(line: string, lineIndex: number): WebClub {
  const [eventorId, name] = line.split('\t');

  return {
    lineIndex: lineIndex,
    eventorIdAscii: eventorId === '' ? undefined : eventorId,
    name: name,
  };
}
