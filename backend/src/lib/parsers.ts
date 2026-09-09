export async function parseCsvPreview(buffer: Buffer): Promise<Record<string, unknown>> {
  const { parse } = await import("csv-parse/sync");
  const content = buffer.toString("utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = records.slice(0, 50);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    columns,
    rows: rows.length > 0 ? rows.slice(0, 10) : [],
    totalRows: records.length,
  };
}

export async function parseJsonPreview(buffer: Buffer): Promise<Record<string, unknown>> {
  const content = buffer.toString("utf-8");
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    // If invalid JSON, return empty preview
    return { columns: [], rows: [], totalRows: 0 };
  }

  if (Array.isArray(data)) {
    const items = data as Record<string, unknown>[];
    const columns = items.length > 0 ? Object.keys(items[0]) : [];
    return {
      columns,
      rows: items.slice(0, 10),
      totalRows: items.length,
    };
  }

  if (data !== null && typeof data === "object") {
    // Single object
    return {
      columns: Object.keys(data),
      rows: [data as Record<string, unknown>],
      totalRows: 1,
    };
  }

  return { columns: [], rows: [], totalRows: 0 };
}
