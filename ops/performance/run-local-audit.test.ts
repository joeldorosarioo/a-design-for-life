import { expect, it } from 'vitest';
import profiles from './profiles.json';
import { measurementPlan, metricSummary } from './run-local-audit.mjs';

const targets = ['home', 'cases', 'case', 'about'].flatMap((kind) =>
  ['pt', 'en'].map((locale) => ({
    id: `${kind}-${locale}`,
    kind,
    locale,
    path: `/${locale}/${kind}`,
  })),
);

it('plans three independent measurements for all twelve page, language and device scenarios', () => {
  const plan: {
    target: { id: string };
    profile: { id: string };
    repeat: number;
  }[] = measurementPlan(profiles, targets);
  expect(plan).toHaveLength(36);
  expect(new Set(plan.map(({ target, profile }) => `${target.id}-${profile.id}`)).size).toBe(12);
  expect(plan.every(({ repeat }) => repeat >= 1 && repeat <= 3)).toBe(true);
});

it('rejects missing and duplicated locale targets before measuring', () => {
  expect(() => measurementPlan(profiles, targets.slice(1))).toThrow();
  expect(() => measurementPlan(profiles, [...targets, targets[0]])).toThrow();
});

it('reports median and variation while requiring all three finite nonnegative measurements', () => {
  expect(metricSummary([4, 1, 2])).toEqual({ median: 2, min: 1, max: 4, runs: 3 });
  expect(() => metricSummary([1, 2])).toThrow();
  expect(() => metricSummary([1, Number.NaN, 3])).toThrow();
  expect(() => metricSummary([1, -1, 3])).toThrow();
});
