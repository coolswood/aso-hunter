/**
 * Декодирование и парсинг CSV-отчетов из Google Play Console.
 * Play Console отдает CSV в кодировке UTF-16LE с BOM (0xFF, 0xFE)
 * или UTF-8 с BOM (0xEF, 0xBB, 0xBF).
 */

export function decodePlayCsv(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // BOM UTF-16LE = FF FE
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buf.slice(2));
  }
  // BOM UTF-8 = EF BB BF
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buf.slice(3));
  }
  return new TextDecoder("utf-8").decode(buf);
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const rows = lines.map(parseLine);
  const headers = rows[0];
  if (!headers || headers.length === 0) return [];

  return rows.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}
