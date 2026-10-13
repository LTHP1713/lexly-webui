/**
 * DEVELOPMENT-ONLY sample data for visually checking the Home dashboard's states before the
 * backend endpoints exist. Enabled only with `VITE_HOME_MOCKS=populated|empty|error|loading` in a
 * dev server; production builds never load this module (see `homeMockMode`). Every component
 * rendering this data shows a visible "Sample data" badge — it is never presented as real progress.
 */
import { ApiError } from '@/api/client';
import type { HomeMockMode } from '@/config/features';
import type { BareActProgressItem, ContinueLearningItem } from '@/api/users';
import { toBareActProgressItems, toContinueLearningItem } from '@/api/users';

const populated = {
  bareActs: toBareActProgressItems({
    acts: [
      {
        actId: 'sample-coi',
        actName: 'Constitution of India',
        shortCode: 'COI',
        totalSections: 448,
        completedSections: 322,
        completionPercentage: 71.88,
        lastSectionId: 'sample-a21',
        lastSectionNumber: '21',
        lastSectionTitle: 'Protection of life and personal liberty',
        lastAccessedAt: '2026-10-05T18:42:31Z',
      },
      {
        actId: 'sample-ica',
        actName: 'Indian Contract Act, 1872',
        shortCode: 'ICA',
        totalSections: 238,
        completedSections: 114,
        completionPercentage: 47.9,
        lastSectionId: 'sample-s31',
        lastSectionNumber: '31',
        lastSectionTitle: '"Contingent contract" defined',
        lastAccessedAt: '2026-10-04T09:12:00Z',
      },
      {
        actId: 'sample-bns',
        actName: 'Bharatiya Nyaya Sanhita, 2023 (a deliberately long act name to check wrapping)',
        shortCode: 'BNS',
        totalSections: 358,
        completedSections: 125,
        completionPercentage: 34.9,
        lastSectionId: null,
        lastSectionNumber: null,
        lastSectionTitle: null,
        lastAccessedAt: '2026-10-01T09:12:00Z',
      },
    ],
  }),
  continueLearning: toContinueLearningItem({
    type: 'SECTION',
    id: 'sample-a14',
    subject: 'Constitutional Law',
    title: 'Article 14',
    subtitle: 'Equality before law',
    progressPercentage: 72,
    navigationPath: null,
    lastAccessedAt: '2026-10-05T18:42:31Z',
  }),
};

const empty = {
  bareActs: [] as BareActProgressItem[],
  continueLearning: null as ContinueLearningItem | null,
};

export interface HomeMockData {
  bareActs: BareActProgressItem[];
  continueLearning: ContinueLearningItem | null;
}

/** Resolves (or rejects / never settles) like a real request would, after a short delay. */
export function mockFetch<K extends keyof HomeMockData>(mode: HomeMockMode, key: K): Promise<HomeMockData[K]> {
  if (mode === 'loading') return new Promise(() => {});
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (mode === 'error') {
        reject(new ApiError('INTERNAL_ERROR', 'Sample error: the server could not load this.', 500));
      } else {
        resolve((mode === 'empty' ? empty : populated)[key] as HomeMockData[K]);
      }
    }, 600);
  });
}
