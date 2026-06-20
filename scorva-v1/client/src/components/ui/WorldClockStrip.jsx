import { useEffect, useMemo, useState } from 'react';

const CLOCK_ZONES = [
  { label: 'Eastern', detail: 'New York', timeZone: 'America/New_York' },
  { label: 'Central', detail: 'Chicago', timeZone: 'America/Chicago' },
  { label: 'Mountain', detail: 'Denver', timeZone: 'America/Denver' },
  { label: 'Pacific', detail: 'Los Angeles', timeZone: 'America/Los_Angeles' },
  { label: 'Hawaii', detail: 'Honolulu', timeZone: 'Pacific/Honolulu' },
];

function formatZoneTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export default function WorldClockStrip({ className = '' }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clocks = useMemo(
    () => CLOCK_ZONES.map((zone) => ({ ...zone, time: formatZoneTime(now, zone.timeZone) })),
    [now]
  );

  return (
    <div className={`sc-world-clock-strip ${className}`.trim()}>
      {clocks.map((zone) => (
        <div key={zone.label} className="sc-world-clock-cell">
          <span className="sc-world-clock-label">{zone.label}</span>
          <strong className="sc-world-clock-time">{zone.time}</strong>
          <span className="sc-world-clock-detail">{zone.detail}</span>
        </div>
      ))}
    </div>
  );
}
