import React, { useState } from 'react';
import { ExportFormat, ExportRequest } from '../../../shared/types';

interface ExportMenuProps {
  dataType: ExportRequest['dataType'];
  filters?: ExportRequest['filters'];
}

const exportFormats: { value: ExportFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF Report' },
  { value: 'geojson', label: 'GeoJSON' },
];

export function ExportMenu({ dataType, filters }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const defaultName = `odin_${dataType}_${new Date().toISOString().split('T')[0]}.${format}`;
      const filePath = await window.odinApi.chooseSavePath(defaultName);

      if (filePath) {
        const request: ExportRequest = {
          format,
          dataType,
          filters,
          filePath,
        };

        const result = await window.odinApi.runExport(request);
        if (result.success) {
          console.log('Export successful:', result.filePath);
        } else {
          console.error('Export failed:', result.error);
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting}
        aria-label="Export data"
        aria-expanded={isOpen}
        className="px-3 py-1.5 bg-odin-bg-secondary border border-odin-border rounded text-sm font-mono text-odin-text-primary hover:bg-odin-bg-tertiary hover:border-odin-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exporting ? '⌛ Exporting...' : '↓ Export'}
      </button>

      {isOpen && !exporting && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-40 bg-odin-bg-secondary border border-odin-border rounded shadow-lg z-20">
            {exportFormats.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleExport(value)}
                className="w-full px-3 py-2 text-left text-sm font-mono text-odin-text-primary hover:bg-odin-bg-tertiary hover:text-odin-cyan transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
