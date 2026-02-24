import { useState, useEffect, useCallback } from 'react';
import type {
  ConflictEvent,
  MilitaryInstallation,
  ArmsTransfer,
  ConflictFilters,
  ArmsFilters,
} from '../../shared/types';

export interface UseMapDataOptions {
  conflictFilters?: ConflictFilters;
  armsFilters?: ArmsFilters;
  installationsIso3?: string;
  fetchConflicts?: boolean;
  fetchInstallations?: boolean;
  fetchArms?: boolean;
}

export interface UseMapDataResult {
  conflicts: ConflictEvent[];
  installations: MilitaryInstallation[];
  armsTransfers: ArmsTransfer[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMapData(options: UseMapDataOptions = {}): UseMapDataResult {
  const {
    fetchConflicts = true,
    fetchInstallations = true,
    fetchArms = false,
    conflictFilters,
    armsFilters,
    installationsIso3,
  } = options;

  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  const [installations, setInstallations] = useState<MilitaryInstallation[]>([]);
  const [armsTransfers, setArmsTransfers] = useState<ArmsTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable serialized keys to avoid unnecessary re-fetches
  const conflictFiltersKey = JSON.stringify(conflictFilters);
  const armsFiltersKey = JSON.stringify(armsFilters);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const promises: Promise<void>[] = [];

      if (fetchConflicts) {
        promises.push(
          window.odinApi.getConflicts(conflictFilters).then(data => {
            setConflicts(data ?? []);
          })
        );
      }

      if (fetchInstallations) {
        promises.push(
          window.odinApi.getInstallations(installationsIso3).then(data => {
            setInstallations(data ?? []);
          })
        );
      }

      if (fetchArms) {
        promises.push(
          window.odinApi.getArmsTransfers(armsFilters).then(data => {
            setArmsTransfers(data ?? []);
          })
        );
      }

      await Promise.all(promises);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConflicts, fetchInstallations, fetchArms, conflictFiltersKey, armsFiltersKey, installationsIso3]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { conflicts, installations, armsTransfers, loading, error, refetch: fetch };
}
