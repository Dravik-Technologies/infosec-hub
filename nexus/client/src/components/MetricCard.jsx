import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

function AnimatedValue({ value, suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numValue = typeof value === 'number' ? value : parseInt(value, 10);
    if (!Number.isFinite(numValue)) {
      setDisplayValue(value);
      return;
    }

    let frame;
    const duration = 1500;
    const startTime = Date.now();
    const increment = numValue / (duration / 16);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayValue(Math.floor(numValue * progress));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(numValue);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <>
      {displayValue}
      {suffix && <sup>{suffix}</sup>}
    </>
  );
}

export default function MetricCard({ label, value, suffix = '', hint, tone = 'default', trend = null }) {
  const toneClass = tone !== 'default' ? ` tone-${tone}` : '';
  const trendClass = trend ? ` trend-${trend.direction || 'flat'}` : '';
  const trendLabel = trend?.direction === 'improving'
    ? 'Improving'
    : trend?.direction === 'degrading'
      ? 'Degrading'
      : 'Flat';

  return (
    <motion.div
      className={`kpi-card${toneClass}${trendClass}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        <AnimatedValue value={value} suffix={suffix} />
      </div>
      {trend && (
        <motion.div
          className={`kpi-trend trend-${trend.direction || 'flat'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <span className="kpi-trend-pill">{trendLabel}</span>
          <span>{trend.label}</span>
        </motion.div>
      )}
      {hint && (
        <motion.div
          className="kpi-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {hint}
        </motion.div>
      )}
    </motion.div>
  );
}
