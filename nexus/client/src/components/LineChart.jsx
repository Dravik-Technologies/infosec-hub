import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';

export default function TrendLineChart({ data = [], label = 'Trend', dataKey = 'value', color = '#1d4ed8', height = 300 }) {
  if (!data || data.length === 0) {
    return (
      <motion.div
        className="empty-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p>No trend data available</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{ width: '100%', height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            stroke="var(--muted)"
            style={{ fontSize: '0.75rem' }}
          />
          <YAxis
            stroke="var(--muted)"
            style={{ fontSize: '0.75rem' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              boxShadow: 'var(--shadow-md)',
            }}
            labelStyle={{ color: 'var(--text)' }}
            formatter={(value) => [Math.round(value), label]}
          />
          <Legend
            wrapperStyle={{ paddingTop: '1rem', fontSize: '0.875rem' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6 }}
            fill="url(#gradient)"
            isAnimationActive
            animationDuration={1500}
            name={label}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
