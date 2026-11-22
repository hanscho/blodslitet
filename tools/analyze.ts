import * as fs from 'node:fs';
import { analyzeLastNameMixups } from './analyze-last-name.service.ts';
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
    match: {
      perfect: 0,
      fullName: 0,
      clubAndSuperset: 0,
      clubAndTwoNames: 0,
      superset: 0,
      clubAndFirstName: 0,
    },
    matchTotal: {
      perfect: 0,
      fullName: 0,
      clubAndSuperset: 0,
      clubAndTwoNames: 0,
      superset: 0,
      clubAndFirstName: 0,
    },
  },
  clubs: {
    count: 0,
    // no eventor association (name won't be updated for other competitors if it changes)
    noEventor: 0,
    // clubs with no eventor association but match on 4+ letter word in at least one existing
    potentialMatch: 0,
  },
};

type MatchType = 'perfect' | 'fullName' | 'clubAndSuperset' | 'clubAndTwoNames' | 'superset' | 'clubAndFirstName';
const matchTypes: MatchType[] = [
  'perfect',
  'fullName',
  'clubAndSuperset',
  'clubAndTwoNames',
  'superset',
  'clubAndFirstName',
];

const details = {
  competitors: {
    missingInEventor: [] as string[],
    nameMismatch: [] as string[],
    // unique set of [club name in results, club name in eventor competitor]
    clubMismatch: [] as string[],
    resultMatch: {
      perfect: [] as string[],
      fullName: [] as string[],
      clubAndSuperset: [] as string[],
      clubAndTwoNames: [] as string[],
      superset: [] as string[],
      clubAndFirstName: [] as string[],
    } satisfies Record<MatchType, string[]>,
    eventorMatch: {
      perfect: [] as string[],
      fullName: [] as string[],
      clubAndSuperset: [] as string[],
      clubAndTwoNames: [] as string[],
      superset: [] as string[],
      clubAndFirstName: [] as string[],
    } satisfies Record<MatchType, string[]>,
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

  analyzeCompetitors(competitors, filtered.competitors, eventorMap);
  analyzeClubs(filtered.clubs, eventorClubs);

  writeDetails('missing-in-eventor', details.competitors.missingInEventor);
  writeDetails('name-mismatch', details.competitors.nameMismatch);
  writeDetails('club-mismatch', details.competitors.clubMismatch);
  for (const matchType of matchTypes) {
    writeDetails(`name-potential-match-${matchType}`, details.competitors.resultMatch[matchType]);
    writeDetails(`name-potential-match-${matchType}.eventor`, details.competitors.eventorMatch[matchType]);
  }
  writeDetails('club-potential-match', details.clubs.potentialMatch);
  console.log(`Done: ${JSON.stringify(stats, null, 2)}`);
}

function analyzeCompetitors(
  allCompetitors: Competitor[],
  competitors: Competitor[],
  eventorMap: Map<number, IofCompetitor>,
): void {
  analyzeLastNameMixups(competitors);

  const indexMap = new Map<string, number>(allCompetitors.entries().map(([index, c]) => [JSON.stringify(c), index]));
  const matchMap = buildMatchMap(allCompetitors, eventorMap);
  for (const competitor of competitors) {
    const index = indexMap.get(JSON.stringify(competitor));
    if (index === undefined) {
      throw new Error('Competitor index not found!');
    }
    analyzeCompetitor(index, competitor, matchMap, eventorMap);
  }

  stats.competitors.count = competitors.length;
  const clubMismatch = new Set(details.competitors.clubMismatch);
  details.competitors.clubMismatch = [...clubMismatch.keys()].sort();
}

function analyzeCompetitor(
  index: number,
  competitor: Competitor,
  matchMap: Map<string, CompetitorInfo[]>,
  eventorMap: Map<number, IofCompetitor>,
): void {
  let eventor: IofCompetitor | undefined = undefined;
  if (competitor.eventorId === undefined) {
    stats.competitors.noEventor += 1;
    tryMatchCompetitor(index, competitor, matchMap);
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

type CompetitorInfo = {
  // unique for result/eventor item within this analysis run
  i: number;
  names: Set<string>;
  // exactly one of `result` and `eventor` is set
  result?: Competitor;
  eventor?: IofCompetitor;
};

function buildMatchMap(
  competitors: Competitor[],
  eventorMap: Map<number, IofCompetitor>,
): Map<string, CompetitorInfo[]> {
  const matchMap = new Map<string, CompetitorInfo[]>();

  for (const [index, competitor] of competitors.entries()) {
    const names = getNameSet(competitor);
    for (const k of names.keys()) {
      let candidates = matchMap.get(k);
      if (!candidates) {
        candidates = [];
        matchMap.set(k, candidates);
      }
      candidates.push({ i: index, names: names, result: competitor });
    }
  }

  let i = competitors.length;
  for (const c of eventorMap.values()) {
    const names = getNameSet(c);
    for (const n of names.keys()) {
      let candidates = matchMap.get(n);
      if (!candidates) {
        candidates = [];
        matchMap.set(n, candidates);
      }
      candidates.push({ i: i, names: names, eventor: c });
    }
    i += 1;
  }

  return matchMap;
}

function getNameSet(competitor: Competitor | IofCompetitor): Set<string> {
  const name = `${competitor.firstName} ${competitor.lastName}`.toLowerCase().normalize('NFC');
  return new Set(
    name
      .split(/[-. ]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0),
  );
}

function tryMatchCompetitor(index: Number, competitor: Competitor, matchMap: Map<string, CompetitorInfo[]>): void {
  const matches: Record<MatchType, CompetitorInfo[]> = {
    perfect: [],
    fullName: [],
    clubAndSuperset: [],
    clubAndTwoNames: [],
    superset: [],
    clubAndFirstName: [],
  };

  const usedCandidates = new Set<number>();

  const names = [...getNameSet(competitor).keys()];
  for (const n of names) {
    const candidates = matchMap.get(n);
    if (candidates) {
      for (const cand of candidates) {
        if (index === cand.i || usedCandidates.has(cand.i)) {
          continue;
        }
        usedCandidates.add(cand.i);

        const nameCount = names.filter((n) => cand.names.has(n)).length;
        const clubMatch = competitor.club && competitor.club === (cand.result?.club ?? cand.eventor?.club);
        if (nameCount === names.length && cand.names.size === names.length) {
          if (clubMatch) {
            matches.perfect.push(cand);
          } else {
            matches.fullName.push(cand);
          }
        } else if (nameCount === Math.min(names.length, cand.names.size)) {
          if (clubMatch) {
            matches.clubAndSuperset.push(cand);
          } else {
            matches.superset.push(cand);
          }
        } else if (clubMatch) {
          if (nameCount >= 2) {
            matches.clubAndTwoNames.push(cand);
          } else if (competitor.firstName === (cand.result?.firstName ?? cand.eventor?.firstName)) {
            matches.clubAndFirstName.push(cand);
          }
        }
      }
    }
  }

  for (const matchType of matchTypes) {
    const typeMatches = matches[matchType];
    if (typeMatches.length > 0) {
      stats.competitors.match[matchType] += 1;
      stats.competitors.matchTotal[matchType] += typeMatches.length;

      const resultMatch = typeMatches.find((m) => m.result)?.result!;
      const log = resultMatch
        ? details.competitors.resultMatch[matchType]
        : details.competitors.eventorMatch[matchType];
      log.push(JSON.stringify(competitor));
      for (const m of typeMatches) {
        if (m.result) {
          log.push(`  RESULT ${JSON.stringify(m.result)}`);
        } else if (m.eventor) {
          if (m.eventor.birthYear) {
            const birthYear = m.eventor.birthYear;
            const pFirst = competitor.participations[0];
            const pLast = competitor.participations.at(-1)!;
            log.push(`  # ${pFirst[1]} (age ${pFirst[0] - birthYear}), ${pLast[1]} (age ${pLast[0] - birthYear})`);
            if (resultMatch) {
              const birthYear = m.eventor.birthYear;
              const pFirst = resultMatch.participations[0];
              const pLast = resultMatch.participations.at(-1)!;
              log.push(`  # ${pFirst[1]} (age ${pFirst[0] - birthYear}), ${pLast[1]} (age ${pLast[0] - birthYear})`);
            }
            const payAttention = checkClassYear(birthYear, [
              ...competitor.participations,
              ...(resultMatch?.participations ?? []),
            ]);
            if (payAttention) {
              log.push(`  # PAY ATTENTION: ${payAttention}`);
            }
          }
          log.push(`  EVENTOR ${JSON.stringify(m.eventor)}`);
        } else {
          throw new Error(`Invalid candidate in tryMatchCompetitor: ${JSON.stringify(m)}`);
        }
      }
    }
  }
}

function checkClassYear(birthYear: number, participations: [year: number, raceClass: string][]): string | undefined {
  for (const [year, raceClass] of participations) {
    const age = year - birthYear;
    const match = /(?:[A-Za-z]-[A-Za-zåÅ])?[^0-9]*([0-9]*)-([0-9]*)/.exec(raceClass) ?? /([0-9]+)$/.exec(raceClass);
    if (match) {
      const lowerAge = match[1] ? parseInt(match[1]) : 0;
      const upperAge = match[2] ? parseInt(match[2]) : 199;
      if (age < lowerAge) {
        return `AGE ${age} BEFORE ${year} ${raceClass}`;
      }
      if (age > upperAge) {
        return `AGE ${age} AFTER ${year} ${raceClass}`;
      }
    }
  }
  return undefined;
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
