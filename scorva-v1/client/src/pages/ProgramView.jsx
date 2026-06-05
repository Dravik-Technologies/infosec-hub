import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader    from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import BarList from '../components/ui/BarList';
import { ShieldCheck, AlertTriangle, BookOpen, Zap, ArrowRight, Flame, Radar, Clock, TrendingUp } from 'lucide-react';

/* ── Helpers ── */
function pct(n, total) {
  return total ? Math.round((n / total) * 100) : 0;
}

function trafficLight(value, warn, danger) {
  if (value >= danger) return 'text-red-400';
  if (value >= warn)   return 'text-yellow-400';
  return 'text-emerald-400';
}

function pctLight(p, goodThreshold = 70, okThreshold = 50) {
  if (p >= goodThreshold) return 'text-emerald-400';
  if (p >= okThreshold)   return 'text-yellow-400';
  return 'text-red-400';
}

function riskColor(levelOrScore) {
  const score = typeof levelOrScore === 'number' ? levelOrScore : null;
  if (levelOrScore === 'High' || score >= 75) return 'text-red-400';
  if (levelOrScore === 'Moderate' || score >= 40) return 'text-yellow-400';
  return 'text-emerald-400';
}

function heatCell(value, warn, danger) {
  const tone = value >= danger
    ? 'bg-red-500/15 text-red-300 border-red-500/25'
    : value >= warn
      ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  return (
    <span className={`inline-flex min-w-10 justify-center rounded-md border px-2 py-1 font-mono font-bold ${tone}`}>
      {value}
    </span>
  );
}

