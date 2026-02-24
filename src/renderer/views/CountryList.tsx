import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/app-store';
import { useCountryStore } from '../stores/country-store';
import { SearchInput } from '../components/common/SearchInput';
import { DataTable } from '../components/tables/DataTable';
import { Spinner } from '../components/common/Spinner';
import { formatNumber, formatCurrency, formatPercent } from '../lib/format';

export function CountryList() {
  const navigate = useNavigate();
  const { setCurrentView } = useAppStore();
  const {
    countries,
    searchQuery,
    sortField,
    sortDirection,
    fetchCountries,
    setSearchQuery,
    setSort,
    getFilteredCountries,
  } = useCountryStore();

  const [loading, setLoading] = useState(countries.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentView('Countries');
    if (countries.length === 0) {
      setLoading(true);
      fetchCountries()
        .catch(err => setError(err instanceof Error ? err.message : 'Failed to load countries'))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const filteredCountries = getFilteredCountries();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-odin-text-secondary">
        <div className="text-odin-red font-mono text-sm">Failed to load countries</div>
        <div className="text-odin-text-tertiary text-xs font-mono">{error}</div>
        <button
          onClick={() => { setError(null); setLoading(true); fetchCountries().finally(() => setLoading(false)); }}
          className="px-3 py-1 text-xs font-mono text-odin-cyan border border-odin-cyan rounded hover:bg-odin-cyan/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-odin-cyan font-mono">
          Country Database
        </h2>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search countries..."
          className="w-80"
        />
      </div>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Name',
              sortable: true,
              render: (item) => (
                <div>
                  <div className="font-bold text-odin-cyan">{item.name}</div>
                  <div className="text-xs text-odin-text-tertiary">{item.iso3}</div>
                </div>
              ),
            },
            {
              key: 'region',
              label: 'Region',
              sortable: true,
            },
            {
              key: 'population',
              label: 'Population',
              sortable: true,
              render: (item) => formatNumber(item.population),
            },
            {
              key: 'gdp',
              label: 'GDP',
              sortable: true,
              render: (item) => formatCurrency(item.gdp),
            },
            {
              key: 'military_expenditure_pct_gdp',
              label: 'Mil. Spending',
              sortable: true,
              render: (item) => formatPercent(item.military_expenditure_pct_gdp),
            },
          ]}
          data={filteredCountries}
          onSort={(key) => setSort(key as any)}
          onRowClick={(country) => navigate(`/countries/${country.iso3}`)}
          sortField={sortField}
          sortDirection={sortDirection}
          emptyMessage="No countries found"
        />
      </div>

      <div className="text-sm text-odin-text-tertiary font-mono text-right">
        Showing {filteredCountries.length} of {countries.length} countries
      </div>
    </div>
  );
}
