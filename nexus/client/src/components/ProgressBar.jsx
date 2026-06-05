import { useEffect, useState } from 'react';

export default function ProgressBar({ value = 0, max = 100, label = '', tone = 'blue', showValue = true }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const pct     = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fillCls = { green: 'fill-green', amber: 'fill-amber', red: 'fill-red', teal: 'fill-teal' }[tone] || '';
  const display = max === 100 ? `${value}%` : `${value} / ${max}`;

  return (
    <div className="pb-comp">
      {(label || showValue) && (
        <div className="pb-header">
          {label    && <span className="pb-label">{label}</span>}
          {showValue && <span className="pb-value">{display}</span>}
        </div>
      )}
      <div className="prog-track">
        <div
          className={`prog-fill ${fillCls}`}
          style={{ width: mounted ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  );
}
