/**
 * Utility functions for formatting values in the SubliGestão ERP.
 */

export function formatDateBR(dateString?: string | null): string {
  if (!dateString) return '---';
  
  const cleanStr = dateString.trim();
  
  // If already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanStr)) {
    return cleanStr;
  }
  
  // If in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    const [year, month, day] = cleanStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Handle ISO strings or other date parseable formats
  try {
    const date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}

  return cleanStr;
}

export function formatElapsedDuration(diffMs: number): string {
  if (diffMs <= 0 || isNaN(diffMs)) return '00:00:01';
  const hrs = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function parseDurationToMs(dur?: string): number {
  if (!dur) return 0;
  const parts = dur.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
}
