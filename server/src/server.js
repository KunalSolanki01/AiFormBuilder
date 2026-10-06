import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 AI Form Builder API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Node closes idle keep-alive connections after 5s by default. A proxy (Vite in dev, Render/Railway/a load
// balancer in production) that reuses such a connection at that instant gets "ECONNRESET" and a spurious 500.
// Keeping connections open longer than any proxy's idle timeout (typically 60s) avoids that race.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000; // must be greater than keepAliveTimeout

const shutdown = (signal) => {
  console.log(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
