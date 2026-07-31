// ---------------------------------------------------------------------------
// csvExport.ts
// Utilities for generating and sharing CSV files.
// ---------------------------------------------------------------------------

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Convert an array of objects to a CSV string.
 * - Header row derived from first object's keys.
 * - Values containing commas, quotes, or newlines are double-quoted and
 *   any embedded double-quotes are escaped as "".
 * - Null / undefined values render as empty string.
 */
export function objectsToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]!);

  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Wrap in quotes if contains comma, double-quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const dataRows = data.map((row) =>
    headers.map((key) => escapeCell(row[key])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Write a CSV string to the device's cache directory and open the system
 * share sheet so the user can save / send it.
 */
export async function downloadCsv(csvString: string, filename: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  const safeName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${safeName}`;

  await FileSystem.writeAsStringAsync(fileUri, csvString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export CSV',
    UTI: 'public.comma-separated-values-text',
  });
}
