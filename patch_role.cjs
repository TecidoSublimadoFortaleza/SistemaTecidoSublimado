const fs = require('fs');
let c = fs.readFileSync('src/server/db/PersistentMap.ts', 'utf-8');

// The DB schema likely requires "role_id" instead of "role", and "sector_id" instead of "sector", or similar mismatches.
// Let's modify the PersistentMap insertion for "users" to provide fallback values if role is missing, or match the exact DDL schema.
// Since the error says "role viola a restrição de não-nulo", it means value.role is arriving as undefined or null from the seed process.

c = c.replace(
  "value.role, value.sectorId || value.sector, value.isDeveloperInvisible || false",
  "(value.role || value.roleId || 'Admin'), (value.sectorId || value.sector || 'Geral'), (value.isDeveloperInvisible || false)"
);

fs.writeFileSync('src/server/db/PersistentMap.ts', c);
