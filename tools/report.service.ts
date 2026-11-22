import type { Club } from './club.model.ts';
import type { Competitor } from './competitor.model.ts';
import { firstYear } from './constants.ts';

export function reportStats(action: string, competitors: Competitor[], clubs: Club[], details: boolean): void {
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
