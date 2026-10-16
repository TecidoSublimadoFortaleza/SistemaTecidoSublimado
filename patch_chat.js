const fs = require('fs');

let content = fs.readFileSync('src/server/repositories/ChatRepository.ts', 'utf-8');

content = content.replace(
  "private static messagesMap = new Map<string, ChatMessage>();",
  "public static messagesMap = new (require('../db/PersistentMap').PersistentMap)('chat_messages', true) as import('../../types/chat').ChatMessage & any;"
);
content = content.replace(
  "private static groupsMap = new Map<string, MessageGroup>();",
  "public static groupsMap = new (require('../db/PersistentMap').PersistentMap)('chat_groups') as import('../../types/chat').MessageGroup & any;"
);
content = content.replace(
  "private static auditLogsList: ChatAuditLog[] = [];",
  "public static auditLogsList = new (require('../db/PersistentArray').PersistentArray)('chat_auditLogs') as import('../../types/chat').ChatAuditLog & any;"
);

content = content.replace(
  "export class ChatRepository {",
  `export class ChatRepository {
  public static async initialize() {
    try {
      const { pgPool } = require('../db/postgres');
      const res = await pgPool.query("SELECT collection, id, data FROM _system_store WHERE collection IN ('chat_messages', 'chat_groups', 'chat_auditLogs')");
      for (const row of res.rows) {
        if (row.collection === 'chat_messages') Map.prototype.set.call(this.messagesMap, row.id, row.data);
        if (row.collection === 'chat_groups') Map.prototype.set.call(this.groupsMap, row.id, row.data);
        if (row.collection === 'chat_auditLogs') Array.prototype.push.call(this.auditLogsList, row.data);
      }
    } catch(e) { console.error('Chat init error', e); }
  }
`
);

fs.writeFileSync('src/server/repositories/ChatRepository.ts', content);
