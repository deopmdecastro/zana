import { downloadBlob } from '@/lib/reportExport';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function downloadJson(filename, data) {
  const json = JSON.stringify(data ?? null, null, 2);
  downloadBlob(filename, new Blob([json], { type: 'application/json;charset=utf-8' }));
}

export function downloadExcelTable(filename, { sheetName = 'ZANA', title = '', headers = [], rows = [] } = {}) {
  const safeSheetName = String(sheetName || 'ZANA').slice(0, 31);
  const headerRow = (headers ?? []).map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const bodyRows = (rows ?? [])
    .map((row) => {
      const cols = (row ?? []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('');
      return `<tr>${cols}</tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <!--[if gte mso 9]><xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>${escapeHtml(safeSheetName)}</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml><![endif]-->
    <style>
      body { font-family: Arial, sans-serif; }
      h1 { font-size: 16px; margin: 0 0 10px; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; vertical-align: top; }
      th { background: #f3f3f3; font-weight: bold; }
    </style>
  </head>
  <body>
    ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
    <table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`;

  downloadBlob(filename, new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
}

