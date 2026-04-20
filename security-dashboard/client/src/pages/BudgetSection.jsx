import { useEffect, useRef } from 'react';
import { fmtDate } from '../app.js';
import { Prog } from '../components/index.jsx';

export default function BudgetSection({ data }) {
  const b        = data.budget || {};
  const barRef   = useRef(null);
  const barChart = useRef(null);
  const qRef     = useRef(null);
  const qChart   = useRef(null);
  const spentPct = b.total ? Math.round(b.spent / b.total * 100) : 0;

  const chartDefaults = {
    plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 }, color: 'rgba(143,163,192,.5)' } } },
    responsive: true, maintainAspectRatio: false,
  };

  useEffect(() => {
    if (!barRef.current || !b.bySite) return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (barChart.current) barChart.current.destroy();
      barChart.current = new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: b.bySite.map(s => s.name.split(' ').slice(0, 2).join(' ')),
          datasets: [
            { label: 'Spent YTD', data: b.bySite.map(s => s.spent),            backgroundColor: 'rgba(201,168,76,.55)', borderRadius: 4 },
            { label: 'Remaining', data: b.bySite.map(s => s.budgeted - s.spent), backgroundColor: 'rgba(201,168,76,.12)', borderRadius: 4 },
          ],
        },
        options: {
          ...chartDefaults,
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: 'rgba(143,163,192,.35)', font: { size: 10 } } },
            y: { stacked: true, grid: { color: 'rgba(201,168,76,.05)' }, ticks: { color: 'rgba(143,163,192,.35)', font: { size: 10 }, callback: v => '$' + Math.round(v / 1000) + 'K' } },
          },
        },
      });
    });
  }, [b.bySite]);

  useEffect(() => {
    if (!qRef.current || !b.quarterly) return;
    const qArr = Object.entries(b.quarterly).map(([k, v]) => ({ quarter: k, ...v }));
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (qChart.current) qChart.current.destroy();
      qChart.current = new Chart(qRef.current, {
        type: 'bar',
        data: {
          labels: qArr.map(q => q.quarter),
          datasets: [
            { label: 'Planned', data: qArr.map(q => q.planned), backgroundColor: 'rgba(201,168,76,.15)', borderRadius: 4 },
            { label: 'Actual',  data: qArr.map(q => q.actual),  backgroundColor: 'rgba(201,168,76,.48)', borderRadius: 4 },
          ],
        },
        options: {
          ...chartDefaults,
          scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(143,163,192,.35)', font: { size: 10 } } },
            y: { grid: { color: 'rgba(201,168,76,.05)' }, ticks: { color: 'rgba(143,163,192,.35)', font: { size: 10 }, callback: v => '$' + Math.round(v / 1000) + 'K' } },
          },
        },
      });
    });
  }, [b.quarterly]);

  return (
    <div className="section">
      <div className="mb-7">
        <div className="sec-heading mb-1">Budget &amp; Expenditures</div>
        <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>FY26 Financial Overview</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Total FY26 Budget',    val: `$${(b.total / 1e6).toFixed(2)}M`,              sub: 'Contract W9133L-24-D-0047' },
          { label: 'Spent YTD',            val: `$${(b.spent / 1e6).toFixed(2)}M`,              sub: `${spentPct}% of total`, prog: spentPct },
          { label: 'Remaining',            val: `$${((b.total - b.spent) / 1e6).toFixed(2)}M`,  sub: `${100 - spentPct}% remaining`, prog: 100 - spentPct },
          { label: 'Projected Variance',   val: 'On Track',                                      sub: 'No overrun projected' },
        ].map((k, i) => (
          <div key={i} className="card card-kpi p-6">
            <div className="uppercase tracking-widest mb-3" style={{ fontSize: '.59rem', fontWeight: 700, color: 'rgba(143,163,192,.5)', letterSpacing: '.1em' }}>{k.label}</div>
            <div className="font-head font-bold mb-2" style={{ fontSize: '1.7rem', color: 'var(--gold)' }}>{k.val}</div>
            {k.prog != null && <div className="mb-3"><Prog v={k.prog} cls={k.prog > 80 ? 'p-g' : 'p-gold'} /></div>}
            <div className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <div className="card p-6 xl:col-span-2">
          <div className="font-head font-semibold mb-4" style={{ color: 'var(--off-white)' }}>Spent vs. Budgeted by Facility</div>
          <div style={{ height: '220px' }}><canvas ref={barRef} /></div>
        </div>
        <div className="card p-6">
          <div className="font-head font-semibold mb-4" style={{ color: 'var(--off-white)' }}>Category Breakdown</div>
          <div className="space-y-4">
            {(b.categories || []).map(cat => {
              const p = Math.round(cat.spent / cat.budgeted * 100) || 0;
              return (
                <div key={cat.name}>
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(143,163,192,.55)' }}>
                    <span>{cat.name}</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--gold)' }}>${Math.round(cat.spent / 1000)}K / ${Math.round(cat.budgeted / 1000)}K</span>
                  </div>
                  <Prog v={p} cls={p > 90 ? 'p-r' : p > 75 ? 'p-a' : 'p-gold'} h="h-[5px]" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="font-head font-semibold mb-4" style={{ color: 'var(--off-white)' }}>Quarterly Planned vs. Actual</div>
          <div style={{ height: '180px' }}><canvas ref={qRef} /></div>
        </div>
        <div className="card p-6">
          <div className="font-head font-semibold mb-4" style={{ color: 'var(--off-white)' }}>Recent Transactions</div>
          <div className="space-y-3 text-xs">
            {(b.recentTransactions || []).slice(0, 6).map((t, i) => (
              <div key={i} className="flex items-start justify-between gap-x-4 pb-3" style={{ borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'rgba(240,244,248,.75)' }}>{t.vendor}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.3)' }}>{t.description} · {t.po}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold" style={{ color: 'var(--gold)' }}>${t.amount?.toLocaleString()}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.28)' }}>{fmtDate(t.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
