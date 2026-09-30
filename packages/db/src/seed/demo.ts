/**
 * EXAMPLE forecasts for local demos only (`WAYPOINT_SEED_DEMO=true`). Every row is flagged
 * isDemo and shown with an "Example data" label. They illustrate how scoring works and are not
 * a real track record.
 */
import type { forecastPredictions, forecasts } from '../schema';

type DemoForecast = {
  forecast: Omit<typeof forecasts.$inferInsert, 'isDemo'>;
  predictions: Array<Omit<typeof forecastPredictions.$inferInsert, 'forecastId'>>;
};

const day = 86_400_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * day);
const ahead = (days: number) => new Date(now + days * day);

function resolved(
  question: string,
  category: string,
  outcome: 0 | 1,
  probs: number[],
  regions: string[] = ['ZZ'],
): DemoForecast {
  return {
    forecast: {
      question,
      description: 'Example question used to demonstrate forecast scoring.',
      resolutionCriteria: 'Example resolution criteria.',
      category,
      regions,
      opensAt: ago(120),
      closesAt: ago(40),
      resolvesAt: ago(30),
      status: 'resolved',
      outcome,
      resolvedAt: ago(30),
      resolutionNote: 'Example resolution.',
    },
    predictions: probs.map((p, i) => ({
      predictor: 'waypoint',
      probability: p,
      rationale: 'Example prediction.',
      createdAt: ago(110 - i * 20),
    })),
  };
}

export const DEMO_FORECASTS: DemoForecast[] = [
  resolved(
    'Example: Will the city’s monthly job postings for data roles rise over the quarter?',
    'jobs',
    1,
    [0.62, 0.7, 0.78],
  ),
  resolved(
    'Example: Will fuel prices fall by more than 5% this month?',
    'prices',
    0,
    [0.35, 0.28, 0.2],
  ),
  resolved(
    'Example: Will the heatwave warning be extended past Friday?',
    'weather',
    1,
    [0.55, 0.72, 0.85],
  ),
  resolved(
    'Example: Will the new training scholarship open applications before June?',
    'education',
    1,
    [0.8, 0.85, 0.9],
  ),
  resolved(
    'Example: Will reported parcel-scam texts drop after the new filter?',
    'scams',
    0,
    [0.45, 0.4, 0.3],
  ),
  resolved(
    'Example: Will the minimum wage review be published on time?',
    'jobs',
    1,
    [0.6, 0.65, 0.7],
  ),
  resolved('Example: Will the river flood alert reach level 3?', 'weather', 0, [0.3, 0.22, 0.15]),
  resolved(
    'Example: Will interest rates be cut at the next meeting?',
    'money',
    0,
    [0.52, 0.45, 0.38],
  ),
  {
    forecast: {
      question: 'Example: Will warehouse hiring in the region increase next quarter?',
      description: 'Example open question.',
      resolutionCriteria: 'Example resolution criteria.',
      category: 'jobs',
      regions: ['ZZ'],
      opensAt: ago(5),
      closesAt: ahead(60),
      resolvesAt: ahead(90),
      status: 'open',
    },
    predictions: [
      {
        predictor: 'waypoint',
        probability: 0.58,
        rationale: 'Example prediction.',
        createdAt: ago(4),
      },
    ],
  },
];
