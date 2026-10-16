const fs = require('fs');

// Patch database.ts
let dbContent = fs.readFileSync('src/server/db/database.ts', 'utf-8');
dbContent = dbContent.replace(
  "await ensureSystemStore();",
  "try { await ensureSystemStore(); } catch (e) { console.error('PostgreSQL not available, running in memory-only mode.'); return; }"
);
fs.writeFileSync('src/server/db/database.ts', dbContent);

// Patch ChatRepository.ts
let chatContent = fs.readFileSync('src/server/repositories/ChatRepository.ts', 'utf-8');
chatContent = chatContent.replace(
  "const res = await pgPool.query",
  "try { await pgPool.query('SELECT 1'); } catch (e) { return; }\n      const res = await pgPool.query"
);
fs.writeFileSync('src/server/repositories/ChatRepository.ts', chatContent);

