import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { motion } from 'framer-motion';

export default function HorizontalBarChart({ data = [], label = 'Value', dataKey = 'value', colors = ['#1d4ed8'], height = 300 }) {
  if (!data || data.length === 0) {
    return (
      <motion.div
        className="empty-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p>No data available</p>
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
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" stroke="var(--muted)" style={{ fontSize: '0.75rem' }} />
          <YAxis
            dataKey="name"
            type="category"
            stroke="var(--muted)"
            style={{ fontSize: '0.75rem' }}
            width={95}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              boxShadow: 'var(--shadow-md)',
            }}
            labelStyle={{ color: 'var(--text)' }}
            formatter={(value) => [value, label]}
          />
          <Legend
            wrapperStyle={{ paddingTop: '1rem', fontSize: '0.875rem' }}
          />
          <Bar
            dataKey={dataKey}
            fill={colors[0] || '#1d4ed8'}
            radius={[0, 8, 8, 0]}
            isAnimationActive
            animationDuration={1500}
            name={label}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
