/** Déclenche le téléchargement d'un contenu texte généré côté client. */
export function downloadText(filename: string, content: string, mime: string): void {
  // Le BOM garantit l'ouverture correcte des accents dans Excel.
  const payload = mime.startsWith('text/csv') ? `\uFEFF${content}` : content;
  const url = URL.createObjectURL(new Blob([payload], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Sérialise des lignes en CSV au format français (séparateur `;`, virgule décimale). */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((row) => row.map(toCsvCell).join(';')).join('\r\n');
}

function toCsvCell(value: string | number): string {
  if (typeof value === 'number') {
    return String(value).replace('.', ',');
  }
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsText(file);
  });
}
