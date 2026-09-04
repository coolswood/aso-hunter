import { getGoogleAccessToken } from "./auth";
import { decodePlayCsv, parseCsv } from "./csv";

const GCS_BASE_URL = "https://storage.googleapis.com/storage/v1";
export const DEFAULT_BUCKET = process.env.PLAY_REPORTS_BUCKET ?? "pubsite_prod_7683044258068437569";

interface GcsListResponse {
  items?: Array<{ name: string; size: string; updated: string }>;
  nextPageToken?: string;
}

/**
 * List files in the GCS bucket matching a prefix.
 */
export async function listGcsFiles(prefix: string, bucket = DEFAULT_BUCKET): Promise<string[]> {
  const token = await getGoogleAccessToken();
  const url = `${GCS_BASE_URL}/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}&maxResults=1000`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GCS list failed [HTTP ${res.status}]: ${errorText.slice(0, 250)}`);
  }

  const data = (await res.json()) as GcsListResponse;
  return (data.items ?? []).map((item) => item.name);
}

/**
 * Downloads and parses a CSV report from GCS.
 */
export async function fetchReportCsv(
  filePath: string,
  bucket = DEFAULT_BUCKET,
): Promise<Record<string, string>[]> {
  const token = await getGoogleAccessToken();
  const url = `${GCS_BASE_URL}/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `GCS download failed for ${filePath} [HTTP ${res.status}]: ${errorText.slice(0, 250)}`,
    );
  }

  const buf = await res.arrayBuffer();
  const text = decodePlayCsv(buf);
  return parseCsv(text);
}
