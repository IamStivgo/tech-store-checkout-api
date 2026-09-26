// Prints the Jest coverage totals as a Markdown table for the GitHub Actions job summary.
import { readFileSync } from 'node:fs';

const { total } = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const metrics = ['statements', 'branches', 'functions', 'lines'];

console.log(
  [
    '### Coverage',
    '',
    '| Metric | Coverage | Covered |',
    '| --- | --- | --- |',
    ...metrics.map(
      (metric) =>
        `| ${metric} | ${total[metric].pct} % | ${total[metric].covered} / ${total[metric].total} |`,
    ),
  ].join('\n'),
);
