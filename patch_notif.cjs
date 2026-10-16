const fs = require('fs');
let content = fs.readFileSync('src/utils/notificationService.ts', 'utf-8');

const search = `    // Filtragem precisa e direcionada para cada perfil
    const filtered = all.filter((n) => {
      // 0. Se a notificação foi limpa individualmente por este usuário, oculta apenas para ele
      if (isNotificationClearedForUser(n, currentUser)) {
        return false;
      }

      if (isDeveloper) return true;

      // Broadcast global (todas as notificações de fluxo e sistema para a equipe)
      if (n.targetGroup === 'ALL' || (!n.targetUser && !n.targetGroup && !n.targetRole && !n.targetRoles && !n.operador)) {
        return true;
      }

      // 1. Notificação enviada especificamente para este usuário pelo nome
      if (n.targetUser) {
        const tUserNorm = n.targetUser.trim().toLowerCase();
        if (userNameNorm && (tUserNorm === userNameNorm || tUserNorm.includes(userNameNorm) || userNameNorm.includes(tUserNorm))) {
          return true;
        }
        if (!n.targetRoles && !n.targetGroup) {
          return false;
        }
      }

      // 2. Diretoria (CEO, Gerente Geral, Supervisor, Developer):
      if (isDiretoria) {
        return true;
      }

      // 3. Vendedor / Recepção:
      if (isVendedorOuRecepcao) {
        if (n.operador) {
          const opNorm = n.operador.trim().toLowerCase();
          if (userNameNorm && (opNorm === userNameNorm || opNorm.includes(userNameNorm) || userNameNorm.includes(opNorm))) {
            return true;
          }
        }
        if (n.targetGroup === 'VENDEDOR') return true;
        if (n.targetRoles && n.targetRoles.some((tr) => tr.toLowerCase().includes('vendedor') || tr.toLowerCase().includes('recep'))) return true;
        if (n.targetRole && (n.targetRole.toLowerCase().includes('vendedor') || n.targetRole.toLowerCase().includes('recep'))) return true;
      }

      // 4. Operador de Setor de Produção (Design, Impressão, Calandra, Costura, Conferência, Expedição)
      if (n.stage && userRoleNorm) {
        const stageNorm = n.stage.toLowerCase();
        if (userRoleNorm.includes(stageNorm) || stageNorm.includes(userRoleNorm)) {
          return true;
        }
      }

      if (n.targetRoles && n.targetRoles.some((tr) => userRoleNorm.includes(tr.toLowerCase()))) return true;
      if (n.targetRole && userRoleNorm.includes(n.targetRole.toLowerCase())) return true;

      return false;
    });`;

const replace = `    // Filtragem precisa e direcionada para cada perfil
    const filtered = all.filter((n) => {
      // 0. Se a notificação foi limpa individualmente por este usuário, oculta apenas para ele
      if (isNotificationClearedForUser(n, currentUser)) {
        return false;
      }

      if (isDeveloper) return true;

      // REGRA ISOLADA PARA VENDEDORES: SÓ RECEBEM NOTIFICAÇÕES DO SEU PRÓPRIO SERVIÇO
      if (isVendedorOuRecepcao) {
        // Se a notificação está vinculada a um operador específico (ex: avanço de OS)
        if (n.operador) {
          const opNorm = n.operador.trim().toLowerCase();
          if (userNameNorm && (opNorm === userNameNorm || opNorm.includes(userNameNorm) || userNameNorm.includes(opNorm))) {
            return true;
          }
          // Se pertence a outro vendedor, NÃO RECEBE (mesmo que seja targetGroup ALL)
          return false;
        }

        // Se foi enviado especificamente para ele
        if (n.targetUser) {
          const tUserNorm = n.targetUser.trim().toLowerCase();
          if (userNameNorm && (tUserNorm === userNameNorm || tUserNorm.includes(userNameNorm) || userNameNorm.includes(tUserNorm))) {
            return true;
          }
          return false; // Se foi para outra pessoa específica
        }

        if (n.targetGroup === 'VENDEDOR' || n.targetGroup === 'ALL') return true;
        if (n.targetRoles && n.targetRoles.some((tr) => tr.toLowerCase().includes('vendedor') || tr.toLowerCase().includes('recep'))) return true;
        if (n.targetRole && (n.targetRole.toLowerCase().includes('vendedor') || n.targetRole.toLowerCase().includes('recep'))) return true;

        return (!n.targetUser && !n.targetGroup && !n.targetRole && !n.targetRoles);
      }

      // Broadcast global (todas as notificações de fluxo e sistema para a equipe restante)
      if (n.targetGroup === 'ALL' || (!n.targetUser && !n.targetGroup && !n.targetRole && !n.targetRoles && !n.operador)) {
        return true;
      }

      // 1. Notificação enviada especificamente para este usuário pelo nome
      if (n.targetUser) {
        const tUserNorm = n.targetUser.trim().toLowerCase();
        if (userNameNorm && (tUserNorm === userNameNorm || tUserNorm.includes(userNameNorm) || userNameNorm.includes(tUserNorm))) {
          return true;
        }
        if (!n.targetRoles && !n.targetGroup) {
          return false;
        }
      }

      // 2. Diretoria (CEO, Gerente Geral, Supervisor, Developer):
      if (isDiretoria) {
        return true;
      }

      // 4. Operador de Setor de Produção (Design, Impressão, Calandra, Costura, Conferência, Expedição)
      if (n.stage && userRoleNorm) {
        const stageNorm = n.stage.toLowerCase();
        if (userRoleNorm.includes(stageNorm) || stageNorm.includes(userRoleNorm)) {
          return true;
        }
      }

      if (n.targetRoles && n.targetRoles.some((tr) => userRoleNorm.includes(tr.toLowerCase()))) return true;
      if (n.targetRole && userRoleNorm.includes(n.targetRole.toLowerCase())) return true;

      return false;
    });`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  fs.writeFileSync('src/utils/notificationService.ts', content);
  console.log('Successfully patched src/utils/notificationService.ts');
} else {
  console.error('Could not find the target code in src/utils/notificationService.ts');
}
