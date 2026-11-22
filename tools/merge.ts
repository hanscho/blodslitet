import { currentYear, firstYear } from './constants.ts';
import { mergeCompetitors } from './merge.service.ts';
import { webRead, webWrite } from './web.service.ts';

type MergeArgs = {
  year: number;
};

function parseArgs(): MergeArgs {
  let mergeYear = currentYear;
  for (const arg of process.argv) {
    const year = parseInt(arg);
    if (year >= firstYear && year <= currentYear && year.toString() === arg) {
      mergeYear = year;
    }
  }

  return { year: mergeYear };
}

function main(): void {
  const args = parseArgs();
  let { competitors, clubs } = webRead();

  switch (args.year) {
    case 2025:
      competitors = mergeCompetitors(competitors, '2025-merge-perfect.txt');
      competitors = mergeCompetitors(competitors, '2025-merge-perfect.eventor.txt');
      competitors = mergeCompetitors(competitors, '2025-merge-superset.txt');
      break;
    default:
      throw new Error(`Merge for year ${args.year} not implemented`);
  }

  webWrite(competitors, clubs);
}

main();
