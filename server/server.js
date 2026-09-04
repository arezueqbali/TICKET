import 'dotenv/config';
import { app } from './src/app.js';

const PORT = process.env.PORT || 4000;

// Exported so an embedding host (e.g. the Electron desktop wrapper) can await
// server startup instead of guessing with a timer.
export const ready = new Promise((resolve) => {
  app.listen(PORT, () => {
    console.log(`CineBook API listening on http://localhost:${PORT}/api`);
    resolve();
  });
});
