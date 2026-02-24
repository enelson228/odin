import React from 'react';

export function Spinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-odin-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
