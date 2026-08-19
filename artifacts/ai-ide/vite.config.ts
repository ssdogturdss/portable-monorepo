import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// PORT and BASE_PATH are injected by Replit's artifact runner.
// Outside Replit they fall back to sensible defaults so the dev server
// starts without any special environment setup.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig(async () => {
  const extraPlugins = [];

  // Replit-only dev overlay plugins — skipped outside Replit and in production
  if (process.env.NODE_ENV !== 'production' && process.env.REPL_ID) {
    const [{ default: runtimeErrorOverlay }, { cartographer }, { devBanner }] =
      await Promise.all([
        import('@replit/vite-plugin-runtime-error-modal'),
        import('@replit/vite-plugin-cartographer'),
        import('@replit/vite-plugin-dev-banner'),
      ]);
    extraPlugins.push(
      runtimeErrorOverlay(),
      cartographer({ root: path.resolve(import.meta.dirname, '..') }),
      devBanner(),
    );
  }

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...extraPlugins],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'attached_assets',
        ),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
