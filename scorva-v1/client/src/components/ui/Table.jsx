export default function Table({ columns, data, onRowClick, emptyText = 'No records found.' }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-scorva-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-scorva-surface border-b border-scorva-border">
            {columns.map(col => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-medium text-scorva-muted uppercase tracking-wider whitespace-nowrap"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-scorva-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-scorva-muted text-sm">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-scorva-hover' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-scorva-text whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
