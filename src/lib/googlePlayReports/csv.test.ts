import { describe, expect, it } from "bun:test";
import { decodePlayCsv, parseCsv } from "./csv";

describe("googlePlayReports/csv", () => {
  it("decodes plain utf-8 text", () => {
    const raw = "Date,Package name,Search term\n2026-08-01,com.app,mental health\n";
    const buf = new TextEncoder().encode(raw).buffer;
    const decoded = decodePlayCsv(buf);
    expect(decoded).toBe(raw);
  });

  it("decodes UTF-16LE with BOM", () => {
    const raw = "Date,Search term\n2026-08-01,тест кпт\n";
    const chars = Array.from(raw).map((c) => c.charCodeAt(0));
    const bytes = new Uint8Array(2 + chars.length * 2);
    // BOM FF FE
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    chars.forEach((code, i) => {
      bytes[2 + i * 2] = code & 0xff;
      bytes[2 + i * 2 + 1] = (code >> 8) & 0xff;
    });
    const decoded = decodePlayCsv(bytes.buffer);
    expect(decoded).toBe(raw);
  });

  it("parses CSV lines including quoted fields with commas and double quotes", () => {
    const csv = [
      'Date,Package name,Search term,"Store listing acquisitions"',
      '2026-08-01,com.app,"mind health, cbt",15',
      '2026-08-02,com.app,"app ""best"" quote",30',
    ].join("\n");

    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      Date: "2026-08-01",
      "Package name": "com.app",
      "Search term": "mind health, cbt",
      "Store listing acquisitions": "15",
    });
    expect(rows[1]).toEqual({
      Date: "2026-08-02",
      "Package name": "com.app",
      "Search term": 'app "best" quote',
      "Store listing acquisitions": "30",
    });
  });

  it("handles empty or single header csv gracefully", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("Date,Term")).toEqual([]);
  });
});
