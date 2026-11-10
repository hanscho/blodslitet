import * as fs from 'node:fs';
import { mapFromWebCompetitor, mapToWebCompetitor, type Competitor, type WebCompetitor } from './competitor.model.ts';
import { firstYear } from './constants.ts';

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

export function webRead(): Competitor[] {
  const content = fs.readFileSync('web/fullfort.html', { encoding: 'utf-8' });
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

  const clubsEndExclusive = lines.findIndex((l, i) => i > clubsStartIndex && l === endMarker);
  const competitorsEndExclusive = lines.findIndex((l, i) => i > competitorsStartIndex && l === endMarker);
  if (clubsEndExclusive === -1 || clubsEndExclusive >= competitorsStartIndex) {
    throw new Error(`Missing clubs end marker: ${endMarker}`);
  }
  if (competitorsEndExclusive === -1) {
    throw new Error(`Missing competitors end marker: ${endMarker}`);
  }

  // remove from lines (competitors first since clubs removal affects its index)
  const competitorLines = lines.splice(competitorsStartIndex, competitorsEndExclusive - competitorsStartIndex);
  const clubs = lines.splice(clubsStartIndex, clubsEndExclusive - clubsStartIndex);

  htmlTemplate = {
    lines: lines,
    clubsStartIndex: clubsStartIndex,
    competitorsStartIndex: competitorsStartIndex - clubs.length,
  };

  const competitors: Competitor[] = [];
  for (const line of competitorLines) {
    competitors.push(mapFromWebCompetitor(mapLineToCompetitor(line), clubs));
  }

  reportStats('Read', clubs, competitors, false);

  return competitors;
}

export function webWrite(competitors: Competitor[]): void {
  if (htmlTemplate === undefined) {
    throw new Error('Must call readWeb before writeWeb');
  }

  const clubIndexes = createClubIndexes(competitors);
  const webCompetitors: WebCompetitor[] = competitors.map((c) => mapToWebCompetitor(c, clubIndexes));

  const clubs = [...clubIndexes.keys()];
  const competitorLines: string[] = [];
  webCompetitors.sort((a, b) => a.sortKey!.localeCompare(b.sortKey!));
  for (const c of webCompetitors) {
    competitorLines.push(mapCompetitorToLine(c));
  }

  reportStats('Writing', clubs, competitors, true);

  const lines = [
    ...htmlTemplate.lines.slice(0, htmlTemplate.clubsStartIndex),
    ...clubs,
    ...htmlTemplate.lines.slice(htmlTemplate.clubsStartIndex, htmlTemplate.competitorsStartIndex),
    ...competitorLines,
    ...htmlTemplate.lines.slice(htmlTemplate.competitorsStartIndex),
  ];
  fs.writeFileSync('web/fullfort.html', lines.join('\n'), { encoding: 'utf-8' });
}

function createClubIndexes(competitors: Competitor[]): Map<string, number> {
  const clubCount = new Map<string, number>();
  for (const c of competitors) {
    if (c.club !== undefined) {
      clubCount.set(c.club, 1 + (clubCount.get(c.club) ?? 0));
    }
  }

  // sort clubs with most competitors first, then create map from name to index
  const clubIndexes = new Map<string, number>();
  const sortedClubs = [...clubCount.entries()].sort((a, b) => {
    const countSort = b[1] - a[1];
    return countSort !== 0 ? countSort : a[0].localeCompare(b[0]);
  });
  for (const [club, _count] of sortedClubs) {
    clubIndexes.set(club, clubIndexes.size);
  }

  return clubIndexes;
}

function mapCompetitorToLine(c: WebCompetitor): string {
  return (
    `${c.eventorId?.toString() ?? ''}` +
    `\t${c.firstName}` +
    `\t${c.lastName}` +
    `\t${c.clubIndex?.toString() ?? ''}` +
    `\t${c.participations.join('\t')}`
  );
}

function mapLineToCompetitor(line: string): WebCompetitor {
  const [eventorIdString, firstName, lastName, clubIndexString, ...participations] = line.split('\t');

  const eventorId = eventorIdString == '' ? undefined : parseInt(eventorIdString);
  if ((eventorId?.toString() ?? '') !== eventorIdString) {
    throw new Error(`Could not parse eventorId '${eventorIdString}' in ${line}`);
  }

  const clubIndex = clubIndexString === '' ? undefined : parseInt(clubIndexString);
  if ((clubIndex?.toString() ?? '') !== clubIndexString) {
    throw new Error(`Could not parse clubIndex '${clubIndexString}' in ${line}`);
  }

  if (participations.length % 2 !== 0) {
    throw new Error(`Uneven number of participations ${participations.length} in ${line}`);
  }

  return {
    eventorId: eventorId,
    firstName: firstName,
    lastName: lastName,
    clubIndex: clubIndex,
    participations: participations,
  };
}

function reportStats(action: string, clubs: string[], competitors: Competitor[], details: boolean): void {
  const yearStats = new Map<number, { all: number; first: number }>();
  let maxYear = firstYear;
  for (const c of competitors) {
    let isFirst = true;
    for (const [year, _raceClass] of c.participations) {
      let yearStat = yearStats.get(year);
      if (!yearStat) {
        yearStat = { all: 0, first: 0 };
        yearStats.set(year, yearStat);
      }
      yearStat.all += 1;

      if (isFirst) {
        isFirst = false;
        yearStat.first += 1;
      }

      if (year > maxYear) {
        maxYear = year;
      }
    }
  }

  console.log(
    `${action} ${clubs.length} clubs and ${competitors.length} competitors, ${yearStats.get(maxYear)?.all ?? 0} in ${maxYear}`,
  );

  if (details) {
    console.log();
    console.log(`Year ${'Total'.padStart(5, ' ')} ${'First'.padStart(5, ' ')}`);
    for (const year of [...yearStats.keys()].sort()) {
      const yearStat = yearStats.get(year)!;
      console.log(`${year} ${yearStat.all.toString().padStart(5, ' ')} ${yearStat.first.toString().padStart(5, ' ')}`);
    }
    console.log();
  }
}
