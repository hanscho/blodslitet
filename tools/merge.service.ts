import type { Competitor } from './competitor.model.ts';

export function mergeDuplicates(competitors: Competitor[]): Competitor[] {
  const existing = new Set<string>();
  const result: Competitor[] = [];
  for (const competitor of competitors) {
    const key = JSON.stringify(competitor);
    if (!existing.has(key)) {
      existing.add(key);
      result.push(competitor);
    }
  }

  console.log(`Removed ${competitors.length - result.length} exact duplicate(s) (including participations)`);

  return result;
}

export function mergeEventorDuplicates(competitors: Competitor[]): Competitor[] {
  const map = new Map<number, Competitor>();
  const result: Competitor[] = [];
  for (const competitor of competitors) {
    if (competitor.eventorId) {
      const existing = map.get(competitor.eventorId);
      if (existing) {
        mergeCompetitor(existing, competitor);
      } else {
        map.set(competitor.eventorId, competitor);
        result.push(competitor);
      }
    } else {
      result.push(competitor);
    }
  }

  console.log(`Merged ${competitors.length - result.length} eventor duplicate(s)`);

  return result;
}

function mergeCompetitor(target: Competitor, source: Competitor): void {
  const years = new Map<number, string>(target.participations);
  for (const [year, raceClass] of source.participations) {
    const existingClass = years.get(year);
    if (existingClass && existingClass != raceClass) {
      throw new Error(`Participation conflict when merging ${JSON.stringify(source)} into ${JSON.stringify(target)}`);
    }
    years.set(year, raceClass);
  }
  target.participations = [...years.keys()].sort().map((year) => [year, years.get(year)!]);
}
