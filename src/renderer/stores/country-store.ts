import { create } from 'zustand';
import { Country } from '../../shared/types';

type SortField = 'name' | 'region' | 'population' | 'gdp' | 'military_expenditure_pct_gdp';
type SortDirection = 'asc' | 'desc';

interface CountryStore {
  countries: Country[];
  selectedCountry: Country | null;
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;

  fetchCountries: () => Promise<void>;
  selectCountry: (iso3: string | null) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSort: (field: SortField) => void;
  getFilteredCountries: () => Country[];
}

export const useCountryStore = create<CountryStore>((set, get) => ({
  countries: [],
  selectedCountry: null,
  searchQuery: '',
  sortField: 'name',
  sortDirection: 'asc',

  fetchCountries: async () => {
    try {
      const countries = await window.odinApi.getCountries();
      set({ countries });
    } catch (error) {
      console.error('Failed to fetch countries:', error);
    }
  },

  selectCountry: async (iso3: string | null) => {
    if (!iso3) {
      set({ selectedCountry: null });
      return;
    }
    try {
      const country = await window.odinApi.getCountry(iso3);
      set({ selectedCountry: country });
    } catch (error) {
      console.error('Failed to fetch country:', error);
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setSort: (field: SortField) => {
    const state = get();
    const direction =
      state.sortField === field && state.sortDirection === 'asc'
        ? 'desc'
        : 'asc';
    set({ sortField: field, sortDirection: direction });
  },

  getFilteredCountries: () => {
    const { countries, searchQuery, sortField, sortDirection } = get();

    let filtered = countries.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.iso3.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  },
}));
