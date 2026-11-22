import * as fs from 'node:fs';
import type { Club } from './club.model.ts';
import type { Competitor } from './competitor.model.ts';
import { currentYear, firstYear } from './constants.ts';
import { type IofCompetitor, iofGetCompetitors } from './iof-competitor-list.service.ts';
import { reportStats } from './report.service.ts';
import { webRead } from './web.service.ts';

const stats = {
  competitors: {
    count: 0,
    // no eventor association
    noEventor: 0,
    // results has eventor id, but that id does not exist in eventor competitor registry
    missingInEventor: 0,
    // name in result does not match eventor competitor
    // - eg. first name and last are mixed up
    // - eg. eventor has more/fewer names
    // - eg. name is misspelled in results (or in eventor for that matter; if so, eventor still wins)
    // - NOTE: eventor id could be wrong somehow (though these should have been excluded in the 2024 convert)
    nameMismatch: 0,
    // club in results does not match club in eventor for this competitor
    // - eg. the club is misspelled in results
    // - eg. competitor has changed club (updated only when there is a new result)
    clubMismatch: 0,
  },
  clubs: {
    count: 0,
    // no eventor association (name won't be updated for other competitors if it changes)
    noEventor: 0,
    // clubs with no eventor association but match on 4+ letter word in at least one existing
    potentialMatch: 0,
  },
};

const details = {
  competitors: {
    missingInEventor: [] as string[],
    nameMismatch: [] as string[],
    // unique set of [club name in results, club name in eventor competitor]
    clubMismatch: [] as string[],
  },
  clubs: {
    potentialMatch: [] as string[],
  },
};

function analyzeNamesAndClubs(
  args: AnalyzeArgs,
  competitors: Competitor[],
  clubs: Club[],
  eventorMap: Map<number, IofCompetitor>,
  eventorClubs: Map<string, number>,
): void {
  const filtered = filterByDebutYear(args.validationYears, competitors, clubs);
  reportStats('Filtered', filtered.competitors, filtered.clubs, false);

  analyzeCompetitors(filtered.competitors, eventorMap);
  analyzeClubs(filtered.clubs, eventorClubs);

  writeDetails('missing-in-eventor', details.competitors.missingInEventor);
  writeDetails('name-mismatch', details.competitors.nameMismatch);
  writeDetails('club-mismatch', details.competitors.clubMismatch);
  writeDetails('club-potential-match', details.clubs.potentialMatch);
  console.log(`Done: ${JSON.stringify(stats, null, 2)}`);
}

function analyzeCompetitors(competitors: Competitor[], eventorMap: Map<number, IofCompetitor>): void {
  for (const competitor of competitors) {
    analyzeCompetitor(competitor, eventorMap);
  }

  stats.competitors.count = competitors.length;
  const clubMismatch = new Set(details.competitors.clubMismatch);
  details.competitors.clubMismatch = [...clubMismatch.keys()].sort();
}

function analyzeCompetitor(competitor: Competitor, eventorMap: Map<number, IofCompetitor>): void {
  let eventor: IofCompetitor | undefined = undefined;
  if (competitor.eventorId === undefined) {
    stats.competitors.noEventor += 1;
  } else {
    eventor = eventorMap.get(competitor.eventorId);
    if (eventor === undefined) {
      stats.competitors.missingInEventor += 1;
      details.competitors.missingInEventor.push(JSON.stringify(competitor));
    } else {
      if (eventor.firstName !== competitor.firstName || eventor.lastName !== competitor.lastName) {
        stats.competitors.nameMismatch += 1;
        details.competitors.nameMismatch.push(
          `{\n  id:${competitor.eventorId},\n  r:['${competitor.firstName}', '${competitor.lastName}'],\n  e:['${eventor.firstName}', '${eventor.lastName}']\n},`,
        );
      }
      if (competitor.club && eventor.club && eventor.club !== competitor.club) {
        stats.competitors.clubMismatch += 1;
        details.competitors.clubMismatch.push(`['${competitor.club}', '${eventor.club}'],`);
      }
    }
  }
}

function analyzeClubs(clubs: Club[], eventorClubs: Map<string, number>): void {
  const matchMap = new Map<string, string[]>();
  for (const c of eventorClubs.keys()) {
    for (const k of c.toLowerCase().split(/[ -,]/)) {
      if (k.length >= 4) {
        matchMap.set(k, [...(matchMap.get(k) ?? []), c]);
      }
    }
  }

  for (const club of clubs) {
    analyzeClub(club, matchMap);
  }

  stats.clubs.count = clubs.length;
  details.clubs.potentialMatch.sort();
}

function analyzeClub(club: Club, matchMap: Map<string, string[]>): void {
  if (club.eventorId === undefined) {
    stats.clubs.noEventor += 1;
    const keys = club.name
      .toLowerCase()
      .split(/[ -,]/)
      .filter((k) => k.length >= 4);
    keys.sort((a, b) => a.length - b.length);
    let potentialMatchFound = false;
    for (const k of keys) {
      const eventorNames = matchMap.get(k);
      if (eventorNames) {
        potentialMatchFound = true;
        for (const cn of eventorNames) {
          details.clubs.potentialMatch.push(`['${club.name}', '${cn}'],`);
        }
      }
    }
    if (potentialMatchFound) {
      stats.clubs.potentialMatch += 1;
    }
  }
}

function filterByDebutYear(
  years: number[],
  competitors: Competitor[],
  clubs: Club[],
): { competitors: Competitor[]; clubs: Club[] } {
  if (years.length === 0) {
    return { competitors, clubs };
  }
  const yearSet = new Set(years);

  const usedClubs = new Set<string>();
  const filteredCompetitors = competitors.filter((c) => {
    const debutYear = c.participations[0][0];
    const include = yearSet.has(debutYear);
    if (include && c.club) {
      usedClubs.add(c.club);
    }
    return include;
  });

  return {
    competitors: filteredCompetitors,
    clubs: clubs.filter((c) => usedClubs.has(c.name)),
  };
}

type AnalyzeArgs = {
  // Only competitors with their first entry in these years will be considered.
  // Only clubs associated with these competitors will be considered.
  validationYears: number[];
};

function parseArgs(): AnalyzeArgs {
  const validationYears: number[] = [];
  for (const arg of process.argv) {
    const year = parseInt(arg);
    if (year >= firstYear && year <= currentYear && year.toString() === arg) {
      validationYears.push(year);
    }
  }

  return { validationYears };
}

function writeDetails(name: string, lines: string[]): void {
  const path = `data/${name}.txt`;
  if (lines.length === 0) {
    if (fs.existsSync(path)) {
      fs.rmSync(path);
    }
  } else {
    fs.writeFileSync(path, lines.join('\n'), { encoding: 'utf-8' });
  }
}

function main(): void {
  const args = parseArgs();
  const web = webRead();
  const iof = iofGetCompetitors();
  analyzeNamesAndClubs(args, web.competitors, web.clubs, iof.competitors, iof.clubs);
}

main();
