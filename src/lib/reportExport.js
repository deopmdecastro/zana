export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadJsPdf() {
  const jspdfMod = await import('jspdf');
  return jspdfMod.jsPDF ?? jspdfMod.default ?? jspdfMod;
}

async function svgUrlToPngDataUrl(svgUrl, { width = 120 } = {}) {
  const res = await fetch(svgUrl);
  if (!res.ok) throw new Error('logo_fetch_failed');
  const svgText = await res.text();

  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const scale = width / (img.naturalWidth || 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.naturalWidth || width) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || width) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_context_failed');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function safeSvgUrlToPngDataUrl(svgUrl, { width = 120 } = {}) {
  if (!svgUrl) return null;
  try {
    return await svgUrlToPngDataUrl(svgUrl, { width });
  } catch (err) {
    console.warn('failed to convert svg to png', err);
    return null;
  }
}

function addHeader(doc, { title, logoDataUrl, createdAt } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  const brand = getThemeColorRgb('--primary', '340 52% 31%');
  const border = { r: 225, g: 225, b: 225 };
  const text = { r: 20, g: 20, b: 20 };
  const muted = { r: 120, g: 120, b: 120 };

  // Accent bar (brand)
  doc.setFillColor(brand.r, brand.g, brand.b);
  doc.rect(0, 0, pageWidth, 6, 'F');

  const titleY = 34;
  const metaY = 52;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, 16, 96, 24, undefined, 'FAST');
    } catch (err) {
      console.warn('failed to embed logo', err);
    }
  }

  doc.setTextColor(text.r, text.g, text.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(String(title ?? ''), pageWidth - margin, titleY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(muted.r, muted.g, muted.b);
  const when = createdAt ? new Date(createdAt) : new Date();
  const meta = when.toLocaleString('pt-PT');

  const pillPadX = 10;
  const pillH = 16;
  const pillW = Math.min(pageWidth - margin * 2, doc.getTextWidth(meta) + pillPadX * 2);
  const pillX = pageWidth - margin - pillW;
  const pillY = metaY - 12;

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(pillX, pillY, pillW, pillH, 8, 8, 'F');
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text(meta, pillX + pillW / 2, metaY - 1, { align: 'center' });

  doc.setDrawColor(border.r, border.g, border.b);
  doc.line(margin, 66, pageWidth - margin, 66);

  // Subtle footer baseline margin guidance (not visible in content area)
  doc.setDrawColor(255, 255, 255);
  doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);

  return 84;
}

