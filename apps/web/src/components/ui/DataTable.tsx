import React from 'react';
import { ErrorState, TableSkeleton } from './States';
import { getErrorMessage } from '../../lib/errors';

export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  empty,
  caption,
  skeletonRows = 6,
}: {
  columns: DataColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: React.ReactNode;
  caption: string;
  skeletonRows?: number;
}) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <TableSkeleton rows={skeletonRows} columns={columns.length} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load this table"
        message={getErrorMessage(error)}
        onRetry={onRetry}
      />
    );
  }

  if (!rows || rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="table-shell">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`${column.headerClassName ?? ''} ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
