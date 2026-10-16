const fs = require('fs');

let content = fs.readFileSync('src/server/repositories/ChatRepository.ts', 'utf-8');

// Replace previous broken replacement if needed
content = content.replace("public static messagesMap: any = new (require('../db/PersistentMap').PersistentMap)('chat_messages', true);", "public static messagesMap = new PersistentMap<string, ChatMessage>('chat_messages', true);");
content = content.replace("public static groupsMap: any = new (require('../db/PersistentMap').PersistentMap)('chat_groups');", "public static groupsMap = new PersistentMap<string, MessageGroup>('chat_groups');");
content = content.replace("public static auditLogsList: any = new (require('../db/PersistentArray').PersistentArray)('chat_auditLogs');", "public static auditLogsList = new PersistentArray<ChatAuditLog>('chat_auditLogs');");
content = content.replace("const { pgPool } = require('../db/postgres');", ""); // We will import pgPool properly

// Check if import already exists
if (!content.includes("import { PersistentMap }")) {
  content = `import { PersistentMap } from '../db/PersistentMap';\nimport { PersistentArray } from '../db/PersistentArray';\nimport { pgPool } from '../db/postgres';\n` + content;
}

fs.writeFileSync('src/server/repositories/ChatRepository.ts', content);
