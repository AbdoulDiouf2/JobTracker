import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, Search, ChevronLeft, ChevronRight, AlertTriangle, SearchX, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useOpportunities, useOpportunityActions, useOpportunityFacets } from '../hooks/useOpportunities';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { OpportunityCard } from '../components/opportunities/OpportunityCard';
import { OpportunityDetailDialog } from '../components/opportunities/OpportunityDetailDialog';
import { OpportunityFilters } from '../components/opportunities/OpportunityFilters';
import { OPPORTUNITY_FILTERS } from '../constants/opportunity';
import { DEFAULT_FILTERS, hasActiveFilters, parseFilters, toApiParams, toSearchParams } from '../lib/opportunityFilters';

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const T = {
  fr: {
    title: 'Opportunités',
    subtitle: 'Offres repérées pour vous, pas encore candidatées.',
    filterLabel: 'Filtrer par statut',
    searchLabel: 'Rechercher par poste ou entreprise',
    searchPlaceholder: 'Rechercher un poste, une entreprise…',
    emptyTitle: 'Aucune opportunité pour le moment',
    emptyText: 'Les offres détectées par vos outils et agents apparaîtront ici.',
    noResultTitle: 'Aucun résultat',
    noResultText: 'Modifiez la recherche ou le filtre.',
    resetFilters: 'Réinitialiser les filtres',
    error: 'Impossible de charger les opportunités.',
    retry: 'Réessayer',
    previous: 'Page précédente',
    next: 'Page suivante',
    page: (p, n) => `Page ${p} sur ${n}`,
    ignored: 'Opportunité ignorée',
    undo: 'Annuler',
    ignoreError: "Impossible d'ignorer cette opportunité.",
    converted: 'Candidature créée — statut « À postuler »',
    alreadyConverted: 'Candidature déjà créée pour cette offre',
    convertInProgress: 'Cette candidature est déjà en cours de création. Réessayez dans quelques secondes.',
    convertNotFound: "Cette opportunité n'existe plus.",
    convertError: 'Impossible de créer la candidature. Réessayez.',
  },
  en: {
    title: 'Opportunities',
    subtitle: "Offers found for you that you haven't applied to yet.",
    filterLabel: 'Filter by status',
    searchLabel: 'Search by position or company',
    searchPlaceholder: 'Search a position, a company…',
    emptyTitle: 'No opportunities yet',
    emptyText: 'Offers detected by your tools and agents will appear here.',
    noResultTitle: 'No results',
    noResultText: 'Change the search or the filter.',
    resetFilters: 'Reset filters',
    error: 'Unable to load opportunities.',
    retry: 'Retry',
    previous: 'Previous page',
    next: 'Next page',
    page: (p, n) => `Page ${p} of ${n}`,
    ignored: 'Opportunity ignored',
    undo: 'Undo',
    ignoreError: 'Unable to ignore this opportunity.',
    converted: 'Application created — status "To apply"',
    alreadyConverted: 'Application already created for this offer',
    convertInProgress: 'This application is already being created. Try again in a few seconds.',
    convertNotFound: 'This opportunity no longer exists.',
    convertError: 'Unable to create the application. Please try again.',
  },
};

