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

/** Max rows for chart-oriented queries */
const MAX_LIMIT_CHART = 200;

export type SqlSafetyResult =
  | { safe: true; sql: string }
  | { safe: false; reason: string };

/**
 * Detect whether the outermost SELECT has a LIMIT clause.
 * Strategy: find the last SELECT at depth-0 (outside CTEs), then check for LIMIT after it.
 */
function hasOuterLimit(sql: string): boolean {
  const upper = sql.toUpperCase();

  // For CTE queries: find the position of the final SELECT (after last closing paren of CTE)
  // For simple queries: the whole thing is the outer SELECT
  let outerSelectPos = 0;
  if (upper.trimStart().startsWith("WITH")) {
    // Walk through to find the last top-level SELECT
    let depth = 0;
    let lastTopSelectPos = -1;
    for (let i = 0; i < upper.length; i++) {
      if (upper[i] === "(") depth++;
      else if (upper[i] === ")") depth--;
      // Look for SELECT at depth 0 (not inside parentheses)
      if (depth === 0 && upper.slice(i).match(/^SELECT\b/)) {
        lastTopSelectPos = i;
      }
    }
    if (lastTopSelectPos >= 0) {
      outerSelectPos = lastTopSelectPos;
    }
  }

  // Check if there's a LIMIT clause after the outer SELECT position
  const outerPart = upper.slice(outerSelectPos);
  return /\bLIMIT\s+\d+/i.test(outerPart);
}

export function validateSql(sql: string): SqlSafetyResult {
  const upper = sql.toUpperCase().trim();

  // Must start with SELECT or WITH (CTE)
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { safe: false, reason: "AI 無法生成有效的查詢語句，可能是此類資料目前不可用" };
  }

  // WITH must be a real CTE: "WITH <name> AS (" pattern, not prose
  if (upper.startsWith("WITH") && !upper.startsWith("WITH ")) {
    return { safe: false, reason: "AI 回傳了非 SQL 內容" };
  }
  if (upper.startsWith("WITH ") && !/^WITH\s+\S+\s+AS\s*\(/i.test(upper)) {
    return { safe: false, reason: "AI 回傳了文字說明而非 SQL 查詢語句" };
  }

  // Must contain FROM (every valid SELECT needs a data source)
  if (!/\bFROM\b/.test(upper)) {
    return { safe: false, reason: "AI 回傳的內容缺少 FROM 子句，不是有效的 SQL" };
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

  // Append LIMIT if the OUTER SELECT doesn't have one (CTE inner LIMIT doesn't count)
  if (!hasOuterLimit(safeSql)) {
    safeSql += ` LIMIT ${MAX_LIMIT_CHART}`;
  }

  return { safe: true, sql: safeSql };
}
