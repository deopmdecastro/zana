import { downloadBlob } from '@/lib/reportExport';

export function downloadJson(filename, data) {
  const json = JSON.stringify(data ?? null, null, 2);
  downloadBlob(filename, new Blob([json], { type: 'application/json;charset=utf-8' }));
}

export function downloadExcelTable(filename, { sheetName = 'ZANA', title = '', headers = [], rows = [] } = {}) {
  const escapeCsv = (value) => {
    const str = String(value ?? '');
    if (/[",\r\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const headerLine = (headers ?? []).map(escapeCsv).join(';');
  const bodyLines = (rows ?? []).map((row) => (row ?? []).map(escapeCsv).join(';'));

  const lines = [];
  if (title) lines.push(escapeCsv(title));
  if (headerLine) lines.push(headerLine);
  lines.push(...bodyLines);

  const normalizedFilename = String(filename || 'export.csv').endsWith('.csv')
    ? String(filename || 'export.csv')
    : `${String(filename || 'export')}.csv`;

  const csv = `\uFEFF${lines.join('\r\n')}\r\n`;
  downloadBlob(normalizedFilename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
