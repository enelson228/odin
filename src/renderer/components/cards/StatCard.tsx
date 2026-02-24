import React from 'react';

type StatCardColor = 'cyan' | 'green' | 'amber' | 'red';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: StatCardColor;
}

const colorClasses: Record<StatCardColor, { glow: string; text: string }> = {
  cyan: { glow: 'shadow-glow-cyan', text: 'text-odin-cyan' },
  green: { glow: 'shadow-glow-green', text: 'text-odin-green' },
  amber: { glow: 'shadow-glow-amber', text: 'text-odin-amber' },
  red: { glow: 'shadow-glow-red', text: 'text-odin-red' },
};

export function StatCard({ label, value, icon, color = 'cyan' }: StatCardProps) {
  const { glow, text } = colorClasses[color];

  return (
    <div
      className={`bg-odin-bg-secondary border border-odin-border rounded-lg p-6 ${glow} hover:border-odin-border-bright transition-all`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className={`text-3xl ${text}`}>{icon}</span>
      </div>
      <div className={`text-4xl font-bold mb-2 ${text}`}>
        {value}
      </div>
      <div className="text-sm text-odin-text-secondary font-mono uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
