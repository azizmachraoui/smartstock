import React from 'react';
import { Skeleton } from './States';

export interface Column<T = any> {
  key: string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T = any> {
  data: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey?: (item: T, index: number) => string | number;
  keyExtractor?: (item: T, index: number) => string | number;
}

export function Table<T = any>({
  data = [],
  columns,
  loading = false,
  emptyMessage = 'No records found',
  rowKey,
  keyExtractor,
}: TableProps<T>) {
  const getKey = keyExtractor ?? rowKey ?? ((_item: any, index: number) => (_item && _item.id ? _item.id : index));
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-navy-950/40 dark:text-slate-400">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-semibold ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-navy-950/40 dark:text-slate-400">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-semibold ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
        <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-navy-950/40 dark:text-slate-400">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 font-semibold ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((item, index) => (
            <tr
              key={getKey(item, index)}
              className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
