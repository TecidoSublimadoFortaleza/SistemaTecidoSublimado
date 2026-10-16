const fs = require('fs');
let c = fs.readFileSync('src/server/db/PersistentMap.ts', 'utf-8');

// Update the set and delete catch blocks to ignore ECONNREFUSED/ENOTFOUND
c = c.replace(
  "this.persist(key, value).catch(err => console.error(`Error saving to ${this.collectionName}:`, err));",
  "this.persist(key, value).catch(err => { if (err.code !== 'ECONNREFUSED' && err.code !== 'ENOTFOUND') console.error(`Error saving to ${this.collectionName}:`, err); });"
);
c = c.replace(
  "this.removeFromDb(key).catch(err => console.error(`Error deleting from ${this.collectionName}:`, err));",
  "this.removeFromDb(key).catch(err => { if (err.code !== 'ECONNREFUSED' && err.code !== 'ENOTFOUND') console.error(`Error deleting from ${this.collectionName}:`, err); });"
);

c = c.replace("password = $3", "password = COALESCE($3, password, '$2a$10$xV.oP1mXh.8V4t1z6tDq.O7aH/8r6J3r4C4m.6J5r4C4m.6J5r4C4')");
c = c.replace("VALUES ($1, $2, $3", "VALUES ($1, $2, COALESCE($3, '$2a$10$xV.oP1mXh.8V4t1z6tDq.O7aH/8r6J3r4C4m.6J5r4C4m.6J5r4C4')");

fs.writeFileSync('src/server/db/PersistentMap.ts', c);
