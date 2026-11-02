import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';
import type { Product } from '../../types';
import { productService } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useDebouncedValue } from '../../hooks/useData';
import { formatCurrency } from '../../utils/format';
import { ProductImage } from './ProductImage';

export function ProductSearch({
  value,
  onSelect,
  placeholder = 'Search products by name, SKU or barcode…',
  disabled = false,
  autoFocus = false,
}: {
  value: Product | null;
  onSelect: (product: Product | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 300);

  const results = useQuery({
    queryKey: qk.products({ search: debounced, isActive: true, limit: 8 }),
    queryFn: () => productService.list({ search: debounced, isActive: true, limit: 8 }),
    enabled: !disabled && debounced.length > 0,
    staleTime: 20_000,
  });

  if (value) {
    const category = typeof value.category === 'object' ? value.category.name : undefined;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-navy-950/50">
        <ProductImage src={value.image} alt={value.name} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {value.name}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {value.sku}
            {category ? ` · ${category}` : ''} · {formatCurrency(value.purchasePrice)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {value.quantity} {value.unit}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">on hand</p>
        </div>
        {!disabled ? (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery('');
            }}
            aria-label="Clear selected product"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label="Search products"
          role="combobox"
          aria-expanded={debounced.length > 0}
          aria-controls="product-search-results"
          autoComplete="off"
          className="input-base pl-10 pr-10"
        />
        {results.isFetching ? (
          <Loader2
            className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {debounced.length > 0 ? (
        <div
          id="product-search-results"
          role="listbox"
          aria-label="Product results"
          className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-navy-900"
        >
          {results.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Searching catalog…
            </div>
          ) : results.isError ? (
            <p className="px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
              Could not search products. Check the connection and try again.
            </p>
          ) : results.data?.data.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              No active product matches “{debounced}”.
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {results.data?.data.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onSelect(product);
                      setQuery('');
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
                  >
                    <ProductImage src={product.image} alt="" className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                        {product.name}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {product.sku} · {formatCurrency(product.purchasePrice)} · {product.quantity}{' '}
                        {product.unit}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {typeof product.category === 'object' ? product.category.name : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Search by product name, SKU or barcode. Only active products are shown.
        </p>
      )}
    </div>
  );
}
