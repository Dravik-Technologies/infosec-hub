import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      '/api':  { target: 'http://localhost:8090', changeOrigin: true },
      '/auth': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-recharts': ['recharts'],
          // Page chunks for code splitting
          'page-dashboard': ['./src/pages/ProgramManagementPage.jsx'],
          'page-security': ['./src/pages/ProgramSecurityPage.jsx'],
          'page-cyber': ['./src/pages/ProgramCyberPage.jsx'],
          'page-admin': ['./src/pages/AdminPage.jsx'],
          // Component chunks
          'components-charts': [
            './src/components/LineChart.jsx',
            './src/components/BarChart.jsx',
            './src/components/PieChart.jsx',
            './src/components/DonutChart.jsx',
          ],
          'components-viz': [
            './src/components/TimelineGantt.jsx',
            './src/components/Calendar.jsx',
          ],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