export default function OpportunitiesPage() {
  const { language } = useLanguage();
  const t = T[language];
  const navigate = useNavigate();

  // L'URL est la source de vérité des filtres, du tri et de la page : l'état est conservé
  // lors de la navigation (ex. vers une candidature) et restauré au retour arrière.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(filters.q);
  const [selected, setSelected] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [ignoringId, setIgnoringId] = useState(null);

  /** Met à jour l'URL ; tout changement de filtre revient à la première page. */
  const updateFilters = useCallback((partial) => {
    setSearchParams((prev) => {
      const current = parseFilters(prev);
      return toSearchParams({ ...current, ...partial, page: partial.page ?? 1 });
    }, { replace: true });
  }, [setSearchParams]);
  const resetFilters = useCallback(() => {
    setSearchInput('');
    setSearchParams((prev) => toSearchParams({ ...DEFAULT_FILTERS, status: parseFilters(prev).status }), { replace: true });
  }, [setSearchParams]);

  // Champ de recherche : saisie locale, URL mise à jour après une courte pause
  useEffect(() => { setSearchInput(filters.q); }, [filters.q]);
  useEffect(() => {
    if (searchInput.trim() === filters.q.trim()) return undefined;
    const timer = setTimeout(() => updateFilters({ q: searchInput }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, filters.q, updateFilters]);

  const params = useMemo(() => toApiParams(filters, PER_PAGE), [filters]);
  const { data, isLoading, isError, refetch } = useOpportunities(params);
  const { data: facets } = useOpportunityFacets();
  const { ignore, restore, convert } = useOpportunityActions();

  const items = data?.items ?? [];
  const page = filters.page;
  const totalPages = data?.total_pages ?? 0;
  const isFiltered = filters.status !== 'all' || hasActiveFilters(filters);

  // Garder le détail synchronisé avec la liste (statut mis à jour après action)
  const selectedFresh = selected ? items.find(o => o.id === selected.id) || selected : null;

  const goToApplication = (applicationId) => {
    navigate(`/dashboard/applications?id=${encodeURIComponent(applicationId)}`);
  };

  const handleConvert = async (opportunity) => {
    if (convertingId) return; // anti double clic
    setConvertingId(opportunity.id);
    try {
      const result = await convert.mutateAsync(opportunity.id);
      toast.success(result.created ? t.converted : t.alreadyConverted);
      goToApplication(result.application_id);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        toast.error(t.convertInProgress, {
          action: { label: t.retry, onClick: () => handleConvert(opportunity) },
        });
      } else if (status === 404) {
        toast.error(t.convertNotFound);
        setSelected(null);
        refetch();
      } else {
        toast.error(t.convertError);
      }
    } finally {
      setConvertingId(null);
    }
  };

  const handleIgnore = async (opportunity) => {
    if (ignoringId) return;
    setIgnoringId(opportunity.id);
    try {
      await ignore.mutateAsync(opportunity.id);
      setSelected(null);
      toast.success(t.ignored, {
        action: { label: t.undo, onClick: () => restore.mutate(opportunity.id) },
      });
    } catch {
      toast.error(t.ignoreError);
    } finally {
      setIgnoringId(null);
    }
  };

  const actionProps = (opportunity) => ({
    onIgnore: handleIgnore,
    onConvert: handleConvert,
    onViewApplication: (o) => goToApplication(o.converted_application_id),
    isConverting: convertingId === opportunity.id,
    isIgnoring: ignoringId === opportunity.id,
  });

  return (
    <div className="flex flex-col gap-6" data-testid="opportunities-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white">{t.title}</h1>
        <p className="text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div
          role="group"
          aria-label={t.filterLabel}
          className="flex bg-slate-900/60 border border-slate-800 rounded-xl p-1 overflow-x-auto"
        >
          {OPPORTUNITY_FILTERS.map(filter => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={filters.status === filter.value}
              onClick={() => updateFilters({ status: filter.value })}
              className={`flex-1 lg:flex-none whitespace-nowrap px-3 sm:px-4 h-10 sm:h-9 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60
                ${filters.status === filter.value ? 'bg-gold/15 text-gold' : 'text-slate-400 hover:text-white'}`}
              data-testid={`opportunity-filter-${filter.value}`}
            >
              {filter.label[language]}
            </button>
          ))}
        </div>
        <div className="relative flex-1 lg:max-w-md">
          <label htmlFor="opportunity-search" className="sr-only">{t.searchLabel}</label>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input
            id="opportunity-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9 h-10 bg-slate-900/50 border-slate-700 text-white"
            maxLength={200}
            data-testid="opportunity-search"
          />
        </div>
      </div>

      <OpportunityFilters
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
        facets={facets}
        total={data?.total}
        language={language}
      />

      {/* Contenu */}
      {isLoading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl bg-slate-800/50" />)}
        </div>
      ) : isError ? (
        <div className="glass-card rounded-xl border border-red-500/30 p-6 flex flex-col sm:flex-row sm:items-center gap-4" role="alert">
          <AlertTriangle className="text-red-400 shrink-0" aria-hidden="true" />
          <p className="text-slate-300 flex-1">{t.error}</p>
          <Button variant="outline" className="border-slate-700" onClick={() => refetch()}>{t.retry}</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-xl border border-slate-800 py-14 px-6 text-center" data-testid="opportunities-empty">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gold/10 flex items-center justify-center">
            {isFiltered
              ? <SearchX className="text-gold" aria-hidden="true" />
              : <Inbox className="text-gold" aria-hidden="true" />}
          </div>
          <h2 className="text-white font-semibold text-lg">{isFiltered ? t.noResultTitle : t.emptyTitle}</h2>
          <p className="text-slate-400 mt-1">{isFiltered ? t.noResultText : t.emptyText}</p>
          {isFiltered && hasActiveFilters(filters) && (
            <Button variant="outline" className="mt-4 border-slate-700" onClick={resetFilters} data-testid="opportunities-empty-reset">
              <RotateCcw aria-hidden="true" />
              {t.resetFilters}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="opportunities-list">
            {items.map(opportunity => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                onOpen={setSelected}
                {...actionProps(opportunity)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
              <Button
                variant="outline" size="icon" className="h-10 w-10 border-slate-700"
                onClick={() => updateFilters({ page: Math.max(1, page - 1) })}
                disabled={page <= 1}
                aria-label={t.previous}
              >
                <ChevronLeft />
              </Button>
              <span className="text-sm text-slate-400" aria-live="polite">{t.page(page, totalPages)}</span>
              <Button
                variant="outline" size="icon" className="h-10 w-10 border-slate-700"
                onClick={() => updateFilters({ page: Math.min(totalPages, page + 1) })}
                disabled={page >= totalPages}
                aria-label={t.next}
              >
                <ChevronRight />
              </Button>
            </nav>
          )}
        </>
      )}

      <OpportunityDetailDialog
        opportunity={selectedFresh}
        isOpen={!!selectedFresh}
        onClose={() => setSelected(null)}
        {...(selectedFresh ? actionProps(selectedFresh) : {})}
      />
    </div>
  );
}
