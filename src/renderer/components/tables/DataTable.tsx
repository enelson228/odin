import React, { useState, useMemo } from 'react';
import { Pagination } from './Pagination';

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: string) => void;
  onRowClick?: (item: T) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  emptyMessage?: string;
  // Pagination
  paginated?: boolean;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (count: number) => void;
}

const DEFAULT_PAGE_SIZE = 100;

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onSort,
  onRowClick,
  sortField,
  sortDirection,
  emptyMessage = 'No data available',
  paginated = false,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);

  // Client-side pagination
  const paginatedData = useMemo(() => {
    if (!paginated) return data;
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, paginated, currentPage, itemsPerPage]);

  const totalPages = totalItems ? Math.ceil(totalItems / itemsPerPage) : Math.ceil(data.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const handleItemsPerPageChange = (count: number) => {
    setItemsPerPage(count);
    setCurrentPage(1);
    onItemsPerPageChange?.(count);
  };

  // Determine which data to display
  const displayData = paginated ? paginatedData : data;

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-odin-border">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable && onSort?.(String(col.key))}
                  className={`px-4 py-3 text-left text-xs font-mono uppercase tracking-wider text-odin-text-secondary ${
                    col.sortable ? 'cursor-pointer hover:text-odin-cyan' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && sortField === col.key && (
                      <span className="text-odin-cyan">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-odin-text-tertiary font-mono"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayData.map((item, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(item)}
                  className={`border-b border-odin-border ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-odin-bg-tertiary transition-colors'
                      : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3 text-sm font-mono text-odin-text-primary"
                    >
                      {col.render
                        ? col.render(item)
                        : item[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginated && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems ?? data.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}
    </div>
  );
}
