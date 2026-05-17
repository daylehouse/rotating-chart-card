import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'dist/rotating-chart-card.js',
  output: {
    file: 'rotating-chart-card.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    resolve(),
    terser()
  ]
};
