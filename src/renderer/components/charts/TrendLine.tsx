import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';

interface TrendLineProps {
  events: Array<{ event_date: string; fatalities: number }>;
}

interface MonthPoint {
  month: string;
  count: number;
  fatalities: number;
}

const ODIN_COLORS = {
  cyan: '#00e5ff',
  red: '#ff3d3d',
  bgTertiary: '#1a2332',
  border: '#1e2d3d',
  textTertiary: '#556677',
};

export function TrendLine({ events }: TrendLineProps) {
  const months: MonthPoint[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const label = format(monthStart, "MMM ''yy");
    months.push({ month: label, count: 0, fatalities: 0 });
  }

  events.forEach(ev => {
    const evDate = new Date(ev.event_date);
    const monthsAgo = Math.floor(
      (now.getTime() - evDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    if (monthsAgo >= 0 && monthsAgo < 12) {
      const idx = 11 - monthsAgo;
      if (idx >= 0 && idx < months.length) {
        months[idx].count++;
        months[idx].fatalities += ev.fatalities || 0;
      }
    }
  });

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-odin-text-tertiary text-sm font-mono">
        No conflict data — run a sync to load events
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={months} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ODIN_COLORS.border} />
        <XAxis
          dataKey="month"
          tick={{ fill: ODIN_COLORS.textTertiary, fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: ODIN_COLORS.border }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: ODIN_COLORS.textTertiary, fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: ODIN_COLORS.border }}
          tickLine={false}
          width={36}
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
          labelStyle={{ color: ODIN_COLORS.cyan }}
          formatter={(value: number, name: string) => [
            value.toLocaleString(),
            name === 'count' ? 'Events' : 'Fatalities',
          ]}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={ODIN_COLORS.cyan}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: ODIN_COLORS.cyan }}
        />
        <Line
          type="monotone"
          dataKey="fatalities"
          stroke={ODIN_COLORS.red}
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 2"
          activeDot={{ r: 3, fill: ODIN_COLORS.red }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
