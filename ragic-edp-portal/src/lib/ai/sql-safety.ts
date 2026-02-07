const DDL_DML_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "REPLACE",
  "MERGE",
  "GRANT",
  "REVOKE",
];

const MAX_LIMIT = 10000;

export type SqlSafetyResult =
  | { safe: true; sql: string }
  | { safe: false; reason: string };

export function validateSql(sql: string): SqlSafetyResult {
  const upper = sql.toUpperCase().trim();

  // Reject DDL/DML
  for (const kw of DDL_DML_KEYWORDS) {
    // Match keyword at word boundary
    const regex = new RegExp(`\\b${kw}\\b`);
    if (regex.test(upper)) {
      return { safe: false, reason: `禁止使用 ${kw} 語句` };
    }
  }

  // Reject multiple statements (semicolon followed by non-whitespace)
  if (/;\s*\S/.test(sql)) {
    return { safe: false, reason: "不允許多重查詢語句" };
  }

  // Ensure LIMIT exists — append if missing
  let safeSql = sql.replace(/;\s*$/, "").trim();
  if (!upper.includes("LIMIT")) {
    safeSql += ` LIMIT ${MAX_LIMIT}`;
  }

  return { safe: true, sql: safeSql };
}
