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
