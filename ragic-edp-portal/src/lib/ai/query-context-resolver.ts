import "server-only";

/**
 * Query Context Resolver — 對話上下文實體解析器
 *
 * 從對話歷史中提取「活躍實體」（品牌、時間範圍、通路、客戶、訂單狀態等），
 * 當用戶的當前提問缺少這些實體時，自動補上，實現「隱式延續」。
 *
 * 設計原則：
 * 1. 規則式提取 — 快速、零延遲、確定性
 * 2. 只在當前查詢缺少實體時才補上（不覆蓋用戶明確指定的）
 * 3. 支援「重置」— 用戶明確切換話題時不繼承
 */

// ===== 已知實體映射 =====

const BRAND_NAMES = ["菜市仔嬤", "HOYA", "有樹食", "四季晴", "寶島鮮", "HH-Life", "茶納雅言"];
const BRAND_ALIASES: Record<string, string> = {
  hoya: "HOYA",
  "hh-life": "HH-Life",
  "hhlife": "HH-Life",
  gmk: "菜市仔嬤",
  "菜市仔嬷": "菜市仔嬤",
  "菜市仔": "菜市仔嬤",
  hya: "HOYA",
  bdf: "寶島鮮",
  yas: "有樹食",
  sun: "四季晴",
  hhh: "HH-Life",
};

const CHANNEL_KEYWORDS = [
  "蝦皮", "shopee", "momo", "pchome", "官網", "KOL", "社團",
  "FB", "facebook", "LINE", "line@", "電話", "電商",
];

const STATUS_MAP: Record<string, string> = {
  // Active
  有效: "toggle-on", 正常: "toggle-on", "toggle-on": "toggle-on", on: "toggle-on",
  // Inactive
  取消: "toggle-off", 停用: "toggle-off", 作廢: "toggle-off", 無效: "toggle-off",
  "toggle-off": "toggle-off", off: "toggle-off",
};

// ===== Types =====

export type ResolvedQueryContext = {
  /** Detected brand(s) from conversation that current query should inherit */
  brand?: string;
  /** Detected time range description (e.g., "2026年1月", "1月1日到1月20日") */
  timeRange?: string;
  /** Detected channel keyword */
  channel?: string;
  /** Detected customer name/code */
  customer?: string;
  /** Detected order status filter */
  status?: string;
  /** Entities being compared (for A vs B continuation) */
  comparisonEntities?: string[];
  /** Whether this is a follow-up question (not a new topic) */
  isFollowUp: boolean;
  /** Human-readable summary of carried-forward context */
  summary: string;
};

// ===== Core Logic =====

/** Extract brand names from text */
function extractBrands(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();

  for (const brand of BRAND_NAMES) {
    if (text.includes(brand)) {
      found.push(brand);
    }
  }
  for (const [alias, brand] of Object.entries(BRAND_ALIASES)) {
    if (lower.includes(alias) && !found.includes(brand)) {
      found.push(brand);
    }
  }
  return found;
}

/** Extract channel keywords from text */
function extractChannels(text: string): string[] {
  const lower = text.toLowerCase();
  return CHANNEL_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
}

/** Extract order status from text */
function extractStatus(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [keyword, status] of Object.entries(STATUS_MAP)) {
    if (lower.includes(keyword)) return status;
  }
  return undefined;
}

