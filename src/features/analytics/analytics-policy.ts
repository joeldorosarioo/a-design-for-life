export type AnalyticsPolicyContext = {
  environment: string;
  area: string;
  preview: boolean;
};

/** The public release gate is an additional runtime requirement, not an environment. */
export function canMeasure({ environment, area, preview }: AnalyticsPolicyContext): boolean {
  return environment === 'production' && area === 'public' && preview === false;
}