function addKeyValues(doc, items, { startY, columns = 2 } = {}) {
  const margin = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const brand = getThemeColorRgb('--primary', '340 52% 31%');
  const border = { r: 228, g: 228, b: 228 };
  const bg = { r: 250, g: 250, b: 250 };
  const text = { r: 20, g: 20, b: 20 };
  const muted = { r: 115, g: 115, b: 115 };

  const gap = 12;
  const cols = Math.max(1, Math.min(3, Number(columns) || 2));
  const cardW = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = 46;

  let y = startY ?? 84;
  let i = 0;

  for (const [label, value] of items) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = margin + col * (cardW + gap);
    const cardY = y + row * (cardH + gap);

    if (cardY + cardH > pageHeight - 42) {
      doc.addPage();
      y = 84;
      i = 0;
      continue;
    }

    doc.setFillColor(bg.r, bg.g, bg.b);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.roundedRect(x, cardY, cardW, cardH, 10, 10, 'FD');

    // Accent line
    doc.setFillColor(brand.r, brand.g, brand.b);
    doc.roundedRect(x, cardY, 4, cardH, 10, 10, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.text(String(label), x + 12, cardY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(text.r, text.g, text.b);
    doc.text(String(value), x + cardW - 12, cardY + 32, { align: 'right' });

    i += 1;
  }

  const rowsCount = Math.ceil((items?.length ?? 0) / cols);
  return y + rowsCount * cardH + Math.max(0, rowsCount - 1) * gap + 8;
}

function addSectionTitle(doc, title, { startY } = {}) {
  const margin = 36;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY ?? 84;
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 84;
  }

  const brand = getThemeColorRgb('--primary', '340 52% 31%');
  const text = { r: 20, g: 20, b: 20 };

  doc.setFillColor(brand.r, brand.g, brand.b);
  doc.roundedRect(margin, y - 12, 4, 16, 2, 2, 'F');

  doc.setTextColor(text.r, text.g, text.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(String(title), margin + 10, y);
  return y + 18;
}

function addTable(doc, { headers = [], rows = [], startY, columnWidths, columnAlign } = {}) {
  const margin = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const brand = getThemeColorRgb('--primary', '340 52% 31%');
  const border = { r: 230, g: 230, b: 230 };
  const text = { r: 20, g: 20, b: 20 };
  const muted = { r: 100, g: 100, b: 100 };
  const zebra = { r: 250, g: 250, b: 250 };

  const widths =
    Array.isArray(columnWidths) && columnWidths.length === headers.length
      ? columnWidths
      : (() => {
          const total = pageWidth - margin * 2;
          const w = total / Math.max(1, headers.length);
          return headers.map(() => w);
        })();

  const lineHeight = 12;
  const padY = 6;
  const padX = 8;

  const aligns = Array.isArray(columnAlign) && columnAlign.length === headers.length ? columnAlign : headers.map(() => 'left');
  const getCellX = (x, w, align) => {
    if (align === 'right') return x + w - padX;
    if (align === 'center') return x + w / 2;
    return x + padX;
  };
  const getTextOpts = (align) => (align === 'right' || align === 'center' ? { align } : undefined);

  const drawHeader = (y) => {
    let x = margin;
    doc.setFillColor(brand.r, brand.g, brand.b);
    doc.setDrawColor(brand.r, brand.g, brand.b);
    doc.roundedRect(margin, y - 14, pageWidth - margin * 2, 22, 8, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    for (let i = 0; i < headers.length; i += 1) {
      const text = doc.splitTextToSize(String(headers[i] ?? ''), widths[i] - padX * 2);
      const align = aligns[i] ?? 'left';
      doc.text(text, getCellX(x, widths[i], align), y, getTextOpts(align));
      x += widths[i];
    }
    return y + 18;
  };

  let y = startY ?? 84;
  y = drawHeader(y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(text.r, text.g, text.b);
  doc.setDrawColor(border.r, border.g, border.b);

  let rowIndex = 0;
  for (const row of rows) {
    const cells = headers.map((_, i) => doc.splitTextToSize(String(row?.[i] ?? ''), widths[i] - padX * 2));
    const rowLines = Math.max(1, ...cells.map((c) => c.length));
    const rowHeight = rowLines * lineHeight + padY * 2;

    if (y + rowHeight > pageHeight - 36) {
      doc.addPage();
      y = 84;
      y = drawHeader(y);
    }

    let x = margin;
    const isZebra = rowIndex % 2 === 1;
    if (isZebra) {
      doc.setFillColor(zebra.r, zebra.g, zebra.b);
      doc.rect(margin, y - 10, pageWidth - margin * 2, rowHeight, 'F');
    }
    doc.setDrawColor(border.r, border.g, border.b);
    doc.rect(margin, y - 10, pageWidth - margin * 2, rowHeight, 'S');

    for (let i = 0; i < headers.length; i += 1) {
      const text = cells[i];
      const align = aligns[i] ?? 'left';
      const cellX = getCellX(x, widths[i], align);
      const cellY = y + padY;
      doc.setTextColor(text.r, text.g, text.b);
      doc.text(text, cellX, cellY, getTextOpts(align));
      x += widths[i];
    }

    y += rowHeight;
    rowIndex += 1;
  }

  return y + 10;
}

function hexToRgb(hex) {
  const cleaned = String(hex ?? '').trim().replace(/^#/, '');
  if (cleaned.length !== 6) return null;
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return { r, g, b };
}

function getThemeColorRgb(varName, fallbackTriplet) {
  const hex = getThemeColorHex(varName, fallbackTriplet);
  return hexToRgb(hex) ?? { r: 107, g: 27, b: 58 };
}

function finalizePdf(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const muted = { r: 140, g: 140, b: 140 };

  const total = doc.getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.text(`Página ${i} de ${total}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
  }
}

function moneyPt(value) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toFixed(2).replace('.', ',');
}

const orderStatusLabelsPt = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  processing: 'Em preparação',
  shipped: 'Enviada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

function csvEscape(value, delimiter) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const mustQuote = str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(delimiter);
  if (!mustQuote) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename, rows, { delimiter = ';', includeBom = true } = {}) {
  const lines = (rows ?? []).map((row) => (row ?? []).map((v) => csvEscape(v, delimiter)).join(delimiter));
  const csv = `${includeBom ? '\uFEFF' : ''}${lines.join('\r\n')}\r\n`;
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

function parseHslTriplet(value) {
  const str = String(value ?? '').trim();
  if (!str) return null;
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const h = Number(parts[0]);
  const s = Number(String(parts[1]).replace('%', ''));
  const l = Number(String(parts[2]).replace('%', ''));
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null;
  return { h, s, l };
}

function hslToHex({ h, s, l } = {}) {
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return '#000000';
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = Math.max(0, Math.min(1, s / 100));
  const ll = Math.max(0, Math.min(1, l / 100));

  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  let r;
  let g;
  let b;

  if (ss === 0) {
    r = g = b = ll;
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }

  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getThemeColorHex(varName, fallbackTriplet) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    const parsed = parseHslTriplet(value || fallbackTriplet);
    return hslToHex(parsed ?? parseHslTriplet(fallbackTriplet));
  } catch {
    return hslToHex(parseHslTriplet(fallbackTriplet));
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureXlsFilename(filename, fallbackBase) {
  const name = String(filename || '').trim();
  if (name) return name.toLowerCase().endsWith('.xls') ? name : `${name}.xls`;
  return `${fallbackBase}.xls`;
}

function buildExcelHtml({ sheetName = 'ZANA', title, createdAt, logoDataUrl, sections = [] } = {}) {
  const primary = getThemeColorHex('--primary', '340 52% 31%');
  const foreground = getThemeColorHex('--foreground', '222.2 84% 4.9%');
  const muted = getThemeColorHex('--muted-foreground', '215.4 16.3% 46.9%');
  const border = getThemeColorHex('--border', '214.3 31.8% 91.4%');
  const background = getThemeColorHex('--background', '0 0% 100%');

  const when = createdAt ? new Date(createdAt) : new Date();

  const sectionHtml = (sections ?? [])
    .map((s) => {
      const rows = (s?.rows ?? [])
        .map(
          (r) =>
            `<tr>${(r ?? [])
              .map((c) => `<td class="cell">${escapeHtml(c)}</td>`)
              .join('')}</tr>`,
        )
        .join('');

      return `
        <table class="table">
          <tr>
            <td class="section" colspan="${Math.max(1, (s?.columns ?? 2) | 0)}">${escapeHtml(s?.title ?? '')}</td>
          </tr>
          ${s?.headers?.length ? `<tr>${s.headers.map((h) => `<th class="th">${escapeHtml(h)}</th>`).join('')}</tr>` : ''}
          ${rows}
        </table>
      `;
    })
    .join('\n');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]><xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(sheetName)}</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml><![endif]-->
        <style>
          body { font-family: Calibri, Arial, sans-serif; color: ${foreground}; background: ${background}; }
          .header { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .header td { padding: 8px 10px; vertical-align: middle; }
          .brand { font-size: 18px; font-weight: 700; color: ${foreground}; }
          .meta { font-size: 11px; color: ${muted}; text-align: right; }
          .table { width: 100%; border-collapse: collapse; margin: 14px 0; }
          .section { background: ${primary}; color: #ffffff; font-weight: 700; padding: 8px 10px; border: 1px solid ${border}; }
          .th { background: #f6f6f6; color: ${foreground}; font-weight: 700; padding: 7px 10px; border: 1px solid ${border}; text-align: left; }
          .cell { padding: 6px 10px; border: 1px solid ${border}; }
        </style>
      </head>
      <body>
        <table class="header">
          <tr>
            <td style="width: 220px;">
              ${logoDataUrl ? `<img src="${logoDataUrl}" style="height: 32px;" />` : ''}
            </td>
            <td>
              <div class="brand">${escapeHtml(title ?? '')}</div>
            </td>
            <td class="meta">${escapeHtml(when.toLocaleString('pt-PT'))}</td>
          </tr>
        </table>
        ${sectionHtml}
      </body>
    </html>
  `.trim();
}

export async function exportReportsExcel({
  filename,
  title = 'Relatórios',
  logoUrl,
  createdAt,
  stats,
  analytics,
  purchaseAdjustments,
} = {}) {
  const logoDataUrl = await safeSvgUrlToPngDataUrl(logoUrl, { width: 180 });
  const safeTitle = title || 'Relatórios';
  const file = ensureXlsFilename(filename, `relatorios_${new Date().toISOString().slice(0, 10)}`);

  const topViewed = analytics?.top_viewed_products ?? [];
  const topSearches = analytics?.top_searches ?? [];
  const topSold = analytics?.top_sold_products ?? [];
  const largestOrders = analytics?.largest_orders ?? [];

  const adjustments = purchaseAdjustments?.topProducts ?? [];

  const html = buildExcelHtml({
    sheetName: 'Relatórios',
    title: safeTitle,
    createdAt,
    logoDataUrl,
    sections: [
      {
        title: 'Resumo',
        columns: 2,
        rows: [
          ['Produtos', stats?.productsCount ?? 0],
          ['Unidades em Stock', stats?.stockUnits ?? 0],
          ['Baixo Stock (≤2)', stats?.lowStock ?? 0],
          ['Total em Compras (€)', moneyPt(stats?.purchasesTotal ?? 0)],
          ['Unidades devolvidas ao fornecedor', stats?.return_units ?? 0],
          ['Valor devolvido (€)', moneyPt(stats?.return_value ?? 0)],
          ['Unidades removidas do stock', stats?.writeoff_units ?? 0],
          ['Valor removido (€)', moneyPt(stats?.writeoff_value ?? 0)],
        ],
      },
      {
        title: 'Produtos mais vistos (30 dias)',
        columns: 2,
        headers: ['Produto', 'Views'],
        rows: topViewed.slice(0, 200).map((p) => [p.product_name ?? '', p.views ?? 0]),
      },
      {
        title: 'Mais pesquisas (30 dias)',
        columns: 2,
        headers: ['Pesquisa', 'Total'],
        rows: topSearches.slice(0, 200).map((q) => [q.query ?? '', q.count ?? 0]),
      },
      {
        title: 'Mais vendidos (30 dias)',
        columns: 2,
        headers: ['Produto', 'Quantidade'],
        rows: topSold.slice(0, 200).map((p) => [p.product_name ?? '', p.quantity ?? 0]),
      },
      {
        title: 'Maiores encomendas (30 dias)',
        columns: 3,
        headers: ['Email', 'Estado', 'Total (€)'],
        rows: largestOrders.slice(0, 200).map((o) => [
          o.customer_email ?? '',
          orderStatusLabelsPt[String(o.status ?? '')] ?? String(o.status ?? ''),
          moneyPt(o.total ?? 0),
        ]),
      },
      {
        title: 'Devoluções / Remoções (Compras)',
        columns: 5,
        headers: ['Produto', 'Devolvido (un.)', 'Removido (un.)', 'Valor devolvido (€)', 'Valor removido (€)'],
        rows: adjustments.slice(0, 200).map((p) => [
          p.product_name ?? '',
          p.devolvido ?? 0,
          p.removido ?? 0,
          moneyPt(p.devolvido_value ?? 0),
          moneyPt(p.removido_value ?? 0),
        ]),
      },
    ],
  });

  downloadBlob(file, new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
}

export async function exportFinanceExcel({ filename, title = 'Financeiro', logoUrl, createdAt, stats } = {}) {
  const logoDataUrl = await safeSvgUrlToPngDataUrl(logoUrl, { width: 180 });
  const safeTitle = title || 'Financeiro';
  const file = ensureXlsFilename(filename, `financeiro_${new Date().toISOString().slice(0, 10)}`);

  const html = buildExcelHtml({
    sheetName: 'Financeiro',
    title: safeTitle,
    createdAt,
    logoDataUrl,
    sections: [
      {
        title: 'Resumo',
        columns: 2,
        rows: [
          ['Investido em Stock (€)', moneyPt(stats?.invested ?? 0)],
          ['Valor Esperado (PVP) (€)', moneyPt(stats?.expected ?? 0)],
          ['Margem Potencial (€)', moneyPt(stats?.marginPotential ?? 0)],
          ['Receita (Entregue) (€)', moneyPt(stats?.revenueDelivered ?? 0)],
          ['Receita pendente (€)', moneyPt(stats?.revenueOpen ?? 0)],
          ['Canceladas (€)', moneyPt(stats?.revenueCancelled ?? 0)],
          ['Compras (Stock) (€)', moneyPt(stats?.purchasesStockTotal ?? 0)],
          ['Despesas (Logística) (€)', moneyPt(stats?.purchasesLogisticsTotal ?? 0)],
          ['Total em Compras (€)', moneyPt(stats?.purchasesTotal ?? 0)],
        ],
      },
      {
        title: 'Investimento por categoria',
        columns: 6,
        headers: ['Categoria', 'Produtos', 'Unidades', 'Investido (€)', 'Valor Esperado (€)', 'Margem (€)'],
        rows: (stats?.byCategory ?? []).map((r) => [
          r.category ?? '',
          r.products ?? 0,
          r.units ?? 0,
          moneyPt(r.invested ?? 0),
          moneyPt(r.expected ?? 0),
          moneyPt((r.expected ?? 0) - (r.invested ?? 0)),
        ]),
      },
    ],
  });

  downloadBlob(file, new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
}

export async function exportReportsPdf({
  filename,
  title = 'Relatórios',
  logoUrl,
  createdAt,
  stats,
  analytics,
  mode = 'download',
} = {}) {
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  const logoDataUrl = await safeSvgUrlToPngDataUrl(logoUrl, { width: 120 });
  let y = addHeader(doc, { title, logoDataUrl, createdAt });

  y = addSectionTitle(doc, 'Resumo', { startY: y });
  y = addKeyValues(
    doc,
    [
      ['Produtos', stats?.productsCount ?? 0],
      ['Unidades em Stock', stats?.stockUnits ?? 0],
      ['Baixo Stock (≤2)', stats?.lowStock ?? 0],
      ['Total em Compras (€)', moneyPt(stats?.purchasesTotal ?? 0)],
    ],
    { startY: y },
  );

  const topViewed = analytics?.top_viewed_products ?? [];
  y = addSectionTitle(doc, 'Produtos mais vistos (30 dias)', { startY: y });
  y = addTable(doc, {
    headers: ['Produto', 'Views'],
    rows: topViewed.slice(0, 30).map((p) => [p.product_name ?? '', p.views ?? 0]),
    startY: y,
    columnWidths: [360, 120],
    columnAlign: ['left', 'right'],
  });

  const topSearches = analytics?.top_searches ?? [];
  y = addSectionTitle(doc, 'Mais pesquisas (30 dias)', { startY: y });
  y = addTable(doc, {
    headers: ['Pesquisa', 'Count'],
    rows: topSearches.slice(0, 30).map((q) => [q.query ?? '', q.count ?? 0]),
    startY: y,
    columnWidths: [360, 120],
    columnAlign: ['left', 'right'],
  });

  const largestOrders = analytics?.largest_orders ?? [];
  y = addSectionTitle(doc, 'Maiores encomendas (30 dias)', { startY: y });
  y = addTable(doc, {
    headers: ['Email', 'Status', 'Total (€)'],
    rows: largestOrders
      .slice(0, 30)
      .map((o) => [o.customer_email ?? '', orderStatusLabelsPt[String(o.status ?? '')] ?? (o.status ?? ''), moneyPt(o.total ?? 0)]),
    startY: y,
    columnWidths: [260, 110, 110],
    columnAlign: ['left', 'left', 'right'],
  });

  const outName = filename ?? 'relatorios.pdf';
  finalizePdf(doc);
  if (mode === 'blob') return doc.output('blob');
  if (mode === 'open') {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) downloadBlob(outName, blob);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  doc.save(outName);
}

export async function exportFinancePdf({
  filename,
  title = 'Financeiro',
  logoUrl,
  createdAt,
  stats,
  mode = 'download',
} = {}) {
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  const logoDataUrl = await safeSvgUrlToPngDataUrl(logoUrl, { width: 120 });
  let y = addHeader(doc, { title, logoDataUrl, createdAt });

  y = addSectionTitle(doc, 'Resumo', { startY: y });
  y = addKeyValues(
    doc,
    [
      ['Investido em Stock (€)', moneyPt(stats?.invested ?? 0)],
      ['Valor Esperado (PVP) (€)', moneyPt(stats?.expected ?? 0)],
      ['Margem Potencial (€)', moneyPt(stats?.marginPotential ?? 0)],
      ['Receita (Entregue) (€)', moneyPt(stats?.revenueDelivered ?? 0)],
      ['Receita pendente (€)', moneyPt(stats?.revenueOpen ?? 0)],
      ['Canceladas (€)', moneyPt(stats?.revenueCancelled ?? 0)],
      ['Compras (Stock) (€)', moneyPt(stats?.purchasesStockTotal ?? 0)],
      ['Despesas (Logística) (€)', moneyPt(stats?.purchasesLogisticsTotal ?? 0)],
      ['Total em Compras (€)', moneyPt(stats?.purchasesTotal ?? 0)],
    ],
    { startY: y },
  );

  y = addSectionTitle(doc, 'Investimento por categoria', { startY: y });
  y = addTable(doc, {
    headers: ['Categoria', 'Unidades', 'Investido (€)', 'Valor Esperado (€)', 'Margem (€)'],
    rows: (stats?.byCategory ?? []).map((r) => [
      r.category ?? '',
      r.units ?? 0,
      moneyPt(r.invested ?? 0),
      moneyPt(r.expected ?? 0),
      moneyPt((r.expected ?? 0) - (r.invested ?? 0)),
    ]),
    startY: y,
    columnWidths: [150, 70, 110, 110, 110],
    columnAlign: ['left', 'right', 'right', 'right', 'right'],
  });

  const outName = filename ?? 'financeiro.pdf';
  finalizePdf(doc);
  if (mode === 'blob') return doc.output('blob');
  if (mode === 'open') {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) downloadBlob(outName, blob);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  doc.save(outName);
}

export async function exportElementToPdf(element, filename, { title } = {}) {
  if (!element) throw new Error('missing_element');

  const [{ default: html2canvas }, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default ?? jspdfMod;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;

  if (title) {
    pdf.setFontSize(12);
    pdf.text(String(title), margin, margin);
  }

  const contentTop = title ? margin + 18 : margin;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - contentTop - margin;

  const pxPerPt = canvas.width / contentWidth;
  const sliceHeightPx = Math.floor(contentHeight * pxPerPt);

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = canvas.width;
  pageCanvas.height = sliceHeightPx;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) throw new Error('canvas_context_failed');

  let y = 0;
  let pageIndex = 0;
  while (y < canvas.height) {
    ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    const remaining = canvas.height - y;
    const drawHeight = Math.min(sliceHeightPx, remaining);

    ctx.drawImage(canvas, 0, y, canvas.width, drawHeight, 0, 0, canvas.width, drawHeight);

    const imgData = pageCanvas.toDataURL('image/png', 1.0);
    const drawHeightPt = drawHeight / pxPerPt;

    if (pageIndex > 0) pdf.addPage();
    if (title) {
      pdf.setFontSize(12);
      pdf.text(String(title), margin, margin);
    }
    pdf.addImage(imgData, 'PNG', margin, contentTop, contentWidth, drawHeightPt, undefined, 'FAST');

    y += drawHeight;
    pageIndex += 1;
  }

  pdf.save(filename);
}
