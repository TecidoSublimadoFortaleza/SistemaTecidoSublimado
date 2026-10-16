// Utilitários de data e formatação para o módulo fiscal (NF-e, NFC-e e Gerenciador)

export const getTodayFormatted = (): string => {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

export const parseDateToMidnight = (dateStr?: string): number | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  // DD/MM/YYYY ou DD/MM/YY
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day, 0, 0, 0, 0).getTime();
      }
    }
  }

  // YYYY-MM-DD
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2].substring(0, 2), 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day, 0, 0, 0, 0).getTime();
      }
    }
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  }

  return null;
};

export const parseDateToEndOfDay = (dateStr?: string): number | null => {
  const ts = parseDateToMidnight(dateStr);
  if (ts === null) return null;
  return ts + 24 * 60 * 60 * 1000 - 1;
};
