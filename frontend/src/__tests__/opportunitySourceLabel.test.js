import { getOpportunitySourceLabel } from '../constants/opportunity';

const watchOpp = (watch) => ({ source: 'chatgpt_watch', watch });

describe('getOpportunitySourceLabel', () => {
  test.each([
    [watchOpp({ client_id: 'jt_oc_1', client_name: 'Claude' }), 'fr', 'Veille Claude'],
    [watchOpp({ client_id: 'jt_oc_2', client_name: 'ChatGPT' }), 'fr', 'Veille ChatGPT'],
    [watchOpp({ client_id: 'jt_oc_3', client_name: '  Agent MAADEC ' }), 'fr', 'Veille Agent MAADEC'],
    [watchOpp({ client_id: 'jt_oc_1', client_name: 'Claude' }), 'en', 'Claude watch'],
    [watchOpp({ client_id: 'jt_oc_4', client_name: null }), 'fr', 'Veille (client inconnu)'],
    [watchOpp({ client_id: 'jt_oc_4', client_name: '' }), 'en', 'Watch (unknown client)'],
    [watchOpp({ run_id: 'veille-x' }), 'fr', 'Veille ChatGPT'], // offre antérieure à P1
    [{ source: 'chatgpt_watch' }, 'en', 'ChatGPT watch'],
    [{ source: 'manual', watch: { client_id: 'jt_oc_1', client_name: 'Claude' } }, 'fr', 'Ajout manuel'],
    [{ source: 'chrome_extension' }, 'fr', 'Extension Chrome'],
    [{ source: 'mon_agent' }, 'fr', 'mon_agent'],
  ])('%# → %s', (opportunity, language, expected) => {
    expect(getOpportunitySourceLabel(opportunity, language)).toBe(expected);
  });
});