function Bar({ pct: p, color = 'bg-scorva-accent' }) {
  return (
    <div className="h-1.5 rounded-full bg-scorva-border overflow-hidden mt-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
}

/* ── Aggregate stat strip ── */
function AggTile({ icon: Icon, label, value, sub, color = 'text-scorva-text' }) {
  return (
    <div className="card p-4 flex gap-3 items-start">
      <div className="p-2 rounded-lg shrink-0 bg-scorva-hover text-scorva-muted"><Icon size={15} /></div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold font-mono leading-none ${color}`}>{value}</div>
        <div className="text-[10px] text-scorva-muted mt-0.5">{label}</div>
        {sub && <div className="text-[9px] font-mono text-scorva-muted/60 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function AnalyticsPanel({ title, icon: Icon, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-scorva-border flex items-center gap-2 bg-scorva-hover/20">
        <Icon size={13} className="text-scorva-muted" />
        <span className="text-[10px] font-mono font-semibold text-scorva-muted uppercase tracking-widest">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ProgramView() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user?.role !== 'Corporate Admin') {
    return (
      <div className="sc-surface-block flex flex-col items-center justify-center py-20 gap-3">
        <ShieldCheck size={32} className="text-scorva-muted" />
        <p className="text-sm text-scorva-muted font-mono">Program View is restricted to Corporate Admins.</p>
      </div>
    );
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['aggregate-metrics'],
    queryFn: api.aggregate.metrics,
    refetchInterval: 60_000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data)
    return <div className="sc-surface-block text-sm text-red-400">Failed to load aggregate metrics.</div>;

  const { sites, totals, analytics = {} } = data;
  const implPct = totals.controls.pct;
  const riskPosture = analytics.riskPosture || { averageScore: 0, highRiskSites: 0, moderateRiskSites: 0, lowRiskSites: 0 };
  const topRiskSites = analytics.topRiskSites || [];
  const heatmap = analytics.heatmap || [];
  const trendInputs = analytics.trendInputs || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Program View"
        description={`Cross-site ISSM dashboard · ${sites.length} site${sites.length !== 1 ? 's' : ''}`}
      />

      <div className="sc-workbar">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill">Enterprise Oversight</span>
          <span className="sc-workbar-pill">{sites.length} sites in view</span>
          <span className="sc-workbar-pill">{totals.poams.open} open POAMs</span>
        </div>
        <div className="text-xs text-scorva-muted">
          Cross-site posture, risk concentration, and expiring authorization pressure in one leadership view.
        </div>
      </div>

      {/* ── Program-level aggregate strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AggTile
          icon={BookOpen}
          label="Controls Implemented"
          value={`${implPct}%`}
          sub={`${totals.controls.implemented} / ${totals.controls.total}`}
          color={pctLight(implPct)}
        />
        <AggTile
          icon={AlertTriangle}
          label="Open POAMs"
          value={totals.poams.open}
          sub={`${totals.poams.overdue} overdue`}
          color={totals.poams.open > 0 ? 'text-orange-400' : 'text-emerald-400'}
        />
        <AggTile
          icon={ShieldCheck}
          label="Active ATOs"
          value={totals.atos.active}
          sub={totals.atos.expiring > 0 ? `${totals.atos.expiring} expiring in 90d` : `${totals.atos.total} total`}
          color={totals.atos.expiring > 0 ? 'text-yellow-400' : 'text-scorva-accent'}
        />
        <AggTile
          icon={Zap}
          label="Security Events (New)"
          value={totals.events.new}
          sub={`${totals.events.criticalHigh} Critical/High`}
          color={totals.events.criticalHigh > 0 ? 'text-red-400' : totals.events.new > 0 ? 'text-yellow-400' : 'text-emerald-400'}
        />
      </div>

      {/* ── Executive analytics strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AggTile
          icon={Flame}
          label="Program Risk Score"
          value={riskPosture.averageScore}
          sub={`${riskPosture.highRiskSites} high-risk site${riskPosture.highRiskSites !== 1 ? 's' : ''}`}
          color={riskColor(riskPosture.averageScore)}
        />
        <AggTile
          icon={Radar}
          label="Risk Distribution"
          value={`${riskPosture.highRiskSites}/${sites.length}`}
          sub={`${riskPosture.moderateRiskSites} moderate · ${riskPosture.lowRiskSites} low`}
          color={riskPosture.highRiskSites > 0 ? 'text-red-400' : riskPosture.moderateRiskSites > 0 ? 'text-yellow-400' : 'text-emerald-400'}
        />
        <AggTile
          icon={Clock}
          label="POAM Aging"
          value={trendInputs.poamAging?.over90 || 0}
          sub={`${trendInputs.poamAging?.over60 || 0} over 60d · ${trendInputs.poamAging?.over30 || 0} over 30d`}
          color={(trendInputs.poamAging?.over90 || 0) > 0 ? 'text-red-400' : (trendInputs.poamAging?.over60 || 0) > 0 ? 'text-yellow-400' : 'text-emerald-400'}
        />
        <AggTile
          icon={TrendingUp}
          label="ATO Pressure"
          value={(trendInputs.atoExpiration?.expired || 0) + (trendInputs.atoExpiration?.under30 || 0)}
          sub={`${trendInputs.atoExpiration?.expired || 0} expired · ${trendInputs.atoExpiration?.under30 || 0} under 30d`}
          color={(trendInputs.atoExpiration?.expired || 0) > 0 ? 'text-red-400' : (trendInputs.atoExpiration?.under30 || 0) > 0 ? 'text-yellow-400' : 'text-emerald-400'}
        />
      </div>

      {/* ── Leadership analytics panels ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <AnalyticsPanel title="Top Risk Sites" icon={Flame}>
          <div className="space-y-3">
            {topRiskSites.length ? topRiskSites.map((site, idx) => (
              <div key={site.id} className="rounded-lg border border-scorva-border bg-scorva-hover/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{idx + 1}. {site.label}</div>
                    <div className="text-[10px] font-mono text-scorva-muted">{site.id}</div>
                  </div>
                  <div className={`text-xl font-bold font-mono ${riskColor(site.score)}`}>{site.score}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] text-scorva-muted">
                  <span>POAM {site.drivers.criticalHighPoams}</span>
                  <span>Events {site.drivers.criticalHighEvents}</span>
                  <span>ATO {site.drivers.expiringAtos + site.drivers.expiredAtos}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-scorva-muted">No risk signals available yet.</p>
            )}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Program Trend Inputs" icon={TrendingUp}>
          <div className="space-y-5">
            <BarList
              title="POAM Aging"
              bars={[
                { label: 'Under 30d', value: trendInputs.poamAging?.under30 || 0, color: 'green' },
                { label: 'Over 30d', value: trendInputs.poamAging?.over30 || 0, color: 'yellow' },
                { label: 'Over 60d', value: trendInputs.poamAging?.over60 || 0, color: 'orange' },
                { label: 'Over 90d', value: trendInputs.poamAging?.over90 || 0, color: 'red' },
              ]}
            />
            <BarList
              title="Event Severity"
              bars={[
                { label: 'Critical', value: trendInputs.eventSeverity?.Critical || 0, color: 'red' },
                { label: 'High', value: trendInputs.eventSeverity?.High || 0, color: 'orange' },
                { label: 'Medium', value: trendInputs.eventSeverity?.Medium || 0, color: 'yellow' },
                { label: 'Low', value: trendInputs.eventSeverity?.Low || 0, color: 'blue' },
              ]}
            />
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="ATO Expiration Bands" icon={Clock}>
          <BarList
            bars={[
              { label: 'Expired', value: trendInputs.atoExpiration?.expired || 0, color: 'red' },
              { label: 'Under 30d', value: trendInputs.atoExpiration?.under30 || 0, color: 'orange' },
              { label: 'Under 60d', value: trendInputs.atoExpiration?.under60 || 0, color: 'yellow' },
              { label: 'Under 90d', value: trendInputs.atoExpiration?.under90 || 0, color: 'blue' },
              { label: 'Beyond 90d', value: trendInputs.atoExpiration?.beyond90 || 0, color: 'green' },
            ]}
          />
        </AnalyticsPanel>
      </div>

      {/* ── Cross-site heatmap ── */}
      <div className="sc-surface-block p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-scorva-border flex items-center gap-2">
          <Radar size={13} className="text-scorva-muted" />
          <span className="text-[10px] font-mono font-semibold text-scorva-muted uppercase tracking-widest">Cross-Site Risk Heatmap</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-scorva-border bg-scorva-hover/30">
                <th className="px-4 py-2.5 text-left font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Site</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Risk</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Controls</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">POAM</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">ATO</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-scorva-border">
              {heatmap.map(row => (
                <tr key={row.siteId} className="hover:bg-scorva-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-scorva-text">{row.siteLabel}</div>
                    <div className="text-[10px] font-mono text-scorva-muted">{row.siteId}</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-mono font-bold ${riskColor(row.riskScore)}`}>{row.riskScore}</span>
                    <div className="text-[9px] text-scorva-muted">{row.riskLevel}</div>
                  </td>
                  <td className="px-3 py-3 text-center">{heatCell(100 - row.controls, 30, 50)}</td>
                  <td className="px-3 py-3 text-center">{heatCell(row.poams, 2, 5)}</td>
                  <td className="px-3 py-3 text-center">{heatCell(row.atos, 1, 3)}</td>
                  <td className="px-3 py-3 text-center">{heatCell(row.events, 1, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Per-site breakdown table ── */}
      <div className="sc-surface-block p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-scorva-border flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold text-scorva-muted uppercase tracking-widest">Site Breakdown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-scorva-border bg-scorva-hover/30">
                <th className="px-4 py-2.5 text-left font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Site</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] text-scorva-muted uppercase tracking-wider w-40">Controls Impl.</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Open POAMs</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Overdue</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Active ATOs</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Events (New)</th>
                <th className="px-3 py-2.5 text-center font-mono text-[10px] text-scorva-muted uppercase tracking-wider">Crit/High</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-scorva-border">
              {sites.map(site => {
                const cp    = site.controls.pct;
                const barCl = cp >= 70 ? 'bg-emerald-500' : cp >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <tr key={site.id} className="hover:bg-scorva-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-scorva-text">{site.label}</div>
                      <div className="text-[10px] font-mono text-scorva-muted">{site.id}</div>
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-bold ${pctLight(cp)}`}>{cp}%</span>
                        <span className="text-scorva-muted text-[10px]">{site.controls.implemented}/{site.controls.total}</span>
                      </div>
                      <Bar pct={cp} color={barCl} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-mono font-bold ${site.poams.open > 0 ? 'text-orange-400' : 'text-scorva-muted'}`}>
                        {site.poams.open}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-mono font-bold ${trafficLight(site.poams.overdue, 1, 3)}`}>
                        {site.poams.overdue}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-scorva-text">{site.atos.active}</span>
                      {site.atos.expiring > 0 && (
                        <span className="ml-1 text-[9px] font-mono text-yellow-400">+{site.atos.expiring} exp</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-mono font-bold ${site.events.new > 0 ? 'text-yellow-400' : 'text-scorva-muted'}`}>
                        {site.events.new}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-mono font-bold ${site.events.criticalHigh > 0 ? 'text-red-400' : 'text-scorva-muted'}`}>
                        {site.events.criticalHigh}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        className="p-1 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover transition-colors"
                        title="View site"
                        onClick={() => navigate(`/monitoring`)}
                      >
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Totals footer */}
              {sites.length > 1 && (
                <tr className="bg-scorva-hover/40 font-semibold border-t-2 border-scorva-border">
                  <td className="px-4 py-2.5 text-[11px] font-mono text-scorva-muted uppercase tracking-widest">
                    All Sites
                  </td>
                  <td className="px-4 py-2.5 w-40">
                    <span className={`font-mono font-bold text-sm ${pctLight(totals.controls.pct)}`}>{totals.controls.pct}%</span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono">{totals.poams.open}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-orange-400">{totals.poams.overdue}</td>
                  <td className="px-3 py-2.5 text-center font-mono">{totals.atos.active}</td>
                  <td className="px-3 py-2.5 text-center font-mono">{totals.events.new}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-red-400">{totals.events.criticalHigh}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
