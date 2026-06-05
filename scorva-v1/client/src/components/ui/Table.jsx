import { SearchX } from 'lucide-react';

/**
 * Shared table component.
 *
 * Props:
 *   columns      – array of { key, label, render?, width? }
 *   data         – array of row objects
 *   onRowClick?  – (row) => void — makes rows clickable
 *   emptyText?   – string shown in the empty state
 *   emptyIcon?   – optional Lucide icon component for empty state
 *   getRowClass? – (row) => string — return a CSS class to add to <tr>
 *                  Use 'row-critical' / 'row-high' / 'row-medium' / 'row-low'
 *                  for left-border severity colour coding.
 */
export default function Table({
  columns,
  data,
  onRowClick,
  emptyText = 'No records found.',
  emptyIcon: EmptyIcon = SearchX,
  getRowClass,
}) {
  return (
    <div className="sc-table-shell overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm sc-table">
        <thead>
          <tr className="border-b border-scorva-border">
            {columns.map(col => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-[10px] font-semibold text-scorva-muted uppercase tracking-[0.14em] whitespace-nowrap"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-scorva-border/60">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <EmptyIcon size={22} />
                  </div>
                  <div className="empty-state-title">{emptyText}</div>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => {
              const rowCls = getRowClass?.(row) || '';
              return (
                <tr
                  key={row.id ?? i}
                  onClick={() => onRowClick?.(row)}
                  className={[
                    'transition-colors group',
                    onRowClick
                      ? 'cursor-pointer hover:bg-scorva-hover/80'
                      : 'hover:bg-scorva-hover/40',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-scorva-surface/30',
                    rowCls,
                  ].filter(Boolean).join(' ')}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className="px-4 py-3.5 text-scorva-text whitespace-nowrap"
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
