import React from 'react';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface BarChartProps {
  countries: Array<{
    name: string;
    military_expenditure_pct_gdp: number | null;
  }>;
  limit?: number;
}

const ODIN_COLORS = {
  cyan: '#00e5ff',
  amber: '#ffab00',
  red: '#ff3d3d',
  border: '#1e2d3d',
  bgTertiary: '#1a2332',
  textTertiary: '#556677',
};

function getBarColor(pct: number): string {
  if (pct >= 4) return ODIN_COLORS.red;
  if (pct >= 2.5) return ODIN_COLORS.amber;
  return ODIN_COLORS.cyan;
}

export function BarChart({ countries, limit = 10 }: BarChartProps) {
  const data = countries
    .filter(c => c.military_expenditure_pct_gdp !== null)
    .sort((a, b) => (b.military_expenditure_pct_gdp ?? 0) - (a.military_expenditure_pct_gdp ?? 0))
    .slice(0, limit)
    .map(c => ({
      name: c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name,
      fullName: c.name,
      pct: Number((c.military_expenditure_pct_gdp ?? 0).toFixed(2)),
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-odin-text-tertiary text-sm font-mono">
        No military spending data — run a sync to load indicators
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ODIN_COLORS.border} horizontal={false} />
        <XAxis
          type="number"
          unit="%"
          tick={{ fill: ODIN_COLORS.textTertiary, fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: ODIN_COLORS.border }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={72}
          tick={{ fill: '#8899aa', fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: ODIN_COLORS.border }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: ODIN_COLORS.bgTertiary,
            border: `1px solid ${ODIN_COLORS.border}`,
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#e0e6ed',
          }}
          formatter={(value: number, _name: string, props: { payload?: { fullName: string } }) => [
            `${value}%`,
            props.payload?.fullName ?? 'Military Spend',
          ]}
          labelFormatter={() => ''}
        />
        <Bar dataKey="pct" radius={[0, 2, 2, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getBarColor(entry.pct)} fillOpacity={0.85} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
