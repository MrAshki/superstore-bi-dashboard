import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlySeries, monthlyExtremes, resolveMonthlyObservations } from "../src/lib/monthly.ts";

// دادهٔ کوچک آزمون فقط برای بررسی فرمول‌ها و حالت‌های مرزی است؛ در برنامه استفاده نمی‌شود.
const row = (year_month, sales, profit, observed = true) => ({ year_month, sales, profit, observed });
const filters = () => ({ date_from: null, date_to: null, years: [], regions: [], segments: [], categories: [], subcategories: [], states: [] });
const response = (rows, extra = {}) => ({
  applied_filters: filters(), filtered_rows: 10,
  monthly_trends: rows, categories: [], subcategories: [], regions: [], states: [],
  kpis: { total_sales: 0, total_profit: 0, profit_margin: null, unique_orders: 0, line_items: 10, negative_profit_line_items: 0 },
  ...extra,
});

test("baseline calendar has 48 ordered months", () => {
  const rows = Array.from({ length: 48 }, (_, i) => row(`${2014 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`, 100, 10));
  const series = buildMonthlySeries(rows.reverse());
  assert.equal(series.length, 48);
  assert.equal(series[0].year_month, "2014-01");
  assert.equal(series.at(-1).year_month, "2017-12");
  assert.ok(series.every((point, index) => !index || point.position === series[index - 1].position + 1));
});

test("monthly margin uses totals and preserves loss", () => {
  const series = buildMonthlySeries([row("2014-01", 300, -60)]);
  assert.equal(series[0].profit_margin, -20);
  assert.equal(series[0].profit, -60);
});

test("measured zero is different from missing observations", () => {
  const series = buildMonthlySeries([row("2014-01", 0, 0), row("2014-02", 0, 0, false)]);
  assert.equal(series[0].sales, 0);
  assert.equal(series[0].observed, true);
  assert.equal(series[0].profit_margin, null);
  assert.equal(series[1].sales, null);
  assert.equal(series[1].observed, false);
});

test("three-month average is trailing and starts at the third month", () => {
  const series = buildMonthlySeries([row("2014-01", 300, 20), row("2014-02", 600, 10), row("2014-03", 900, -90), row("2014-04", 1200, 30)]);
  assert.deepEqual(series.map(point => point.moving_average), [null, null, 600, 900]);
});

test("average includes observed zero and stops at missing months", () => {
  const series = buildMonthlySeries([row("2014-01", 0, 0), row("2014-02", 30, 3), row("2014-03", 60, 6), row("2014-04", 0, 0, false), row("2014-05", 90, 9)]);
  assert.equal(series[2].moving_average, 30);
  assert.equal(series[3].moving_average, null);
  assert.equal(series[4].moving_average, null);
});

test("unselected years create calendar gaps without an average bridge", () => {
  const series = buildMonthlySeries([row("2014-12", 10, 1), row("2016-01", 20, 2)]);
  assert.equal(series.length, 14);
  assert.equal(series[1].observed, false);
  assert.equal(series.at(-1).moving_average, null);
});

test("extreme labels follow the selected population", () => {
  const series = buildMonthlySeries([row("2014-01", 100, 5), row("2014-02", 300, -50), row("2014-03", 200, -80)]);
  assert.equal(monthlyExtremes(series).peak.year_month, "2014-02");
  assert.equal(monthlyExtremes(series).loss.year_month, "2014-03");
  assert.equal(monthlyExtremes(buildMonthlySeries([row("2014-01", 1, 1)])).loss, null);
});

test("empty results have no observed months or labels", async () => {
  const data = response([row("2014-01", 0, 0)], { filtered_rows: 0 });
  const observed = await resolveMonthlyObservations(data, new AbortController().signal, async () => { throw new Error("Unexpected request"); });
  assert.deepEqual(monthlyExtremes(buildMonthlySeries(observed)), { peak: null, loss: null });
  assert.deepEqual(buildMonthlySeries([]), []);
});

test("zero-month checks preserve global filters and inclusive partial dates", async () => {
  const selected = { ...filters(), years: [2016], regions: ["West"], categories: ["Furniture"], date_from: "2016-02-10", date_to: "2016-02-20" };
  const data = response([row("2016-02", 0, 0)], { applied_filters: selected });
  let supplied;
  const rows = await resolveMonthlyObservations(data, new AbortController().signal, async chosen => {
    supplied = chosen;
    return response([], { filtered_rows: 1 });
  });
  assert.deepEqual(supplied, selected);
  assert.equal(rows[0].observed, true);
});

test("zero-month requests have at most four concurrent workers", async () => {
  let active = 0, maximum = 0;
  const data = response(Array.from({ length: 12 }, (_, i) => row(`2016-${String(i + 1).padStart(2, "0")}`, 0, 0)));
  const rows = await resolveMonthlyObservations(data, new AbortController().signal, async () => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return response([], { filtered_rows: 0 });
  });
  assert.equal(maximum, 4);
  assert.ok(rows.every(point => !point.observed));
});

test("cancelled filter states reject zero-month checks", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(resolveMonthlyObservations(response([row("2016-01", 0, 0)]), controller.signal, async () => response([])), { name: "AbortError" });
});
