import {
  DEFAULT_FILTERS, advancedCount, hasActiveFilters, parisDate, parseFilters, periodRange, toApiParams, toSearchParams,
} from '../lib/opportunityFilters';

const parse = (qs) => parseFilters(new URLSearchParams(qs));

describe('opportunityFilters — URL', () => {
  test('aller-retour URL -> état -> URL', () => {
    const qs = 'status=new&q=data&origin=client%3Ajt_oc_1&origin=watch_legacy&country=CH&score=85-94'
      + '&period=custom&from=2026-10-01&to=2026-10-09&contract=permanent&seniority=junior&location=Gen%C3%A8ve'
      + '&sort=relevance&page=3';
    const state = parse(qs);
    expect(state).toEqual({
      status: 'new', q: 'data', origin: ['client:jt_oc_1', 'watch_legacy'], country: ['CH'], score: '85-94',
      period: 'custom', from: '2026-10-01', to: '2026-10-09', contract: ['permanent'], seniority: ['junior'],
      location: 'Genève', sort: 'relevance', page: 3,
    });
    expect(parse(toSearchParams(state).toString())).toEqual(state);
  });

  test('valeurs par défaut omises : URL vide', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(parse('')).toEqual({ ...DEFAULT_FILTERS });
  });

  test('valeurs invalides ignorées, doublons retirés', () => {
    const state = parse('status=x&origin=evil&origin=source%3Achatgpt_watch&origin=watch_legacy&origin=watch_legacy'
      + '&country=FRA&country=fr&country=BE&score=50-60&period=week&from=2026-10-01&contract=cdi&seniority=senior'
      + '&sort=price&page=-2');
    expect(state).toEqual({ ...DEFAULT_FILTERS, origin: ['watch_legacy'], country: ['BE'] });
  });

  test('dates personnalisées conservées seulement pour period=custom', () => {
    expect(parse('period=7d&from=2026-10-01&to=2026-10-09')).toMatchObject({ period: '7d', from: '', to: '' });
    expect(parse('period=custom&from=2026-13-40x')).toMatchObject({ period: 'custom', from: '' });
  });
});

describe('opportunityFilters — paramètres d’API', () => {
  const now = new Date('2026-10-10T21:30:00Z'); // 23:30 à Paris (UTC+2)

  test('jours de Paris (bornes incluses)', () => {
    expect(parisDate(0, now)).toBe('2026-10-10');
    expect(parisDate(0, new Date('2026-10-10T22:30:00Z'))).toBe('2026-10-11'); // minuit passé à Paris
    expect(periodRange({ period: 'today' }, now)).toEqual({ from: '2026-10-10', to: '' });
    expect(periodRange({ period: '7d' }, now)).toEqual({ from: '2026-10-04', to: '' });
    expect(periodRange({ period: '30d' }, now)).toEqual({ from: '2026-09-11', to: '' });
    expect(periodRange({ period: 'custom', from: '2026-10-01', to: '2026-10-02' }, now))
      .toEqual({ from: '2026-10-01', to: '2026-10-02' });
  });

  test('conversion complète', () => {
    const state = parse('status=ignored&q=%20spark%20&origin=client%3Ajt_oc_1&country=CH&score=95-100&period=7d'
      + '&contract=permanent&seniority=junior&location=Lyon&sort=company&page=2');
    expect(toApiParams(state, 20, now)).toEqual({
      page: 2, per_page: 20, status: 'ignored', search: 'spark', origin: ['client:jt_oc_1'], country: ['CH'],
      min_score: 95, max_score: 100, discovered_from: '2026-10-04', contract: ['permanent'], seniority: ['junior'],
      location: 'Lyon', sort: 'company',
    });
    expect(toApiParams(DEFAULT_FILTERS, 20, now)).toEqual({ page: 1, per_page: 20 });
  });

  test('compteurs de filtres', () => {
    expect(advancedCount(parse('score=75-84&period=today&contract=permanent&contract=fixed_term&sort=relevance'))).toBe(5);
    expect(hasActiveFilters(parse('sort=relevance&status=new'))).toBe(false);
    expect(hasActiveFilters(parse('country=FR'))).toBe(true);
  });
});
