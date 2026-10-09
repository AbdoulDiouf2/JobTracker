import { useEffect, useState } from 'react';
import { ArrowDownUp, ChevronDown, Globe2, Radar, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { getOriginLabel } from '../../constants/opportunity';
import { SCORE_PRESETS, SORT_VALUES, advancedCount, hasActiveFilters } from '../../lib/opportunityFilters';

const T = {
  fr: {
    origin: 'Origine', country: 'Pays', all: 'Toutes', allCountries: 'Tous', more: 'Plus de filtres',
    reset: 'Réinitialiser', results: (n) => `${n} offre${n > 1 ? 's' : ''}`,
    advancedTitle: 'Filtres avancés', advancedText: 'Les résultats se mettent à jour immédiatement.',
    score: 'Pertinence', period: 'Date de découverte', contract: 'Contrat', seniority: 'Séniorité',
    location: 'Ville / région', locationPlaceholder: 'Paris, Genève, Bruxelles…', sort: 'Trier par',
    show: (n) => `Voir ${n} offre${n > 1 ? 's' : ''}`, from: 'Du', to: 'Au',
    periods: { '': 'Toutes', today: "Aujourd'hui", '7d': '7 derniers jours', '30d': '30 derniers jours', custom: 'Période personnalisée' },
    sorts: { discovered: 'Date de découverte', relevance: 'Pertinence', company: 'Entreprise' },
    contracts: { permanent: 'CDI / permanent', fixed_term: 'CDD', freelance: 'Freelance', internship: 'Stage', apprenticeship: 'Alternance' },
    seniorities: { junior: 'Junior', entry_level: 'Débutant', graduate: 'Jeune diplômé', mid: 'Confirmé' },
    noValue: 'Aucune valeur disponible', remove: (label) => `Retirer le filtre ${label}`,
    activeFilters: 'Filtres actifs', unrecognized: (n) => `${n} offre(s) sans pays reconnu`,
    scoreLabel: (k) => `Pertinence ${k.replace('-', '–')}`, locationChip: (v) => `Lieu : ${v}`, searchChip: (v) => `« ${v} »`,
  },
  en: {
    origin: 'Origin', country: 'Country', all: 'All', allCountries: 'All', more: 'More filters',
    reset: 'Reset', results: (n) => `${n} offer${n > 1 ? 's' : ''}`,
    advancedTitle: 'Advanced filters', advancedText: 'Results update immediately.',
    score: 'Relevance', period: 'Discovery date', contract: 'Contract', seniority: 'Seniority',
    location: 'City / region', locationPlaceholder: 'Paris, Geneva, Brussels…', sort: 'Sort by',
    show: (n) => `Show ${n} offer${n > 1 ? 's' : ''}`, from: 'From', to: 'To',
    periods: { '': 'All', today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom range' },
    sorts: { discovered: 'Discovery date', relevance: 'Relevance', company: 'Company' },
    contracts: { permanent: 'Permanent', fixed_term: 'Fixed-term', freelance: 'Freelance', internship: 'Internship', apprenticeship: 'Apprenticeship' },
    seniorities: { junior: 'Junior', entry_level: 'Entry level', graduate: 'Graduate', mid: 'Mid level' },
    noValue: 'No value available', remove: (label) => `Remove filter ${label}`,
    activeFilters: 'Active filters', unrecognized: (n) => `${n} offer(s) without a recognized country`,
    scoreLabel: (k) => `Relevance ${k.replace('-', '–')}`, locationChip: (v) => `Location: ${v}`, searchChip: (v) => `“${v}”`,
  },
};

/** Nom du pays dans la langue de l'interface (code ISO en repli). */
export const countryName = (code, language) => {
  try {
    return new Intl.DisplayNames([language === 'en' ? 'en' : 'fr'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

const ChoiceChip = ({ selected, onClick, children, testId }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={selected}
    onClick={onClick}
    className={`min-h-9 px-3 rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60
      ${selected ? 'border-gold/50 bg-gold/15 text-gold' : 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'}`}
    data-testid={testId}
  >
    {children}
  </button>
);

const RadioChip = ({ selected, onClick, children, testId }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onClick}
    className={`min-h-9 px-3 rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60
      ${selected ? 'border-gold/50 bg-gold/15 text-gold' : 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'}`}
    data-testid={testId}
  >
    {children}
  </button>
);

/** Filtre rapide multi-sélection (popover avec cases à cocher). */
const QuickFilter = ({ icon: Icon, label, allLabel, options, selected, onChange, testId, t }) => {
  const summary = selected.length === 0 ? allLabel
    : selected.length === 1 ? (options.find((o) => o.key === selected[0])?.label || selected[0])
      : `${selected.length}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 border-slate-700 bg-slate-900/50 text-slate-200 justify-between min-w-0 transition-colors"
          aria-label={`${label} : ${summary}`} data-testid={`${testId}-trigger`}>
          <Icon size={14} aria-hidden="true" />
          <span className="text-slate-400">{label}</span>
          <span className={`truncate max-w-[9rem] ${selected.length ? 'text-gold' : ''}`}>{summary}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] bg-[#0a0f1a] border-slate-800 p-2" data-testid={`${testId}-menu`}>
        {options.length === 0 ? (
          <p className="text-sm text-slate-500 p-2">{t.noValue}</p>
        ) : (
          <ul className="flex flex-col max-h-72 overflow-y-auto" role="group" aria-label={label}>
            {options.map((o) => (
              <li key={o.key}>
                <label className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-800/60 cursor-pointer text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#c4a052]"
                    checked={selected.includes(o.key)}
                    onChange={() => onChange(toggle(selected, o.key))}
                    data-testid={`${testId}-option-${o.key}`}
                  />
                  <span className="flex-1 break-words">{o.label}</span>
                  <span className="text-xs text-slate-500 tabular-nums">{o.count}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

/**
 * Barre de filtres : filtres rapides (Origine, Pays), panneau « Plus de filtres » (Sheet),
 * pastilles supprimables, réinitialisation et compteur. Aucune logique métier ici :
 * l'état vient de l'URL (page) et les valeurs proposées des facettes du compte.
 */
export const OpportunityFilters = ({ filters, onChange, onReset, facets, total, language }) => {
  const t = T[language] || T.fr;
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState(filters.location);

  // Saisie du lieu : mise à jour différée de l'URL
  useEffect(() => { setLocation(filters.location); }, [filters.location]);
  useEffect(() => {
    if (location === filters.location) return undefined;
    const timer = setTimeout(() => onChange({ location }), 300);
    return () => clearTimeout(timer);
  }, [location, filters.location, onChange]);

  const originOptions = (facets?.origins ?? []).map((o) => ({ key: o.key, label: getOriginLabel(o, language), count: o.count }));
  const countryOptions = (facets?.countries ?? []).map((c) => ({ key: c.key, label: countryName(c.key, language), count: c.count }));
  const contractOptions = (facets?.contracts ?? []).filter((c) => t.contracts[c.key]);
  const seniorityOptions = (facets?.seniorities ?? []).filter((s) => t.seniorities[s.key]);

  const labelOf = (options, key) => options.find((o) => o.key === key)?.label || key;
  const chips = [
    ...(filters.q.trim() ? [{ id: 'q', label: t.searchChip(filters.q.trim()), remove: { q: '' } }] : []),
    ...filters.origin.map((k) => ({ id: `origin-${k}`, label: labelOf(originOptions, k), remove: { origin: filters.origin.filter((v) => v !== k) } })),
    ...filters.country.map((k) => ({ id: `country-${k}`, label: countryName(k, language), remove: { country: filters.country.filter((v) => v !== k) } })),
    ...(filters.score ? [{ id: 'score', label: t.scoreLabel(filters.score), remove: { score: '' } }] : []),
    ...(filters.period ? [{
      id: 'period',
      label: filters.period === 'custom'
        ? `${t.from} ${filters.from || '…'} ${t.to.toLowerCase()} ${filters.to || '…'}` : t.periods[filters.period],
      remove: { period: '', from: '', to: '' },
    }] : []),
    ...filters.contract.map((k) => ({ id: `contract-${k}`, label: t.contracts[k], remove: { contract: filters.contract.filter((v) => v !== k) } })),
    ...filters.seniority.map((k) => ({ id: `seniority-${k}`, label: t.seniorities[k], remove: { seniority: filters.seniority.filter((v) => v !== k) } })),
    ...(filters.location.trim() ? [{ id: 'location', label: t.locationChip(filters.location.trim()), remove: { location: '' } }] : []),
  ];
  const count = advancedCount(filters);
  const showReset = hasActiveFilters(filters) || filters.sort !== 'discovered';

  return (
    <div className="flex flex-col gap-3" data-testid="opportunity-filters">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <QuickFilter icon={Radar} label={t.origin} allLabel={t.all} options={originOptions} selected={filters.origin}
          onChange={(origin) => onChange({ origin })} testId="filter-origin" t={t} />
        <QuickFilter icon={Globe2} label={t.country} allLabel={t.allCountries} options={countryOptions} selected={filters.country}
          onChange={(country) => onChange({ country })} testId="filter-country" t={t} />
        <Button variant="outline" onClick={() => setOpen(true)}
          className="col-span-2 sm:col-span-1 h-10 border-slate-700 bg-slate-900/50 text-slate-200 transition-colors"
          aria-label={count ? `${t.more} (${count})` : t.more} data-testid="filter-more">
          <SlidersHorizontal size={14} aria-hidden="true" />
          {t.more}
          {count > 0 && <span className="ml-1 px-1.5 rounded-full bg-gold text-[#020817] text-xs font-semibold">{count}</span>}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-400 mr-1" aria-live="polite" data-testid="opportunity-count">
          {typeof total === 'number' ? t.results(total) : ''}
        </p>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={t.activeFilters} data-testid="filter-chips">
            {chips.map((chip) => (
              <li key={chip.id}>
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-xs">
                  <span className="break-all">{chip.label}</span>
                  <button type="button" onClick={() => onChange(chip.remove)} aria-label={t.remove(chip.label)}
                    className="p-1 rounded-full hover:bg-gold/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                    data-testid={`filter-chip-remove-${chip.id}`}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {showReset && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-slate-400 hover:text-white transition-colors"
            data-testid="filter-reset">
            <RotateCcw size={14} aria-hidden="true" />
            {t.reset}
          </Button>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#0a0f1a] border-slate-800 text-white overflow-y-auto"
          data-testid="filter-sheet">
          <SheetHeader className="text-left">
            <SheetTitle className="font-heading text-white">{t.advancedTitle}</SheetTitle>
            <SheetDescription className="text-slate-400">{t.advancedText}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 py-6">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-slate-200 mb-2">{t.score}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.score}>
                <RadioChip selected={!filters.score} onClick={() => onChange({ score: '' })} testId="filter-score-all">{t.all}</RadioChip>
                {SCORE_PRESETS.map((p) => (
                  <RadioChip key={p.key} selected={filters.score === p.key} onClick={() => onChange({ score: p.key })}
                    testId={`filter-score-${p.key}`}>{p.key.replace('-', '–')}</RadioChip>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-slate-200 mb-2">{t.period}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.period}>
                {['', 'today', '7d', '30d', 'custom'].map((p) => (
                  <RadioChip key={p || 'all'} selected={filters.period === p}
                    onClick={() => onChange(p === 'custom' ? { period: p } : { period: p, from: '', to: '' })}
                    testId={`filter-period-${p || 'all'}`}>{t.periods[p]}</RadioChip>
                ))}
              </div>
              {filters.period === 'custom' && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="filter-from" className="text-xs text-slate-400">{t.from}</Label>
                    <Input id="filter-from" type="date" value={filters.from} max={filters.to || undefined}
                      onChange={(e) => onChange({ from: e.target.value })}
                      className="h-10 bg-slate-900/50 border-slate-700 text-white" data-testid="filter-from" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="filter-to" className="text-xs text-slate-400">{t.to}</Label>
                    <Input id="filter-to" type="date" value={filters.to} min={filters.from || undefined}
                      onChange={(e) => onChange({ to: e.target.value })}
                      className="h-10 bg-slate-900/50 border-slate-700 text-white" data-testid="filter-to" />
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-slate-200 mb-2">{t.contract}</legend>
              {contractOptions.length === 0 ? <p className="text-sm text-slate-500">{t.noValue}</p> : (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t.contract}>
                  {contractOptions.map((c) => (
                    <ChoiceChip key={c.key} selected={filters.contract.includes(c.key)}
                      onClick={() => onChange({ contract: toggle(filters.contract, c.key) })}
                      testId={`filter-contract-${c.key}`}>{t.contracts[c.key]} <span className="text-slate-500">{c.count}</span></ChoiceChip>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-slate-200 mb-2">{t.seniority}</legend>
              {seniorityOptions.length === 0 ? <p className="text-sm text-slate-500">{t.noValue}</p> : (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t.seniority}>
                  {seniorityOptions.map((s) => (
                    <ChoiceChip key={s.key} selected={filters.seniority.includes(s.key)}
                      onClick={() => onChange({ seniority: toggle(filters.seniority, s.key) })}
                      testId={`filter-seniority-${s.key}`}>{t.seniorities[s.key]} <span className="text-slate-500">{s.count}</span></ChoiceChip>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-location" className="text-sm font-medium text-slate-200">{t.location}</Label>
              <Input id="filter-location" type="search" value={location} maxLength={100} autoComplete="off"
                onChange={(e) => setLocation(e.target.value)} placeholder={t.locationPlaceholder}
                className="h-10 bg-slate-900/50 border-slate-700 text-white" data-testid="filter-location" />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-2">
                <ArrowDownUp size={14} aria-hidden="true" />{t.sort}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.sort}>
                {SORT_VALUES.map((s) => (
                  <RadioChip key={s} selected={filters.sort === s} onClick={() => onChange({ sort: s })}
                    testId={`filter-sort-${s}`}>{t.sorts[s]}</RadioChip>
                ))}
              </div>
            </fieldset>

            {facets?.countries_unrecognized > 0 && (
              <p className="text-xs text-slate-500">{t.unrecognized(facets.countries_unrecognized)}</p>
            )}
          </div>

          <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-[#0a0f1a] border-t border-slate-800 flex gap-2">
            <Button variant="ghost" onClick={onReset} className="flex-1 h-11 text-slate-300 transition-colors" data-testid="filter-sheet-reset">
              {t.reset}
            </Button>
            <Button onClick={() => setOpen(false)} className="flex-1 h-11 bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
              data-testid="filter-sheet-close">
              {typeof total === 'number' ? t.show(total) : t.advancedTitle}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
