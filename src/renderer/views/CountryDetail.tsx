import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/app-store';
import {
  Country,
  ConflictEvent,
  MilitaryInstallation,
  ArmsTransfer,
  WorldBankIndicator,
} from '../../shared/types';
import { Spinner } from '../components/common/Spinner';
import { DataTable } from '../components/tables/DataTable';
import { Badge } from '../components/common/Badge';
import { formatNumber, formatCurrency, formatPercent, formatDate } from '../lib/format';

type TabType = 'overview' | 'conflicts' | 'military' | 'arms' | 'indicators';

export function CountryDetail() {
  const { iso3 } = useParams<{ iso3?: string }>();
  const navigate = useNavigate();
  const { setCurrentView } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [country, setCountry] = useState<Country | null>(null);
  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  const [installations, setInstallations] = useState<MilitaryInstallation[]>([]);
  const [armsTransfers, setArmsTransfers] = useState<ArmsTransfer[]>([]);
  const [indicators, setIndicators] = useState<WorldBankIndicator[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!iso3) return;

      setLoading(true);
      try {
        const [countryData, conflictData, installationData, armsData, indicatorData] =
          await Promise.all([
            window.odinApi.getCountry(iso3),
            window.odinApi.getConflicts({ iso3: [iso3] }),
            window.odinApi.getInstallations(iso3),
            window.odinApi.getArmsTransfers({ recipientIso3: [iso3] }),
            window.odinApi.getIndicators(iso3),
          ]);

        setCountry(countryData);
        setConflicts(conflictData);
        setInstallations(installationData);
        setArmsTransfers(armsData);
        setIndicators(indicatorData);

        if (countryData) {
          setCurrentView(countryData.name);
        }
      } catch (err) {
        console.error('Failed to fetch country data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load country data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [iso3, setCurrentView]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error || !country) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-odin-text-secondary">
        <div className="text-odin-red font-mono text-sm">{error ?? 'Country not found'}</div>
        <button
          onClick={() => navigate('/countries')}
          className="px-3 py-1 text-xs font-mono text-odin-cyan border border-odin-cyan rounded hover:bg-odin-cyan/10 transition-colors"
        >
          Back to Countries
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'conflicts', label: 'Conflicts', count: conflicts.length },
    { id: 'military', label: 'Military', count: installations.length },
    { id: 'arms', label: 'Arms', count: armsTransfers.length },
    { id: 'indicators', label: 'Indicators', count: indicators.length },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs font-mono text-odin-text-tertiary" aria-label="Breadcrumb">
        <button
          onClick={() => navigate('/countries')}
          className="hover:text-odin-cyan transition-colors"
        >
          Countries
        </button>
        <span>/</span>
        <span className="text-odin-text-secondary">{country?.name ?? iso3}</span>
      </nav>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-odin-cyan mb-2 font-mono">
              {country.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-odin-text-secondary font-mono">
              <span>{country.iso3}</span>
              <span>•</span>
              <span>{country.region}</span>
              <span>•</span>
              <span>{country.subregion}</span>
            </div>
          </div>
          <Badge label={country.region} variant="cyan" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-odin-bg-tertiary rounded p-4">
            <div className="text-xs text-odin-text-tertiary mb-1 font-mono uppercase">
              Population
            </div>
            <div className="text-xl font-bold text-odin-text-primary font-mono">
              {formatNumber(country.population)}
            </div>
          </div>
          <div className="bg-odin-bg-tertiary rounded p-4">
            <div className="text-xs text-odin-text-tertiary mb-1 font-mono uppercase">
              GDP
            </div>
            <div className="text-xl font-bold text-odin-text-primary font-mono">
              {formatCurrency(country.gdp)}
            </div>
          </div>
          <div className="bg-odin-bg-tertiary rounded p-4">
            <div className="text-xs text-odin-text-tertiary mb-1 font-mono uppercase">
              Military Spending
            </div>
            <div className="text-xl font-bold text-odin-text-primary font-mono">
              {formatPercent(country.military_expenditure_pct_gdp)}
            </div>
          </div>
          <div className="bg-odin-bg-tertiary rounded p-4">
            <div className="text-xs text-odin-text-tertiary mb-1 font-mono uppercase">
              Active Personnel
            </div>
            <div className="text-xl font-bold text-odin-text-primary font-mono">
              {formatNumber(country.active_personnel)}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-odin-border">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 font-mono text-sm transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-odin-cyan text-odin-cyan'
                  : 'border-transparent text-odin-text-secondary hover:text-odin-text-primary'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 text-xs">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-odin-text-tertiary font-mono mb-1">Capital</div>
                <div className="text-base text-odin-text-primary font-mono">
                  {country.capital || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-odin-text-tertiary font-mono mb-1">
                  Government Type
                </div>
                <div className="text-base text-odin-text-primary font-mono">
                  {country.government_type || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-odin-text-tertiary font-mono mb-1">Area</div>
                <div className="text-base text-odin-text-primary font-mono">
                  {formatNumber(country.area_sq_km)} km²
                </div>
              </div>
              <div>
                <div className="text-sm text-odin-text-tertiary font-mono mb-1">
                  Reserve Personnel
                </div>
                <div className="text-base text-odin-text-primary font-mono">
                  {formatNumber(country.reserve_personnel)}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conflicts' && (
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
                render: (item) => <Badge label={item.event_type} variant="red" />,
              },
              { key: 'location', label: 'Location' },
              { key: 'actor1', label: 'Actor 1' },
              { key: 'actor2', label: 'Actor 2' },
              {
                key: 'fatalities',
                label: 'Fatalities',
                render: (item) => (
                  <span className="text-odin-red font-bold">{item.fatalities}</span>
                ),
              },
            ]}
            data={conflicts}
            emptyMessage="No conflict events recorded"
          />
        )}

        {activeTab === 'military' && (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type' },
              { key: 'operator', label: 'Operator' },
              {
                key: 'latitude',
                label: 'Coordinates',
                render: (item) => `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`,
              },
            ]}
            data={installations}
            emptyMessage="No military installations recorded"
          />
        )}

        {activeTab === 'arms' && (
          <DataTable
            columns={[
              { key: 'year', label: 'Year' },
              { key: 'weapon_category', label: 'Category' },
              { key: 'weapon_description', label: 'Description' },
              {
                key: 'quantity',
                label: 'Quantity',
                render: (item) => formatNumber(item.quantity),
              },
              { key: 'status', label: 'Status' },
            ]}
            data={armsTransfers}
            emptyMessage="No arms transfers recorded"
          />
        )}

        {activeTab === 'indicators' && (
          <DataTable
            columns={[
              { key: 'indicator_name', label: 'Indicator' },
              { key: 'year', label: 'Year' },
              {
                key: 'value',
                label: 'Value',
                render: (item) => formatNumber(item.value),
              },
            ]}
            data={indicators}
            emptyMessage="No World Bank indicators available"
          />
        )}
      </div>
    </div>
  );
}
