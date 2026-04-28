import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { resetStorageAdapter } from '../../src/lib/storage';
import { t } from '../../src/lib/i18n';
import { useImportFlow } from '../../src/composables/useImportFlow';

const {
  fetchReadableImportPageMock,
  inferImportFailureStageMock,
  getImportAdapterForUrlMock,
  importWebsiteRecipeWithFallbacksMock,
  suggestImportTagsMock,
} = vi.hoisted(() => ({
  fetchReadableImportPageMock: vi.fn(),
  inferImportFailureStageMock: vi.fn(),
  getImportAdapterForUrlMock: vi.fn(),
  importWebsiteRecipeWithFallbacksMock: vi.fn(),
  suggestImportTagsMock: vi.fn(),
}));

vi.mock('../../src/lib/import/web', () => ({
  fetchReadableImportPage: fetchReadableImportPageMock,
  inferImportFailureStage: inferImportFailureStageMock,
  extractPageHeadingsHint: () => null,
}));

vi.mock('../../src/lib/import/adapters', () => ({
  getImportAdapterForUrl: getImportAdapterForUrlMock,
  importWebsiteRecipeWithFallbacks: importWebsiteRecipeWithFallbacksMock,
  suggestImportTags: suggestImportTagsMock,
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  globalThis.localStorage = localStorageMock as unknown as Storage;
  localStorageMock.clear();
  resetStorageAdapter();
  setActivePinia(createPinia());

  fetchReadableImportPageMock.mockReset();
  inferImportFailureStageMock.mockReset();
  getImportAdapterForUrlMock.mockReset();
  importWebsiteRecipeWithFallbacksMock.mockReset();
  suggestImportTagsMock.mockReset();

  inferImportFailureStageMock.mockReturnValue('fetch-readable-page');
  getImportAdapterForUrlMock.mockReturnValue({ domain: 'mock.example' });
  suggestImportTagsMock.mockReturnValue([ 'web-import' ]);
});

describe('useImportFlow stability feedback', () => {
  it('shows explicit timeout error state for dead/slow URL imports', async () => {
    fetchReadableImportPageMock.mockRejectedValue(new Error('WEB_TIMEOUT'));
    inferImportFailureStageMock.mockReturnValue('fetch-readable-page');

    const flow = useImportFlow();
    flow.url.value = 'https://example.com/slow-recipe';
    const ok = await flow.importRecipeFromUrl();

    expect(ok).toBe(false);
    expect(flow.status.value.type).toBe('err');
    expect(flow.status.value.message).toBe(t('import_error_timeout'));
    expect(flow.diagnostic.value?.stage).toBe('fetch-readable-page');
  });

  it('surfaces unsupported-web import failure clearly', async () => {
    fetchReadableImportPageMock.mockResolvedValue('# Generic page');
    importWebsiteRecipeWithFallbacksMock.mockRejectedValue(new Error('UNSUPPORTED_WEB_IMPORT'));
    inferImportFailureStageMock.mockReturnValue('select-adapter');

    const flow = useImportFlow();
    flow.url.value = 'https://unsupported.example.com/page';
    const ok = await flow.importRecipeFromUrl();

    expect(ok).toBe(false);
    expect(flow.status.value.type).toBe('err');
    expect(flow.status.value.message).toBe(t('import_error_web_blocked'));
    expect(flow.diagnostic.value?.stage).toBe('select-adapter');
  });

  it('keeps successful web import flow intact', async () => {
    fetchReadableImportPageMock.mockResolvedValue('# Recipe markdown');
    importWebsiteRecipeWithFallbacksMock.mockResolvedValue({
      id: 'imp-1',
      name: 'Imported Recipe',
      source: 'web',
      sourceDomain: 'example.com',
      ingredients: [ '200 g pasta' ],
      steps: [ 'Cook pasta' ],
      tags: [],
      preparationType: 'classic',
    });

    const flow = useImportFlow();
    flow.url.value = 'https://example.com/recipe';
    const ok = await flow.importRecipeFromUrl();

    expect(ok).toBe(true);
    expect(flow.status.value.type).toBe('ok');
    expect(flow.status.value.message).toBe(t('import_success'));
    expect(flow.previewRecipe.value?.name).toBe('Imported Recipe');
    expect(flow.previewRecipe.value?.tags).toEqual([ 'web-import' ]);
  });
});
