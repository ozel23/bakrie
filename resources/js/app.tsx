import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
try {
  localStorage.removeItem('epita.preview.v1');
} catch {}
createInertiaApp({
  title: (title) => (title ? `${title} · EPITA` : 'EPITA · Operasional terhubung'),
  resolve: async (name) =>
    name === 'Error'
      ? (await import('./pages/Error')).default
      : name === 'Login'
        ? (await import('./pages/Login')).default
        : (await import('./pages/Workspace')).default,
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />);
  },
  progress: { color: '#FFD301', showSpinner: false },
});
