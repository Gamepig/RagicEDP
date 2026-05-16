function requestsCancelledView(query: string): boolean {
  return /(取消|停用|作廢|無效|toggle-off|cancel(?:led)?|inactive|void)/i.test(query);
}

function requestsNetRevenue(query: string): boolean {
  return /(訂單實收|net\b|淨營收|未含運)/i.test(query);
}

function looksLikeRevenueQuery(query: string): boolean {
  return /(營收|銷售|業績|gmv|revenue|sales|aov|客單|平均單價|品牌比較|通路|排行|排名|佔比|占比|share|分析|趨勢|筆數|訂單數|order)/i.test(query);
}

function injectLeadingCondition(sql: string, condition: string): string {
  if (new RegExp(condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(sql)) {
    return sql;
  }
  if (/\bWHERE\b/i.test(sql)) {
    return sql.replace(/\bWHERE\b/i, `WHERE ${condition} AND`);
  }
  const insertPoint = sql.search(/\b(GROUP\s+BY|ORDER\s+BY|LIMIT)\b/i);
  if (insertPoint > 0) {
    return `${sql.slice(0, insertPoint)}WHERE ${condition}\n${sql.slice(insertPoint)}`;
  }
  return `${sql}\nWHERE ${condition}`;
}

function hasAliasedSource(sql: string, sourceName: string, alias: string): boolean {
  const escapedSource = sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escapedSource}\`?\\s+(?:AS\\s+)?${escapedAlias}\\b`, "i").test(sql);
}

function injectStatusConditionForSource(
  sql: string,
  sourceName: string,
  aliases: string[],
  conditionTemplate: (alias: string) => string,
): string | null {
  for (const alias of aliases) {
    if (hasAliasedSource(sql, sourceName, alias)) {
      return injectLeadingCondition(sql, conditionTemplate(alias));
    }
  }
  return null;
}

export function applyBusinessSqlRules(sql: string, naturalLanguage: string): string {
  let patched = sql;
  const wantsRevenueRule = looksLikeRevenueQuery(naturalLanguage);
  const wantsCancelled = requestsCancelledView(naturalLanguage);
  const wantsNet = requestsNetRevenue(naturalLanguage);
  const wantsWithShipping = wantsRevenueRule && !wantsNet;
  const wantsActiveOnly = wantsRevenueRule && !wantsCancelled;

  if (wantsWithShipping) {
    if (/view_order_customer/i.test(patched)) {
      patched = patched.replace(/\border_amount\b(?!_with_shipping)/g, "order_amount_with_shipping");
    }
    if (/ls_v_order_lines_ext/i.test(patched) && !/運費|shipping|差額/.test(naturalLanguage)) {
      patched = patched.replace(/\bamount_paid\b/g, "amount_with_shipping");
    }
  }

  if (wantsActiveOnly && !/LOWER\([^)]+status\)\s*=\s*'toggle-(?:on|off)'/i.test(patched)) {
    const patchedWithViewOrderCustomerAlias = injectStatusConditionForSource(
      patched,
      "view_order_customer",
      ["o", "v", "voc"],
      (alias) => `LOWER(${alias}.status) = 'toggle-on'`,
    );
    const patchedWithOrderLinesAlias = injectStatusConditionForSource(
      patched,
      "ls_v_order_lines_ext",
      ["e", "l", "ol"],
      (alias) => `LOWER(${alias}.status) = 'toggle-on'`,
    );
    const patchedWithFactOrdersAlias = injectStatusConditionForSource(
      patched,
      "fact_orders",
      ["o", "fo"],
      (alias) => `LOWER(${alias}.status) = 'toggle-on'`,
    );

    if (patchedWithViewOrderCustomerAlias) {
      patched = patchedWithViewOrderCustomerAlias;
    } else if (patchedWithOrderLinesAlias) {
      patched = patchedWithOrderLinesAlias;
    } else if (/ls_v_order_lines_ext/i.test(patched)) {
      patched = injectLeadingCondition(patched, "LOWER(status) = 'toggle-on'");
    } else if (/view_order_customer/i.test(patched)) {
      patched = injectLeadingCondition(patched, "LOWER(status) = 'toggle-on'");
    } else if (patchedWithFactOrdersAlias) {
      patched = patchedWithFactOrdersAlias;
    }
  }

  return patched;
}

export function applyBusinessSqlRulesForTest(sql: string, naturalLanguage: string): string {
  return applyBusinessSqlRules(sql, naturalLanguage);
}
