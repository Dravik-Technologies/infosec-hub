import { motion } from 'framer-motion';

function getStatusColor(status) {
  const s = (status || '').toLowerCase();
  if (/complete|active|approved/.test(s)) return '#15803d';
  if (/critical|overdue|risk|behind/.test(s)) return '#dc2626';
  if (/watch|pending|upcoming|slipped/.test(s)) return '#d97706';
  return '#1d4ed8';
}

function calculateDaysUntil(targetDate) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const today = new Date();
  const diffMs = target - today;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatDateRange(startDate, endDate) {
  const start = startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const end = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  return `${start} → ${end}`;
}

export default function TimelineGantt({ items = [], startDate, endDate }) {
  if (!items || items.length === 0) {
    return (
      <motion.div
        className="empty-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p>No timeline items</p>
      </motion.div>
    );
  }

  const timelineStart = startDate ? new Date(startDate) : new Date();
  const timelineEnd = endDate ? new Date(endDate) : new Date(timelineStart.getTime() + 90 * 24 * 60 * 60 * 1000);
  const totalDays = (timelineEnd - timelineStart) / (1000 * 60 * 60 * 24);

  const getPosition = (date) => {
    if (!date) return 0;
    const d = new Date(date);
    const daysSinceStart = (d - timelineStart) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (daysSinceStart / totalDays) * 100));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="timeline-gantt"
    >
      <div className="timeline-header">
        <span className="timeline-start">{timelineStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span className="timeline-end">{timelineEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>

      <div className="timeline-track-bg">
        <div className="timeline-marker-today" style={{ left: `${getPosition(new Date())}%` }} title="Today" />
      </div>

      {items.map((item, index) => {
        const daysUntil = calculateDaysUntil(item.date || item.targetDate);
        const pos = getPosition(item.date || item.targetDate);
        const statusColor = getStatusColor(item.status);

        return (
          <motion.div
            key={item.id || index}
            className="timeline-item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
          >
            <div className="timeline-label">
              <strong>{item.title || item.name}</strong>
              {daysUntil !== null && (
                <small style={{ color: daysUntil < 0 ? '#dc2626' : daysUntil < 30 ? '#d97706' : '#64748b' }}>
                  {daysUntil < 0 ? `${Math.abs(daysUntil)}d ago` : daysUntil === 0 ? 'Today' : `${daysUntil}d away`}
                </small>
              )}
            </div>

            <div className="timeline-bar-container">
              <div className="timeline-bar-track">
                <motion.div
                  className="timeline-bar-fill"
                  style={{ left: `${pos}%`, backgroundColor: statusColor }}
                  initial={{ width: 0 }}
                  animate={{ width: '12px' }}
                  transition={{ delay: index * 0.08 + 0.3, duration: 0.5 }}
                  title={item.date || item.targetDate}
                />
              </div>
            </div>

            <div className="timeline-status">
              <span
                className="timeline-badge"
                style={{ background: statusColor, color: '#fff' }}
              >
                {item.status || 'Planned'}
              </span>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
