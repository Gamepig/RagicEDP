import { getChartStats, getChartSpec, listReadyCharts, listPendingCharts } from './src/lib/analytics/chart_registry.ts';

console.log('=== Chart Registry Verification ===\n');

const stats = getChartStats();
console.log('Chart Statistics:');
console.log(`  Total: ${stats.total}`);
console.log(`  Ready: ${stats.ready}`);
console.log(`  Needs New View: ${stats.needsNewView}\n`);

const chart01 = getChartSpec('01');
console.log('Chart 01 (本月每日銷售趨勢):');
console.log(`  Status: ${chart01?.status}`);
console.log(`  Source: ${chart01?.source.type} - ${chart01?.source.name}`);
console.log(`  Required Fields: ${chart01?.required_fields.join(', ')}\n`);

const chart05 = getChartSpec('05');
console.log('Chart 05 (通路貢獻度趨勢):');
console.log(`  Status: ${chart05?.status}`);
console.log(`  Depends On: ${chart05?.depends_on?.join(', ')}\n`);

console.log(`Ready Charts: ${listReadyCharts().length}`);
console.log(`Pending Charts: ${listPendingCharts().length}`);

console.log('\n✅ Chart Registry verification complete!');
