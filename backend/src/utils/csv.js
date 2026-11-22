/**
 * B5: CSV for the ML export, per RFC 4180. A field is quoted when it holds a comma, a quote, a
 * carriage return or a line feed, with quotes doubled; everything else is written as it is.
 * Values are never altered (no spreadsheet formula escaping), so the ML team gets exact data.
 * The file starts with a UTF-8 BOM so Excel reads Urdu titles correctly.
 */
export const CSV_BOM = '﻿'

export function csvField(value) {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const csvRow = (values) => `${values.map(csvField).join(',')}\r\n`
