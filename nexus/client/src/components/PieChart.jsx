import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#dc2626', '#d97706', '#15803d', '#1d4ed8', '#0f766e', '#ec4899'];

export default function RiskPieChart({ data = [], label = 'Items', height = 320 }) {
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

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      style={{ width: '100%', height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
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
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
