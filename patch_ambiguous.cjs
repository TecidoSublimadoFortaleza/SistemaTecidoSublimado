const fs = require('fs');
let c = fs.readFileSync('src/server/db/PersistentMap.ts', 'utf-8');

c = c.replace(
  "COALESCE($3, password,",
  "COALESCE($3, users.password,"
);

fs.writeFileSync('src/server/db/PersistentMap.ts', c);