/** Extract time range expressions from text */
function extractTimeRange(text: string): string | undefined {
  // Match common date patterns in Chinese
  const patterns = [
    // "2026年1月" or "2026年1月1日到2026年1月20日"
    /\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?(?:\s*[到至~-]\s*\d{4}?\s*年?\s*\d{1,2}\s*月?\s*\d{1,2}\s*日?)?/,
    // "1月1日到1月20日" (without year)
    /\d{1,2}\s*月\s*\d{1,2}\s*日\s*[到至~-]\s*\d{1,2}\s*月?\s*\d{1,2}\s*日/,
    // "1月" alone
    /\d{1,2}\s*月(?!\s*\d)/,
    // "上個月" "這個月" "本月"
    /(?:上個?月|這個?月|本月|去年|今年|上一?季|本季)/,
    // "最近30天" "最近三個月"
    /最近\s*(?:\d+|[一二三四五六七八九十]+)\s*(?:天|個?月|週|年)/,
    // ISO dates "2026-01-01 to 2026-01-20"
    /\d{4}-\d{2}-\d{2}\s*(?:to|[到至~-])\s*\d{4}-\d{2}-\d{2}/,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return undefined;
}

/** Extract customer names from text (look for patterns like "客戶XXX" or known name patterns) */
function extractCustomer(text: string): string | undefined {
  // Match "客戶「XX」" or "客戶XX" patterns
  const m = text.match(/客戶[「「]?([^」」\s,，。]{2,20})[」」]?/);
  if (m) return m[1];
  return undefined;
}

/**
 * Detect if the current query is a topic reset (user starts a new, unrelated question).
 * If so, we should NOT carry forward previous context.
 */
function isTopicReset(currentQuery: string, _conversationContext: string): boolean {
  // Explicit new topic indicators
  const resetPatterns = [
    /^(?:換個?話題|新問題|另外|別的|不同的|改問|換問)/,
    /^(?:那|接下來).*(?:另一個|其他|別的)/,
  ];
  for (const p of resetPatterns) {
    if (p.test(currentQuery.trim())) return true;
  }
  return false;
}

/**
 * Parse conversation context string into individual messages.
 * The format from buildConversationContext is:
 *   ## 對話摘要（早期對話重點）\n{summary}
 *   ## 最近對話紀錄\n[使用者] msg\n\n[助理] msg\n\n...
 */
function parseConversationMessages(context: string): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  // Match [使用者] or [助理] sections
  const re = /\[(使用者|助理)\]\s*([\s\S]*?)(?=\n\n\[(?:使用者|助理)\]|$)/g;
  let m;
  while ((m = re.exec(context)) !== null) {
    messages.push({
      role: m[1] === "使用者" ? "user" : "assistant",
      content: m[2].trim(),
    });
  }
  return messages;
}

/**
 * Main resolver: analyze conversation context + current query to determine
 * which entities should be carried forward.
 */
