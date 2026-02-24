import { useEffect, useRef, useState } from 'react';
import { useCountryStore } from '../stores/country-store';
import type { Country } from '../../shared/types';

export interface UseCountriesOptions {
  autoFetch?: boolean;
  region?: string;
  search?: string;
}

export interface UseCountriesResult {
  countries: Country[];
  filteredCountries: Country[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  selectedCountry: Country | null;
  selectCountry: (iso3: string | null) => void;
}

export function useCountries(options: UseCountriesOptions = {}): UseCountriesResult {
  const { autoFetch = true, region, search } = options;

  const {
    countries,
    fetchCountries,
    selectedCountry,
    selectCountry,
    searchQuery,
  } = useCountryStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchCountries();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && !hasFetched.current && countries.length === 0) {
      hasFetched.current = true;
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchTerm = (search ?? searchQuery ?? '').toLowerCase().trim();
  const filteredCountries = countries.filter(c => {
    const matchesSearch = !searchTerm ||
      c.name.toLowerCase().includes(searchTerm) ||
      c.iso3.toLowerCase().includes(searchTerm) ||
      (c.capital ?? '').toLowerCase().includes(searchTerm);
    const matchesRegion = !region || c.region === region;
    return matchesSearch && matchesRegion;
  });

  return {
    countries,
    filteredCountries,
    loading,
    error,
    refetch,
    selectedCountry,
    selectCountry,
  };
}
