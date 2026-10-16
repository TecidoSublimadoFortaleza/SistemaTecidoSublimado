const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');
content = `import { Database } from './src/server/db/database';\nimport { ChatRepository } from './src/server/repositories/ChatRepository';\n` + content;
fs.writeFileSync('server.ts', content);