export function resolveQueryContext(
  currentQuery: string,
  conversationContext: string,
): ResolvedQueryContext {
  const empty: ResolvedQueryContext = { isFollowUp: false, summary: "" };

  if (!conversationContext || conversationContext.length < 10) {
    return empty;
  }

  // Check for topic reset
  if (isTopicReset(currentQuery, conversationContext)) {
    return empty;
  }

  // Extract entities from CURRENT query
  const currentBrands = extractBrands(currentQuery);
  const currentChannels = extractChannels(currentQuery);
  const currentStatus = extractStatus(currentQuery);
  const currentTimeRange = extractTimeRange(currentQuery);
  const currentCustomer = extractCustomer(currentQuery);

  // Parse conversation messages (most recent first for priority)
  const messages = parseConversationMessages(conversationContext);
  const recentUserMessages = messages.filter((m) => m.role === "user").reverse();

  // Also consider the rolling summary section
  const summaryMatch = conversationContext.match(/## 對話摘要[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  const summaryText = summaryMatch?.[1] ?? "";

  // Combine all conversation text for entity extraction
  // Priority: recent user messages > older messages > summary
  const allConversationText = [...recentUserMessages.map((m) => m.content), summaryText].join("\n");

  // Extract entities from conversation history
  const histBrands = extractBrands(allConversationText);
  const histChannels = extractChannels(allConversationText);
  const histStatus = extractStatus(allConversationText);
  const histTimeRange = extractTimeRange(allConversationText);
  const histCustomer = extractCustomer(allConversationText);

  // Determine most recent brand from user messages (priority order)
  let mostRecentBrand: string | undefined;
  for (const msg of recentUserMessages) {
    const brands = extractBrands(msg.content);
    if (brands.length > 0) {
      mostRecentBrand = brands[brands.length - 1]; // last mentioned in most recent message
      break;
    }
  }

  // Determine most recent time range from user messages
  let mostRecentTimeRange: string | undefined;
  for (const msg of recentUserMessages) {
    const tr = extractTimeRange(msg.content);
    if (tr) {
      mostRecentTimeRange = tr;
      break;
    }
  }

  // Build resolved context — only carry forward what's MISSING from current query
  const resolved: ResolvedQueryContext = { isFollowUp: true, summary: "" };
  const carriedParts: string[] = [];

  // Brand: carry forward if current query has no brand
  if (currentBrands.length === 0 && (mostRecentBrand || histBrands.length > 0)) {
    resolved.brand = mostRecentBrand || histBrands[0];
    carriedParts.push(`品牌=${resolved.brand}`);
  }

  // Time range: carry forward if current query has no time range
  // BUT only if the current query seems like it needs one (data query, not a general "what is X" question)
  const isDataQuery = /營收|訂單|通路|客戶|品牌|銷售|客單|商品|產品|排名|比較|佔比|趨勢|成長|下降|分析|筆數|金額|數量/.test(currentQuery);
  if (!currentTimeRange && (mostRecentTimeRange || histTimeRange) && isDataQuery) {
    resolved.timeRange = mostRecentTimeRange || histTimeRange;
    carriedParts.push(`時間=${resolved.timeRange}`);
  }

  // Channel: carry forward if current query has no channel
  if (currentChannels.length === 0 && histChannels.length > 0) {
    // Only carry channel if the query context suggests it (e.g., asking about "訂單" within a channel discussion)
    // Don't carry channel for brand-level or general queries
    const channelRelevant = /通路|channel|平台|蝦皮|momo|pchome|官網/.test(currentQuery);
    if (channelRelevant) {
      resolved.channel = histChannels[0];
      carriedParts.push(`通路=${resolved.channel}`);
    }
  }

  // Status: carry forward if discussing orders without specifying status
  if (!currentStatus && histStatus) {
    const statusRelevant = /訂單|order|筆數|金額/.test(currentQuery);
    if (statusRelevant) {
      resolved.status = histStatus;
      carriedParts.push(`訂單狀態=${histStatus === "toggle-on" ? "有效" : "取消/停用"}`);
    }
  }

  // Customer: carry forward
  if (!currentCustomer && histCustomer) {
    const customerRelevant = /客戶|他|她|購買|訂購|消費/.test(currentQuery);
    if (customerRelevant) {
      resolved.customer = histCustomer;
      carriedParts.push(`客戶=${resolved.customer}`);
    }
  }

  // Comparison entities: detect A vs B patterns in history
  if (histBrands.length >= 2 && /比較|vs|對比|差異/.test(allConversationText)) {
    const comparisonRelevant = /比較|對比|差異|哪個|vs|呢/.test(currentQuery);
    if (comparisonRelevant && currentBrands.length === 0) {
      resolved.comparisonEntities = histBrands.slice(0, 3);
      carriedParts.push(`比較=${resolved.comparisonEntities.join(" vs ")}`);
    }
  }

  // If nothing was carried forward, it's not really a follow-up needing context
  if (carriedParts.length === 0) {
    return { isFollowUp: false, summary: "" };
  }

  resolved.summary = `延續上文：${carriedParts.join("、")}`;

  return resolved;
}

/**
 * Build an explicit query enrichment string to prepend to the SQL generator prompt.
 * This turns implicit context into explicit SQL hints.
 */
export function buildQueryEnrichment(resolved: ResolvedQueryContext): string {
  if (!resolved.isFollowUp) return "";

  const hints: string[] = [];

  if (resolved.brand) {
    hints.push(`[CONTEXT ENTITY: brand_name = '${resolved.brand}' — 延續上文討論的品牌，SQL 必須加 WHERE brand_name = '${resolved.brand}']`);
  }

  if (resolved.timeRange) {
    hints.push(`[CONTEXT ENTITY: 時間範圍 = ${resolved.timeRange} — 延續上文的時間條件]`);
  }

  if (resolved.channel) {
    hints.push(`[CONTEXT ENTITY: 通路 = ${resolved.channel} — 延續上文的通路篩選]`);
  }

  if (resolved.status) {
    const statusLabel = resolved.status === "toggle-on" ? "有效訂單" : "取消/停用訂單";
    hints.push(`[CONTEXT ENTITY: 訂單狀態 = ${resolved.status} (${statusLabel}) — 延續上文的狀態篩選]`);
  }

  if (resolved.customer) {
    hints.push(`[CONTEXT ENTITY: 客戶 = ${resolved.customer} — 延續上文的客戶]`);
  }

  if (resolved.comparisonEntities && resolved.comparisonEntities.length >= 2) {
    hints.push(`[CONTEXT ENTITY: 比較對象 = ${resolved.comparisonEntities.join(", ")} — 延續上文的比較分析]`);
  }

  return hints.join("\n");
}
