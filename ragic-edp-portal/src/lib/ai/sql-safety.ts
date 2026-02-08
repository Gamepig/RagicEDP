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

  // Must start with SELECT or WITH (CTE)
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { safe: false, reason: "AI 無法生成有效的查詢語句，可能是此類資料目前不可用" };
  }

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

  // Remove trailing semicolon
  let safeSql = sql.replace(/;\s*$/, "").trim();

  // Check if SQL looks complete (ends with a valid SQL token, not mid-clause)
  const trimmedUpper = safeSql.toUpperCase().trimEnd();
  const incompleteEndings = ["WHERE", "AND", "OR", "ON", "JOIN", "FROM", "BY", "ORDER", "GROUP", "HAVING", "SET", "INTO", "VALUES", "SELECT", "PARTITION"];
  const lastWord = trimmedUpper.split(/\s+/).pop() || "";
  if (incompleteEndings.includes(lastWord)) {
    return { safe: false, reason: `SQL 語句不完整（結尾於 ${lastWord}），AI 模型未能生成完整查詢` };
  }

  // Append LIMIT if missing (only at the outermost level, after a complete statement)
  if (!upper.includes("LIMIT")) {
    safeSql += ` LIMIT ${MAX_LIMIT}`;
  }

  return { safe: true, sql: safeSql };
}
