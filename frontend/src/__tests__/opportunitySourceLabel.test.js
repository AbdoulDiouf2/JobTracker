import { getOpportunitySourceLabel, getOriginLabel } from '../constants/opportunity';

const watchOpp = (watch) => ({ source: 'chatgpt_watch', watch });

describe('getOpportunitySourceLabel', () => {
  test.each([
    [watchOpp({ client_id: 'jt_oc_1', client_name: 'Claude' }), 'fr', 'Veille Claude'],
    [watchOpp({ client_id: 'jt_oc_2', client_name: 'ChatGPT' }), 'fr', 'Veille ChatGPT'],
    [watchOpp({ client_id: 'jt_oc_3', client_name: '  Agent MAADEC ' }), 'fr', 'Veille Agent MAADEC'],
    [watchOpp({ client_id: 'jt_oc_1', client_name: 'Claude' }), 'en', 'Claude watch'],
    [watchOpp({ client_id: 'jt_oc_4', client_name: null }), 'fr', 'Veille (client inconnu)'],
    [watchOpp({ client_id: 'jt_oc_4', client_name: '' }), 'en', 'Watch (unknown client)'],
    [watchOpp({ run_id: 'veille-x' }), 'fr', 'Veille (antérieure)'], // offre antérieure à P1 : jamais attribuée d'office
    [{ source: 'chatgpt_watch' }, 'en', 'Watch (earlier)'],
    [{ source: 'manual', watch: { client_id: 'jt_oc_1', client_name: 'Claude' } }, 'fr', 'Ajout manuel'],
    [{ source: 'chrome_extension' }, 'fr', 'Extension Chrome'],
    [{ source: 'mon_agent' }, 'fr', 'mon_agent'],
  ])('%# → %s', (opportunity, language, expected) => {
    expect(getOpportunitySourceLabel(opportunity, language)).toBe(expected);
  });
});

describe('getOriginLabel (provenance calculée par le serveur)', () => {
  test.each([
    [{ kind: 'client', key: 'client:jt_oc_1', client_id: 'jt_oc_1', client_name: 'Claude' }, 'Veille Claude'],
    [{ kind: 'client', key: 'client:jt_oc_9', client_id: 'jt_oc_9', client_name: null }, 'Veille (client inconnu)'],
    [{ kind: 'watch_legacy', key: 'watch_legacy' }, 'Veille (antérieure)'],
    [{ kind: 'source', key: 'source:manual', source: 'manual' }, 'Ajout manuel'],
    [null, 'Autre'],
  ])('%# → %s', (origin, expected) => {
    expect(getOriginLabel(origin, 'fr')).toBe(expected);
  });

  test('origin prime sur les champs bruts', () => {
    const opportunity = { source: 'chatgpt_watch', watch: { client_id: 'x', client_name: 'Ancien nom' },
      origin: { kind: 'client', key: 'client:x', client_id: 'x', client_name: 'Nom actuel' } };
    expect(getOpportunitySourceLabel(opportunity, 'fr')).toBe('Veille Nom actuel');
  });
});
