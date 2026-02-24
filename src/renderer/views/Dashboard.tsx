import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/app-store';
import { StatCard } from '../components/cards/StatCard';
import { DataTable } from '../components/tables/DataTable';
import { Spinner } from '../components/common/Spinner';
import type { ConflictEvent, Country } from '../../shared/types';
import { formatDate, formatNumber } from '../lib/format';
import { Badge } from '../components/common/Badge';
import { TrendLine } from '../components/charts/TrendLine';
import { BarChart } from '../components/charts/BarChart';

export function Dashboard() {
  const navigate = useNavigate();
  const { setCurrentView } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [stats, setStats] = useState({
    countries: 0,
    conflicts: 0,
    armsTransfers: 0,
    installations: 0,
  });
  const [recentConflicts, setRecentConflicts] = useState<ConflictEvent[]>([]);
  const [allConflicts, setAllConflicts] = useState<ConflictEvent[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    setCurrentView('Dashboard');
  }, [setCurrentView]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [countriesData, conflicts, arms, installations] = await Promise.all([
          window.odinApi.getCountries(),
          window.odinApi.getConflicts(),
          window.odinApi.getArmsTransfers(),
          window.odinApi.getInstallations(),
        ]);

        setStats({
          countries: countriesData.length,
          conflicts: conflicts.length,
          armsTransfers: arms.length,
          installations: installations.length,
        });

        setCountries(countriesData);
        setAllConflicts(conflicts);

        const sorted = [...conflicts]
          .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
          .slice(0, 20);
        setRecentConflicts(sorted);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-odin-text-secondary">
        <div className="text-odin-red font-mono text-sm">{error}</div>
        <button
          onClick={() => { setError(null); setRetryCount(c => c + 1); }}
          className="px-3 py-1 text-xs font-mono text-odin-cyan border border-odin-cyan rounded hover:bg-odin-cyan/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Countries Tracked"
          value={formatNumber(stats.countries)}
          icon="⊞"
          color="cyan"
        />
        <StatCard
          label="Active Conflicts"
          value={formatNumber(stats.conflicts)}
          icon="⚔"
          color="red"
        />
        <StatCard
          label="Arms Transfers"
          value={formatNumber(stats.armsTransfers)}
          icon="➤"
          color="amber"
        />
        <StatCard
          label="Military Installations"
          value={formatNumber(stats.installations)}
          icon="⬢"
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
          <h3 className="text-lg font-bold text-odin-cyan mb-4 font-mono">
            Conflict Trends
          </h3>
          <div className="h-48">
            <TrendLine events={allConflicts} />
          </div>
        </div>

        <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
          <h3 className="text-lg font-bold text-odin-cyan mb-4 font-mono">
            Top Military Spenders
          </h3>
          <div className="h-48">
            <BarChart countries={countries} limit={10} />
          </div>
        </div>
      </div>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <h3 className="text-lg font-bold text-odin-cyan mb-4 font-mono">
          Recent Conflict Events
        </h3>
        <DataTable
          columns={[
            {
              key: 'event_date',
              label: 'Date',
              render: (item) => formatDate(item.event_date),
            },
            {
              key: 'event_type',
              label: 'Type',
              render: (item) => (
                <Badge
                  label={item.event_type}
                  variant={
                    item.event_type.includes('Battle') || item.event_type.includes('Violence')
                      ? 'red'
                      : item.event_type.includes('Explosion')
                      ? 'amber'
                      : item.event_type.includes('Protest')
                      ? 'cyan'
                      : 'purple'
                  }
                />
              ),
            },
            { key: 'location', label: 'Location' },
            { key: 'actor1', label: 'Actor' },
            {
              key: 'fatalities',
              label: 'Fatalities',
              render: (item) => (
                <span className={item.fatalities > 0 ? 'text-odin-red font-bold' : ''}>
                  {item.fatalities}
                </span>
              ),
            },
          ]}
          data={recentConflicts}
          onRowClick={(conflict) => navigate(`/countries/${conflict.iso3}`)}
        />
      </div>
    </div>
  );
}
