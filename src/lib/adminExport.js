import { buildExcelHtml, downloadBlob } from '@/lib/reportExport';

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

export function downloadStyledExcelTable(
  filename,
  { sheetName = 'ZANA', title = '', headers = [], rows = [], createdAt, logoDataUrl } = {},
) {
  const normalizedFilename = String(filename || 'export.xls').toLowerCase().endsWith('.xls')
    ? String(filename || 'export.xls')
    : `${String(filename || 'export')}.xls`;

  const safeSheetName = String(sheetName || 'ZANA').slice(0, 31);
  const sectionTitle = title || sheetName || 'Export';

  const columns = Math.max(1, Number(headers?.length ?? 0) || Number(rows?.[0]?.length ?? 0) || 1);
  const html = buildExcelHtml({
    sheetName: safeSheetName,
    title: sectionTitle,
    createdAt,
    logoDataUrl,
    sections: [
      {
        title: sectionTitle,
        columns,
        headers: Array.isArray(headers) && headers.length ? headers : undefined,
        rows: Array.isArray(rows) ? rows : [],
      },
    ],
  });

  downloadBlob(normalizedFilename, new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
}
