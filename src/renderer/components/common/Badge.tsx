import React from 'react';

type BadgeVariant = 'cyan' | 'green' | 'amber' | 'red' | 'purple';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  cyan: 'bg-odin-cyan-dim text-odin-cyan border-odin-cyan',
  green: 'bg-odin-green-dim text-odin-green border-odin-green',
  amber: 'bg-odin-amber-dim text-odin-amber border-odin-amber',
  red: 'bg-odin-red-dim text-odin-red border-odin-red',
  purple: 'bg-odin-purple/20 text-odin-purple border-odin-purple',
};

export function Badge({ label, variant = 'cyan' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${variantClasses[variant]}`}
    >
      {label}
    </span>
  );
}
