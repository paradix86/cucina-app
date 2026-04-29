import { describe, it, expect } from 'vitest';
import { inferImportFailureStage } from '../../src/lib/import/web';

describe('inferImportFailureStage', () => {
  it('maps WEB_TIMEOUT error to fetch-readable-page stage', () => {
    expect(inferImportFailureStage('WEB_TIMEOUT')).toBe('fetch-readable-page');
  });

  it('maps WEB_FETCH_* HTTP error codes to fetch-readable-page stage', () => {
    const fetchErrors = [
      'WEB_FETCH_404',
      'WEB_FETCH_500',
      'WEB_FETCH_403',
      'WEB_FETCH_502',
      'WEB_FETCH_503',
    ];
    fetchErrors.forEach(err => {
      expect(inferImportFailureStage(err)).toBe('fetch-readable-page');
    });
  });

  it('maps HTTP * errors to fetch-readable-page stage', () => {
    expect(inferImportFailureStage('HTTP 404 Not Found')).toBe('fetch-readable-page');
    expect(inferImportFailureStage('HTTP 500')).toBe('fetch-readable-page');
  });

  it('maps UNSUPPORTED_WEB_IMPORT to select-adapter stage', () => {
    expect(inferImportFailureStage('UNSUPPORTED_WEB_IMPORT')).toBe('select-adapter');
  });

  it('maps parse-related errors to parse-content stage', () => {
    const parseErrors = [
      'PARSE_FAILED',
      'INVALID_JSON',
      'MALFORMED_HTML',
    ];
    parseErrors.forEach(err => {
      expect(inferImportFailureStage(err)).toBe('parse-content');
    });
  });

  it('defaults unknown errors to parse-content stage', () => {
    expect(inferImportFailureStage('SOMETHING_RANDOM')).toBe('parse-content');
    expect(inferImportFailureStage('')).toBe('parse-content');
  });

  it('distinguishes parse vs fetch errors correctly', () => {
    expect(inferImportFailureStage('WEB_FETCH_404')).toBe('fetch-readable-page');
    expect(inferImportFailureStage('PARSE_FAILED_404')).toBe('parse-content');
  });

  it('maps "//" marker error messages to parse-content', () => {
    expect(inferImportFailureStage('DUEMME_PARSE_MARKER_//')).toBe('parse-content');
  });

  it('maps Varoma marker errors to parse-content stage', () => {
    expect(inferImportFailureStage('BIMBY_VAROMA_UNSUPPORTED')).toBe('parse-content');
  });
});
