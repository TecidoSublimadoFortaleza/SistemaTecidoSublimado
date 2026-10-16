const fs = require('fs');
let c = fs.readFileSync('src/server/db/PersistentArray.ts', 'utf-8');

c = c.replace(
  ".catch(console.error);",
  ".catch(err => { if (err.code !== 'ECONNREFUSED' && err.code !== 'ENOTFOUND') console.error(`Error saving to ${this.collectionName}:`, err); });"
);

fs.writeFileSync('src/server/db/PersistentArray.ts', c);
