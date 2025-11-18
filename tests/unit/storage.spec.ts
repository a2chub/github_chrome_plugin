import {
  getDashboardSnapshot,
  removeDashboardSnapshot,
  saveDashboardSnapshot,
} from '../../src/utils/storage';
import type { CachedDashboardSnapshot } from '../../src/types/settings';
import { resetChromeStorageMock } from '../helpers/chrome-storage-mock';

const sampleSnapshot: CachedDashboardSnapshot = {
  repositories: {
    updatedAt: 1,
    data: [
      {
        organization: 'Personal',
        repositories: [
          {
            id: 101,
            name: 'repo',
            full_name: 'user/repo',
            owner: { login: 'user', type: 'User' },
            html_url: 'https://github.com/user/repo',
            description: null,
            private: false,
            updated_at: '2024-01-01T00:00:00Z',
            pushed_at: '2024-01-01T00:00:00Z',
            stargazers_count: 0,
            language: null,
          },
        ],
      },
    ],
  },
  issues: {
    updatedAt: 2,
    data: [
      {
        id: 202,
        number: 1,
        title: 'Issue',
        state: 'open',
        html_url: 'https://github.com/user/repo/issues/1',
        repository_url: 'https://api.github.com/repos/user/repo',
        user: {
          login: 'user',
          id: 1,
          avatar_url: 'https://github.com/user.png',
          html_url: 'https://github.com/user',
          name: null,
          email: null,
        },
        labels: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ],
  },
  projects: {
    updatedAt: 3,
    data: [
      {
        id: 303,
        name: 'Project',
        body: null,
        state: 'open',
        html_url: 'https://github.com/user/repo/projects/1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        creator: {
          login: 'creator',
          id: 2,
          avatar_url: 'https://github.com/creator.png',
          html_url: 'https://github.com/creator',
          name: null,
          email: null,
        },
      },
    ],
  },
};

describe('dashboard snapshot storage helpers', () => {
  beforeEach(() => {
    resetChromeStorageMock();
  });

  it('saves and returns the snapshot', async () => {
    await saveDashboardSnapshot(sampleSnapshot);
    const snapshot = await getDashboardSnapshot();
    expect(snapshot).toEqual(sampleSnapshot);
  });

  it('removes the stored snapshot', async () => {
    await saveDashboardSnapshot(sampleSnapshot);
    await removeDashboardSnapshot();
    const snapshot = await getDashboardSnapshot();
    expect(snapshot).toBeNull();
  });
});

