export type ExportCell = string | number | null | undefined;
export type ColFormat = "text" | "int" | "decimal" | "money" | "percent" | "date";

export type Col = { header: string; format?: ColFormat; width?: number };
export type ExportTable = {
  name: string;          // sheet name (Excel) / section heading (PDF)
  columns: Col[];
  rows: ExportCell[][];
  totals?: ExportCell[]; // optional bold total row
  filter?: boolean;      // Excel filter arrows on the header (default true)
};
export type Report = { title: string; subtitle?: string; tables: ExportTable[] };

const ORG_NAME = "Mercedes Municipal FishPort Management Office";
// Files in the public/ folder. The first one that exists is used.
const LOGO_CANDIDATES = [
  "/logo.png",
];

const NUM_FMT: Record<ColFormat, string | undefined> = {
  text: undefined,
  int: "#,##0",
  decimal: "#,##0.00",
  money: '"₱"#,##0.00',
  percent: '0.0"%"',
  date: "dd mmm yyyy",
};

const isNumeric = (f?: ColFormat) => f === "int" || f === "decimal" || f === "money" || f === "percent";

/** Local date as YYYY-MM-DD, for file names. */
export function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoParts(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Text as it is shown (PDF cells and Excel column widths). */
function fmtText(v: ExportCell, f: ColFormat = "text"): string {
  if (v === null || v === undefined || v === "") return "";
  if (f === "text") return String(v);
  if (f === "date") {
    const p = isoParts(String(v));
    return p
      ? new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : String(v);
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (f === "int") return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (f === "percent") return `${n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Real numbers and dates for Excel, so totals, filters and pivots work. */
function toExcelValue(v: ExportCell, f: ColFormat = "text"): string | number | Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (f === "date") {
    const p = isoParts(String(v));
    return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])) : String(v);
  }
  if (f === "text") return String(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : String(v);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Sheet";
  let n = base;
  let i = 2;
  while (used.has(n.toLowerCase())) n = `${base} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

/* ------------------------------- Logo -------------------------------- */

type Logo = { dataUrl: string; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/**
 * Loads the logo from /public, whatever its format, and returns it as a PNG data URL.
 * Returns null if none can be loaded, so exports still work without it.
 */
async function loadLogo(): Promise<Logo | null> {
  for (const src of LOGO_CANDIDATES) {
    try {
      const img = await loadImage(src);
      const w = img.naturalWidth || 256; // some SVGs report 0
      const h = img.naturalHeight || 256;
      const scale = Math.min(1, 400 / Math.max(w, h)); // keep the file small
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0, cw, ch);

      return { dataUrl: canvas.toDataURL("image/png"), width: cw, height: ch };
    } catch {
      /* try the next candidate */
    }
  }
  console.warn("Export logo not found. Put logo.png in the public/ folder.");
  return null;
}

/* ------------------------------- Excel ------------------------------- */

export async function exportXlsx(filename: string, report: Report) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = ORG_NAME;
  wb.created = new Date();

  const logo = await loadLogo();
  const LOGO_H = 56; // px
  const logoW = logo ? Math.round((LOGO_H * logo.width) / logo.height) : 0;
  const logoId = logo ? wb.addImage({ base64: logo.dataUrl, extension: "png" }) : null;
  // Text next to the logo is pushed right with a cell indent (roughly 9 px per level)
  const textIndent = logo ? Math.ceil((logoW + 12) / 9) : 0;

  const used = new Set<string>();
  // row 1 organisation, row 2 report title, row 3 subtitle, row 4 spacer, row 5 column headers
  const HEAD_ROW = 5;

  for (const t of report.tables) {
    const n = t.columns.length;
    const ws = wb.addWorksheet(sheetName(t.name, used), {
      views: [{ state: "frozen", ySplit: HEAD_ROW, showGridLines: false }],
    });

    // Header block
    const org = ws.getCell(1, 1);
    org.value = ORG_NAME;
    org.font = { bold: true, size: 15, color: { argb: "FF0F2A3D" } };
    org.alignment = { vertical: "middle", horizontal: "left", indent: textIndent };
    ws.getRow(1).height = 26;

    const title = ws.getCell(2, 1);
    title.value = report.title;
    title.font = { bold: true, size: 12, color: { argb: "FF12405C" } };
    title.alignment = { vertical: "middle", horizontal: "left", indent: textIndent };
    ws.getRow(2).height = 20;

    const sub = ws.getCell(3, 1);
    sub.value = report.subtitle ?? "";
    sub.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    sub.alignment = { vertical: "middle", horizontal: "left", indent: textIndent };
    ws.getRow(3).height = 18;

    ws.getRow(4).height = 8;

    if (logo && logoId !== null) {
      ws.addImage(logoId, {
        tl: { col: 0.08, row: 0.12 },
        ext: { width: logoW, height: LOGO_H },
        editAs: "oneCell",
      });
    }

    // Column headers
    const head = ws.getRow(HEAD_ROW);
    head.height = 22;
    t.columns.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12405C" } };
      cell.alignment = { vertical: "middle", horizontal: isNumeric(c.format) ? "right" : "left" };
    });

    // Data rows
    t.rows.forEach((r, ri) => {
      const row = ws.getRow(HEAD_ROW + 1 + ri);
      t.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = toExcelValue(r[i], c.format);
        const fmt = NUM_FMT[c.format ?? "text"];
        if (fmt) cell.numFmt = fmt;
        cell.alignment = { vertical: "middle", horizontal: isNumeric(c.format) ? "right" : "left" };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
        if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    });

    // Total row
    if (t.totals) {
      const row = ws.getRow(HEAD_ROW + 1 + t.rows.length);
      t.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = toExcelValue(t.totals![i], c.format);
        const fmt = NUM_FMT[c.format ?? "text"];
        if (fmt) cell.numFmt = fmt;
        cell.font = { bold: true, color: { argb: "FF0F2A3D" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF4" } };
        cell.alignment = { vertical: "middle", horizontal: isNumeric(c.format) ? "right" : "left" };
        cell.border = { top: { style: "medium", color: { argb: "FF12405C" } } };
      });
    }

    // Column widths from the content
    t.columns.forEach((c, i) => {
      const longest = Math.max(
        c.header.length + 3,
        ...t.rows.map((r) => fmtText(r[i], c.format).length),
        t.totals ? fmtText(t.totals[i], c.format).length : 0,
      );
      ws.getColumn(i + 1).width = c.width ?? Math.min(42, Math.max(10, longest + 3));
    });

    if (t.filter !== false && t.rows.length > 0) {
      ws.autoFilter = { from: { row: HEAD_ROW, column: 1 }, to: { row: HEAD_ROW + t.rows.length, column: n } };
    }

    // Prints on one page wide
    ws.pageSetup = {
      paperSize: 9,
      orientation: n > 7 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}

/* -------------------------------- PDF -------------------------------- */

export async function exportPdf(filename: string, report: Report, opts: { landscape?: boolean } = {}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: opts.landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 36;

  // Header: logo, organisation name, report title, divider line
  const logo = await loadLogo();
  const LOGO_H = 46;
  let textX = M;
  if (logo) {
    const w = (LOGO_H * logo.width) / logo.height;
    doc.addImage(logo.dataUrl, "PNG", M, 28, w, LOGO_H);
    textX = M + w + 12;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 42, 61);
  doc.text(ORG_NAME, textX, 50);

  doc.setFontSize(11);
  doc.setTextColor(18, 64, 92);
  const titleLines = doc.splitTextToSize(report.title, pageW - textX - M) as string[];
  doc.text(titleLines, textX, 68);

  const lineY = Math.max(84, 68 + (titleLines.length - 1) * 13 + 16);
  doc.setDrawColor(18, 64, 92);
  doc.setLineWidth(1);
  doc.line(M, lineY, pageW - M, lineY);

  let y = lineY + 18;
  if (report.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const lines = doc.splitTextToSize(report.subtitle, pageW - M * 2) as string[];
    doc.text(lines, M, y);
    y += lines.length * 11 + 12;
  }

  for (const t of report.tables) {
    if (y > pageH - 120) {
      doc.addPage();
      y = 48;
    }
    if (report.tables.length > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 42, 61);
      doc.text(t.name, M, y);
      y += 8;
    }

    // The PDF font has no peso sign, so money columns say (PHP) in the header instead.
    const columnStyles: Record<number, { halign: "left" | "right" }> = {};
    t.columns.forEach((c, i) => {
      columnStyles[i] = { halign: isNumeric(c.format) ? "right" : "left" };
    });

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 40 },
      head: [t.columns.map((c) => (c.format === "money" && !/php/i.test(c.header) ? `${c.header} (PHP)` : c.header))],
      body: t.rows.map((r) => t.columns.map((c, i) => fmtText(r[i], c.format))),
      foot: t.totals ? [t.columns.map((c, i) => fmtText(t.totals![i], c.format))] : undefined,
      showFoot: "lastPage",
      theme: "striped",
      styles: { fontSize: t.columns.length > 9 ? 7 : 9, cellPadding: 4, textColor: [0, 0, 0] },
      bodyStyles: { valign: "middle" },
      headStyles: { fillColor: [18, 64, 92], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      footStyles: { fillColor: [232, 238, 244], textColor: [15, 42, 61], fontStyle: "bold" },
      columnStyles,
      didParseCell: (hook) => {
        const column = t.columns[hook.column.index];
        if (column && (hook.section === "body" || hook.section === "foot" || hook.section === "head")) {
          hook.cell.styles.halign = isNumeric(column.format) ? "right" : "left";
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${ORG_NAME} | Exported ${stamp()}`, M, pageH - 20);
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 20, { align: "right" });
  }

  doc.save(`${filename}.pdf`);
}
