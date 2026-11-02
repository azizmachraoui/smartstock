import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { formatNumber } from '../../utils/format';

function pageWindow(page: number, pages: number): (number | 'ellipsis')[] {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  const result: (number | 'ellipsis')[] = [1];
  if (start > 2) result.push('ellipsis');
  for (let current = start; current <= end; current += 1) result.push(current);
  if (end < pages - 1) result.push('ellipsis');
  result.push(pages);
  return result;
}

export interface PaginationProps {
  page?: number;
  currentPage?: number;
  pages?: number;
  totalPages?: number;
  total?: number;
  limit?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  showPageSize?: boolean;
  onPageSizeChange?: (pageSize: number) => void;
  disabled?: boolean;
}

export function Pagination({
  page,
  currentPage,
  pages,
  totalPages,
  total,
  limit,
  pageSize,
  onPageChange,
  showPageSize,
  onPageSizeChange,
  disabled = false,
}: PaginationProps) {
  const activePage = page ?? currentPage ?? 1;
  const countPages = pages ?? totalPages ?? 1;
  const activeLimit = limit ?? pageSize ?? 10;
  const totalItems = total ?? countPages * activeLimit;

  const start = totalItems === 0 ? 0 : (activePage - 1) * activeLimit + 1;
  const end = Math.min(totalItems, activePage * activeLimit);
  const numbers = pageWindow(activePage, Math.max(countPages, 1));

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <p>
          Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(start)}</span>
          {'–'}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(end)}</span> of{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(totalItems)}</span>
        </p>
        {showPageSize && onPageSizeChange ? (
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              value={activeLimit}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-navy-900 dark:text-slate-200"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onPageChange(activePage - 1)}
          disabled={disabled || activePage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {numbers.map((number, index) =>
            number === 'ellipsis' ? (
              <span key={`e-${index}`} className="px-1 text-xs text-slate-400" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={number}
                type="button"
                onClick={() => onPageChange(number)}
                disabled={disabled}
                aria-label={`Page ${number}`}
                aria-current={number === activePage ? 'page' : undefined}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
                  number === activePage
                    ? 'bg-navy-900 text-white dark:bg-brand-500 dark:text-navy-950'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {number}
              </button>
            ),
          )}
        </div>
        <span className="px-2 text-xs text-slate-500 sm:hidden dark:text-slate-400">
          {activePage} / {Math.max(countPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onPageChange(activePage + 1)}
          disabled={disabled || activePage >= countPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
