import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (count: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pageNumbers: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    pageNumbers.push(1);
    if (currentPage > 3) {
      pageNumbers.push('...');
    }
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pageNumbers.push(i);
    }
    if (currentPage < totalPages - 2) {
      pageNumbers.push('...');
    }
    pageNumbers.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 border-t border-odin-border bg-odin-bg-secondary">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-odin-text-secondary font-mono">
          Showing {startItem}-{endItem} of {totalItems}
        </span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="bg-odin-bg-tertiary text-odin-text-primary border border-odin-border rounded px-2 py-1 font-mono text-sm focus:outline-none focus:border-odin-cyan"
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
          <option value={250}>250 / page</option>
        </select>
      </div>

      <nav className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-odin-text-secondary hover:text-odin-cyan disabled:opacity-30 disabled:cursor-not-allowed font-mono text-sm"
          title="First page"
        >
          ««
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-odin-text-secondary hover:text-odin-cyan disabled:opacity-30 disabled:cursor-not-allowed font-mono text-sm"
          title="Previous page"
        >
          «
        </button>

        {pageNumbers.map((num, idx) =>
          num === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-odin-text-tertiary font-mono">
              ...
            </span>
          ) : (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              className={`min-w-[32px] px-2 py-1 font-mono text-sm ${
                currentPage === num
                  ? 'bg-odin-cyan text-odin-bg-primary font-medium'
                  : 'text-odin-text-secondary hover:text-odin-cyan'
              }`}
            >
              {num}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-odin-text-secondary hover:text-odin-cyan disabled:opacity-30 disabled:cursor-not-allowed font-mono text-sm"
          title="Next page"
        >
          »
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-odin-text-secondary hover:text-odin-cyan disabled:opacity-30 disabled:cursor-not-allowed font-mono text-sm"
          title="Last page"
        >
          »»
        </button>
      </nav>
    </div>
  );
}
