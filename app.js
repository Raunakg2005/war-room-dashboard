(() => {
  "use strict";

  const DATA = window.SHIPMENTS || [];
  const ENERGY = new Set(["Crude Oil", "Refined Petrochemicals"]);
  const ROUTES = ["Direct (Pre-Blockade)", "Cape of Good Hope", "Pipeline Bypass", "Held in Gulf", "Overland Truck", "Air Bridge"];
  const PRODUCTS = ["Crude Oil", "Refined Petrochemicals", "High-Tech Components", "Pharmaceuticals", "Industrial Machinery", "Consumer Goods"];
  const MERIDIAN = "Meridian Energy Partners";
  const HELD = "Held in Gulf";
  const PAGE_SIZE = 25;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
  const avg = (arr, f) => (arr.length ? sum(arr, f) / arr.length : 0);
  const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m.get(k) || m.set(k, []).get(k)).push(x); return m; }, new Map());
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isEnergy = (r) => ENERGY.has(r.product);
  const twoLine = (s) => {
    const w = s.split(" ");
    if (w.length < 2) return s;
    const cut = w.length === 2 ? 1 : Math.ceil(w.length / 2);
    return [w.slice(0, cut).join(" "), w.slice(cut).join(" ")];
  };

  // ---------- formatting ----------
  function money(v, { sign = true, digits = 1 } = {}) {
    const a = Math.abs(v);
    let s;
    if (a >= 1e9) s = `$${(a / 1e9).toFixed(digits)}B`;
    else if (a >= 1e6) s = `$${(a / 1e6).toFixed(digits)}M`;
    else if (a >= 1e3) s = `$${(a / 1e3).toFixed(digits)}K`;
    else s = `$${a.toFixed(0)}`;
    if (v < 0 && sign) return `−${s}`;
    if (v > 0 && sign === "plus") return `+${s}`;
    return s;
  }
  const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`.replace("-", "−");
  const int = (v) => Math.round(v).toLocaleString("en-US");
  const tone = (v) => (v < 0 ? "is-loss" : v > 0 ? "is-gain" : "");

  // ---------- state ----------
  const state = { group: "", route: "", product: "", customer: "", region: "", q: "", sort: { key: "margin", dir: 1 }, page: 0 };
  const FILTER_KEYS = ["group", "route", "product", "customer", "region"];

  function applyFilters(rows) {
    return rows.filter((r) =>
      (!state.group || (state.group === "energy" ? isEnergy(r) : !isEnergy(r))) &&
      (!state.route || r.route === state.route) &&
      (!state.product || r.product === state.product) &&
      (!state.customer || r.customer === state.customer) &&
      (!state.region || r.region === state.region));
  }

  // ---------- theme ----------
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function palette() {
    return {
      text: cssVar("--text"), text2: cssVar("--text-2"), muted: cssVar("--muted"), grid: cssVar("--grid"),
      surface: cssVar("--surface"), accent: cssVar("--accent"), loss: cssVar("--loss"), gain: cssVar("--gain"),
      neutral: cssVar("--neutral"),
      series: [1, 2, 3, 4, 5, 6].map((i) => cssVar(`--series-${i}`)),
    };
  }
  const ROUTE_COLOR = (P) => ({
    "Direct (Pre-Blockade)": P.series[3], "Cape of Good Hope": P.series[2], "Pipeline Bypass": P.series[1],
    "Held in Gulf": P.series[0], "Overland Truck": P.series[4], "Air Bridge": P.series[5],
  });
  function effectiveTheme() {
    const set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  // ---------- charts ----------
  const charts = {};
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function baseOptions(P, { horizontal = false, money: isMoney = true, stacked = false, percentAxis = false, legend = false } = {}) {
    const valueTicks = {
      color: P.muted,
      callback: (v) => (percentAxis ? `${Math.round(v * 100)}%` : isMoney ? money(v, { digits: 0 }) : v),
    };
    const catTicks = { color: P.text2, autoSkip: false };
    const valueAxis = { grid: { color: P.grid }, border: { display: false }, ticks: valueTicks, stacked };
    const catAxis = { grid: { display: false }, border: { color: P.grid }, ticks: catTicks, stacked };
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduceMotion ? false : { duration: 350 },
      indexAxis: horizontal ? "y" : "x",
      layout: { padding: { right: 8 } },
      plugins: {
        legend: { display: legend, position: "bottom", labels: { color: P.text2, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2, padding: 14 } },
        tooltip: {
          backgroundColor: P.surface, titleColor: P.text, bodyColor: P.text2, borderColor: P.grid, borderWidth: 1,
          padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4,
        },
      },
      scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    };
  }

  function draw(id, config, summary) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return;
    canvas.setAttribute("aria-label", summary);
    const wrap = canvas.parentElement;
    const empty = wrap.querySelector(".empty");
    const hasData = config.data.datasets.some((d) => d.data.some((v) => v !== null && v !== 0));
    if (!hasData) {
      canvas.hidden = true;
      if (!empty) wrap.insertAdjacentHTML("beforeend", '<div class="empty">No shipments match this view.</div>');
      return;
    }
    canvas.hidden = false;
    if (empty) empty.remove();
    if (charts[id]) {
      charts[id].data = config.data;
      charts[id].options = config.options;
      charts[id].update();
    } else {
      charts[id] = new Chart(canvas, config);
    }
  }

  function destroyCharts() {
    Object.keys(charts).forEach((k) => { charts[k].destroy(); delete charts[k]; });
  }

  // ---------- analysis helpers ----------
  function buckets(rows) {
    const defs = [
      ["Meridian × Pipeline Bypass", (r) => isEnergy(r) && r.route === "Pipeline Bypass" && r.customer === MERIDIAN],
      ["Other accounts × Pipeline Bypass", (r) => isEnergy(r) && r.route === "Pipeline Bypass"],
      ["Energy cargo held in Gulf", (r) => isEnergy(r) && r.route === HELD],
      ["Energy cargo via Cape", (r) => isEnergy(r) && r.route === "Cape of Good Hope"],
      ["All containerized cargo", (r) => !isEnergy(r)],
      ["Energy cargo, pre-blockade", (r) => isEnergy(r)],
    ];
    const out = defs.map(([label]) => ({ label, margin: 0, n: 0 }));
    rows.forEach((r) => {
      const i = defs.findIndex(([, f]) => f(r));
      out[i].margin += r.margin;
      out[i].n += 1;
    });
    return out;
  }

  const byKey = (rows, key, order) => {
    const g = groupBy(rows, (r) => r[key]);
    const keys = order ? order.filter((k) => g.has(k)) : [...g.keys()];
    return keys.map((k) => ({ key: k, rows: g.get(k) }));
  };

  // ---------- render: filters ----------
  function fillSelect(name, values) {
    const sel = $(`select[name="${name}"]`);
    values.forEach((v) => sel.insertAdjacentHTML("beforeend", `<option value="${esc(v)}">${esc(v)}</option>`));
  }

  function syncFilterUI() {
    let active = 0;
    FILTER_KEYS.forEach((k) => {
      const sel = $(`select[name="${k}"]`);
      sel.value = state[k];
      sel.classList.toggle("is-set", !!state[k]);
      if (state[k]) active += 1;
    });
    const badge = $(".filters-toggle .badge");
    badge.textContent = active;
    badge.hidden = active === 0;
    const params = new URLSearchParams();
    FILTER_KEYS.forEach((k) => state[k] && params.set(k, state[k]));
    const qs = params.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  }

  // ---------- render: overview ----------
  function renderOverview(rows) {
    const n = rows.length;
    const rev = sum(rows, (r) => r.rev);
    const recog = sum(rows, (r) => r.recog);
    const cost = sum(rows, (r) => r.cost);
    const margin = sum(rows, (r) => r.margin);
    const delivered = rows.filter((r) => r.route !== HELD);
    const onTime = rows.filter((r) => r.difot).length;
    const held = rows.filter((r) => r.route === HELD);

    const filtersOn = FILTER_KEYS.filter((k) => state[k]).map((k) => (k === "group" ? (state.group === "energy" ? "Energy cargo" : "Containerized cargo") : state[k]));
    $("#scope").textContent = filtersOn.length ? `Showing: ${filtersOn.join(" · ")}` : "Showing all 243 shipments";

    const kpis = [
      { label: "Shipments", value: int(n), note: `${int(delivered.length)} delivered · ${int(held.length)} held in Gulf` },
      { label: "Contracted revenue", value: money(rev), note: `${money(recog)} recognized so far` },
      { label: "Cost to serve", value: money(cost), note: recog > 0 ? `${(cost / recog).toFixed(1)}× the revenue recognized` : "No revenue recognized yet" },
      { label: "Gross margin", value: money(margin, { sign: "plus" }), cls: tone(margin), note: rev ? `${pct(margin / rev)} of contracted revenue` : "" },
      { label: "Delivered on time, in full", value: n ? pct(onTime / n) : "–", note: `${int(onTime)} of ${int(n)} shipments` },
      { label: "Cargo value stuck in Gulf", value: money(sum(held, (r) => r.value)), cls: held.length ? "is-accent" : "", note: `${money(sum(held, (r) => r.rev))} of revenue not yet recognized` },
    ];
    $("#kpis").innerHTML = kpis.map((k) => `
      <div class="kpi">
        <span class="kpi__label">${k.label}</span>
        <span class="kpi__value ${k.cls || ""}">${k.value}</span>
        <span class="kpi__note">${k.note}</span>
      </div>`).join("");

    const ins = [];
    if (!n) {
      ins.push({ big: "–", text: "No shipments match these filters. Try resetting them." });
    } else if (margin >= 0) {
      ins.push({ big: money(margin, { sign: "plus" }), text: "This view is profitable. Losses come from routes and cargo outside it." });
    } else {
      const b = buckets(rows).filter((x) => x.margin < 0).sort((a, c) => a.margin - c.margin)[0];
      ins.push({ big: pct(b.margin / margin), text: `of the loss in this view comes from <b>${esc(b.label.toLowerCase())}</b> (${int(b.n)} shipments, ${money(b.margin)}).` });

      const custs = byKey(rows, "customer").map((c) => ({ key: c.key, m: sum(c.rows, (r) => r.margin) })).sort((a, c) => a.m - c.m);
      if (custs.length > 1 && custs[0].m < 0) {
        ins.push({ big: pct(custs[0].m / margin), text: `comes from one account: <b>${esc(custs[0].key)}</b> (${money(custs[0].m)}).` });
      } else if (held.length) {
        ins.push({ big: money(sum(held, (r) => r.value)), text: `of cargo is stuck in the Gulf across ${int(held.length)} shipment${held.length === 1 ? "" : "s"}, with ${money(sum(held, (r) => r.cost))} already spent and no revenue recognized.` });
      } else {
        ins.push({ big: pct(onTime / n), text: `of shipments in this view were delivered in full and on time.` });
      }

      const routes = byKey(rows, "route", ROUTES).map((g) => ({ key: g.key, rows: g.rows, m: sum(g.rows, (r) => r.margin) })).sort((a, c) => a.m - c.m);
      const worst = routes[0];
      if (worst && worst.m < 0) {
        const cpt = sum(worst.rows, (r) => r.cost) / sum(worst.rows, (r) => r.tons);
        const rpt = sum(worst.rows, (r) => r.rev) / sum(worst.rows, (r) => r.tons);
        const text = worst.key === HELD
          ? `is the loss on <b>Held in Gulf</b> shipments: cost has been paid, but no revenue can be recognized until they deliver.`
          : `is the loss on <b>${esc(worst.key)}</b>, which costs ${(cpt / rpt).toFixed(1)}× per ton what its contracts pay.`;
        ins.push({ big: money(worst.m), text });
      }
    }
    $("#insights").innerHTML = ins.map((i) => `<div class="insight"><strong>${i.big}</strong><p>${i.text}</p></div>`).join("");
  }

  // ---------- render: loss drivers ----------
  function renderDrivers(rows, P) {
    const b = buckets(rows).filter((x) => x.n > 0);
    const bColors = [P.loss, P.loss, P.accent, P.neutral, P.neutral, P.gain];
    const bAll = buckets(rows);
    const colorFor = (label) => bColors[bAll.findIndex((x) => x.label === label)];
    const o1 = baseOptions(P, { horizontal: true });
    o1.plugins.tooltip.callbacks = { label: (c) => ` ${money(c.raw)} across ${b[c.dataIndex].n} shipments` };
    draw("c-buckets", {
      type: "bar",
      data: { labels: b.map((x) => x.label), datasets: [{ data: b.map((x) => x.margin), backgroundColor: b.map((x) => colorFor(x.label)), borderRadius: 4, maxBarThickness: 34 }] },
      options: o1,
    }, `Gross margin by loss bucket: ${b.map((x) => `${x.label} ${money(x.margin)}`).join("; ")}`);

    const signed = (groups) => groups.map((g) => ({ key: g.key, m: sum(g.rows, (r) => r.margin), n: g.rows.length }));
    const byRoute = signed(byKey(rows, "route", ROUTES));
    const o2 = baseOptions(P, { horizontal: true });
    o2.plugins.tooltip.callbacks = { label: (c) => ` ${money(c.raw)} across ${byRoute[c.dataIndex].n} shipments` };
    draw("c-route", {
      type: "bar",
      data: { labels: byRoute.map((x) => x.key), datasets: [{ data: byRoute.map((x) => x.m), backgroundColor: byRoute.map((x) => (x.m < 0 ? P.loss : P.gain)), borderRadius: 4, maxBarThickness: 28 }] },
      options: o2,
    }, `Gross margin by route: ${byRoute.map((x) => `${x.key} ${money(x.m)}`).join("; ")}`);

    const byProd = signed(byKey(rows, "product", PRODUCTS));
    const o3 = baseOptions(P, { horizontal: true });
    o3.plugins.tooltip.callbacks = { label: (c) => ` ${money(c.raw)} across ${byProd[c.dataIndex].n} shipments` };
    draw("c-product", {
      type: "bar",
      data: { labels: byProd.map((x) => x.key), datasets: [{ data: byProd.map((x) => x.m), backgroundColor: byProd.map((x) => (x.m < 0 ? P.loss : P.gain)), borderRadius: 4, maxBarThickness: 28 }] },
      options: o3,
    }, `Gross margin by product: ${byProd.map((x) => `${x.key} ${money(x.m)}`).join("; ")}`);

    // % vs $
    const prod = byKey(rows, "product", PRODUCTS).map((g) => ({
      key: g.key,
      pct: -avg(g.rows, (r) => r.margin / r.rev),
      loss: -sum(g.rows, (r) => r.margin),
      energy: ENERGY.has(g.key),
    }));
    const pctSorted = [...prod].sort((a, c) => c.pct - a.pct);
    const dolSorted = [...prod].sort((a, c) => c.loss - a.loss);
    const colorProd = (x) => (x.energy ? P.loss : P.accent);
    const o4 = baseOptions(P, { horizontal: true, percentAxis: true });
    o4.plugins.tooltip.callbacks = { label: (c) => ` Average margin loss: ${pct(c.raw)} of contracted revenue` };
    draw("c-pct", {
      type: "bar",
      data: { labels: pctSorted.map((x) => x.key), datasets: [{ data: pctSorted.map((x) => x.pct), backgroundColor: pctSorted.map(colorProd), borderRadius: 4, maxBarThickness: 26 }] },
      options: o4,
    }, `Average margin loss percent by product: ${pctSorted.map((x) => `${x.key} ${pct(x.pct)}`).join("; ")}`);
    const o5 = baseOptions(P, { horizontal: true });
    o5.plugins.tooltip.callbacks = { label: (c) => ` Loss: ${money(c.raw, { sign: false })}` };
    draw("c-dollar", {
      type: "bar",
      data: { labels: dolSorted.map((x) => x.key), datasets: [{ data: dolSorted.map((x) => x.loss), backgroundColor: dolSorted.map(colorProd), borderRadius: 4, maxBarThickness: 26 }] },
      options: o5,
    }, `Dollar loss by product: ${dolSorted.map((x) => `${x.key} ${money(x.loss)}`).join("; ")}`);

    // weekly
    const weekOf = (d) => {
      const dt = new Date(`${d}T00:00:00Z`);
      const day = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    };
    const weeks = [...new Set(rows.map((r) => weekOf(r.date)))].sort();
    const RC = ROUTE_COLOR(P);
    const routesPresent = ROUTES.filter((rt) => rows.some((r) => r.route === rt));
    const label = (w) => new Date(`${w}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const o6 = baseOptions(P, { stacked: true, legend: true });
    o6.plugins.tooltip.mode = "index";
    o6.plugins.tooltip.callbacks = {
      title: (items) => `Week of ${items[0].label}`,
      label: (c) => (c.raw ? ` ${c.dataset.label}: ${money(c.raw)}` : null),
      footer: (items) => `Week total: ${money(items.reduce((a, i) => a + (i.raw || 0), 0))}`,
    };
    draw("c-weekly", {
      type: "bar",
      data: {
        labels: weeks.map(label),
        datasets: routesPresent.map((rt) => ({
          label: rt,
          data: weeks.map((w) => sum(rows.filter((r) => r.route === rt && weekOf(r.date) === w), (r) => r.margin) || null),
          backgroundColor: RC[rt],
          borderRadius: 2,
          maxBarThickness: 40,
        })),
      },
      options: o6,
    }, `Weekly gross margin by route across ${weeks.length} weeks.`);
  }

  // ---------- render: unit economics ----------
  function renderEconomics(rows, P) {
    const energy = rows.filter(isEnergy);
    const er = byKey(energy, "route", ROUTES.filter((r) => !["Overland Truck", "Air Bridge"].includes(r)));
    const o1 = baseOptions(P, { legend: true });
    o1.scales.y.ticks.callback = (v) => `$${v}`;
    o1.scales.x.ticks.maxRotation = 0;
    o1.plugins.legend.labels.generateLabels = (chart) => Chart.defaults.plugins.legend.labels.generateLabels(chart)
      .map((l) => (l.datasetIndex === 0 ? { ...l, fillStyle: P.loss, strokeStyle: P.loss } : l));
    o1.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: $${c.raw.toFixed(2)} per ton` };
    const cpt = er.map((g) => avg(g.rows, (r) => r.cost / r.tons));
    const rpt = er.map((g) => avg(g.rows, (r) => r.rev / r.tons));
    draw("c-perton", {
      type: "bar",
      data: {
        labels: er.map((g) => (g.key === "Direct (Pre-Blockade)" ? ["Direct", "(Pre-Blockade)"] : twoLine(g.key))),
        datasets: [
          { type: "bar", label: "Cost per ton", data: cpt, backgroundColor: er.map((g) => (g.key === "Direct (Pre-Blockade)" ? P.neutral : P.loss)), borderRadius: 4, maxBarThickness: 56, order: 2 },
          { type: "line", label: "Contracted revenue per ton", data: rpt, borderColor: P.accent, backgroundColor: P.accent, pointRadius: 5, pointHoverRadius: 7, borderWidth: 3, tension: 0, order: 1 },
        ],
      },
      options: o1,
    }, `Energy cargo cost versus revenue per ton: ${er.map((g, i) => `${g.key} cost $${cpt[i].toFixed(2)}, revenue $${rpt[i].toFixed(2)}`).join("; ")}`);

    const rg = byKey(rows, "route", ROUTES);
    const parts = [["Freight", "freight", P.series[2]], ["Fuel", "fuel", P.series[5]], ["War-risk insurance", "ins", P.series[0]], ["Late-delivery penalties", "pen", P.series[1]]];
    const o2 = baseOptions(P, { horizontal: true, stacked: true, legend: true, percentAxis: true });
    o2.scales.x.max = 1;
    o2.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: ${pct(c.raw, 1)}` };
    draw("c-mix", {
      type: "bar",
      data: {
        labels: rg.map((g) => g.key),
        datasets: parts.map(([lab, k, col]) => ({
          label: lab, backgroundColor: col, maxBarThickness: 26,
          data: rg.map((g) => { const t = sum(g.rows, (r) => r.cost); return t ? sum(g.rows, (r) => r[k]) / t : 0; }),
        })),
      },
      options: o2,
    }, "Cost composition by route as a share of cost to serve.");

    const o3 = baseOptions(P, { percentAxis: true });
    o3.scales.y.max = 1;
    o3.scales.x.ticks.maxRotation = 0;
    o3.plugins.tooltip.callbacks = { label: (c) => ` ${pct(c.raw)} on time and in full (${rg[c.dataIndex].rows.filter((r) => r.difot).length} of ${rg[c.dataIndex].rows.length})` };
    const difot = rg.map((g) => g.rows.filter((r) => r.difot).length / g.rows.length);
    draw("c-difot", {
      type: "bar",
      data: {
        labels: rg.map((g) => (g.key === HELD ? ["Held in Gulf", "(undelivered)"] : g.key === "Direct (Pre-Blockade)" ? ["Direct", "(Pre-Blockade)"] : twoLine(g.key))),
        datasets: [{ data: difot.map((v) => v || 0.004), backgroundColor: difot.map((v) => (v >= 0.95 ? P.gain : v >= 0.7 ? P.accent : P.loss)), borderRadius: 4, maxBarThickness: 48 }],
      },
      options: o3,
    }, `DIFOT by route: ${rg.map((g, i) => `${g.key} ${pct(difot[i])}`).join("; ")}`);

    $("#t-routes").innerHTML = `
      <thead><tr><th>Route</th><th class="num">Shipments</th><th class="num">Revenue</th><th class="num">Cost</th><th class="num">Margin</th><th class="num">DIFOT</th></tr></thead>
      <tbody>${rg.map((g) => {
        const m = sum(g.rows, (r) => r.margin);
        const d = g.rows.filter((r) => r.difot).length / g.rows.length;
        return `<tr><td>${esc(g.key)}</td><td class="num">${g.rows.length}</td><td class="num">${money(sum(g.rows, (r) => r.recog))}</td><td class="num">${money(sum(g.rows, (r) => r.cost))}</td><td class="num ${tone(m)}">${money(m, { sign: "plus" })}</td><td class="num"><span class="pill ${d >= 0.95 ? "pill--good" : d < 0.7 ? "pill--bad" : ""}">${pct(d)}</span></td></tr>`;
      }).join("") || '<tr><td colspan="6">No shipments match this view.</td></tr>'}</tbody>`;
  }

  // ---------- render: customers ----------
  function renderCustomers(rows, P) {
    const cust = byKey(rows, "customer").map((g) => {
      const routeCounts = groupBy(g.rows, (r) => r.route);
      const main = [...routeCounts.entries()].sort((a, b) => sum(a[1], (r) => r.margin) - sum(b[1], (r) => r.margin))[0][0];
      return {
        key: g.key, n: g.rows.length, region: g.rows[0].region, since: g.rows[0].since,
        rev: sum(g.rows, (r) => r.rev), m: sum(g.rows, (r) => r.margin), main,
      };
    }).sort((a, b) => a.m - b.m);
    const top = cust.slice(0, 10);
    const rest = cust.slice(10);
    const items = rest.length ? [...top, { key: `${rest.length} other customers`, m: sum(rest, (c) => c.m), n: sum(rest, (c) => c.n) }] : top;
    const o1 = baseOptions(P, { horizontal: true });
    o1.plugins.tooltip.callbacks = { label: (c) => ` ${money(c.raw)} across ${items[c.dataIndex].n} shipments` };
    draw("c-customers", {
      type: "bar",
      data: {
        labels: items.map((c) => c.key),
        datasets: [{ data: items.map((c) => c.m), backgroundColor: items.map((c, i) => (c.m >= 0 ? P.gain : i === 0 && cust.length > 1 ? P.loss : P.neutral)), borderRadius: 4, maxBarThickness: 26 }],
      },
      options: o1,
    }, `Gross margin by customer: ${items.map((c) => `${c.key} ${money(c.m)}`).join("; ")}`);

    const totalLoss = sum(cust, (c) => Math.min(c.m, 0));
    const maxShare = Math.max(...cust.map((c) => (totalLoss ? Math.min(c.m, 0) / totalLoss : 0)), 0.0001);
    $("#t-customers").innerHTML = `
      <thead><tr><th>Customer</th><th class="num">Since</th><th class="num">Shipments</th><th class="num">Margin</th><th class="num">Share of loss</th><th>Costliest route</th></tr></thead>
      <tbody>${cust.map((c) => {
        const share = totalLoss ? Math.min(c.m, 0) / totalLoss : 0;
        return `<tr><td><span class="cell-main">${esc(c.key)}</span><span class="cell-sub">${esc(c.region)}</span></td><td class="num">${c.since}</td><td class="num">${c.n}</td><td class="num ${tone(c.m)}">${money(c.m, { sign: "plus" })}</td><td class="num"><span class="bar-cell"><i style="width:${Math.round((share / maxShare) * 60)}px"></i>${pct(share, 1)}</span></td><td>${esc(c.main)}</td></tr>`;
      }).join("") || '<tr><td colspan="6">No shipments match this view.</td></tr>'}</tbody>`;
  }

  // ---------- render: held in gulf ----------
  function renderHeld(rows, P) {
    const held = rows.filter((r) => r.route === HELD);
    const cost = sum(held, (r) => r.cost);
    const waiting = sum(held, (r) => r.ins + r.pen);
    const days = held.map((r) => r.delay || 0);
    const k = [
      { label: "Shipments held", value: int(held.length), note: rows.length ? `${pct(held.length / rows.length)} of this view` : "" },
      { label: "Cargo value stuck", value: money(sum(held, (r) => r.value)), cls: "is-accent", note: `${money(sum(held.filter(isEnergy), (r) => r.value))} of it is energy cargo` },
      { label: "Cost already paid", value: money(cost), cls: cost ? "is-loss" : "", note: `${money(sum(held, (r) => r.rev))} revenue waiting to be recognized` },
      { label: "Cost of waiting", value: cost ? pct(waiting / cost) : "–", note: "insurance and late penalties, not transport" },
      { label: "Days stuck", value: days.length ? `${Math.round(avg(days, (d) => d))} avg` : "–", note: days.length ? `longest: ${Math.max(...days)} days` : "No held shipments in this view" },
    ];
    $("#held-kpis").innerHTML = k.map((x) => `
      <div class="kpi"><span class="kpi__label">${x.label}</span><span class="kpi__value ${x.cls || ""}">${x.value}</span><span class="kpi__note">${x.note}</span></div>`).join("");

    const bins = [["Under 10 days", 0, 10], ["10–19 days", 10, 20], ["20–29 days", 20, 30], ["30–39 days", 30, 40], ["40+ days", 40, Infinity]];
    const counts = bins.map(([, lo, hi]) => days.filter((d) => d >= lo && d < hi).length);
    const o1 = baseOptions(P, { money: false });
    o1.scales.y.ticks.precision = 0;
    o1.plugins.tooltip.callbacks = { label: (c) => ` ${c.raw} shipment${c.raw === 1 ? "" : "s"}` };
    draw("c-stuck", {
      type: "bar",
      data: { labels: bins.map((b) => b[0]), datasets: [{ data: counts, backgroundColor: bins.map((b) => (b[1] >= 30 ? P.loss : P.accent)), borderRadius: 4, maxBarThickness: 64 }] },
      options: o1,
    }, `Held shipments by days stuck: ${bins.map((b, i) => `${b[0]} ${counts[i]}`).join("; ")}`);

    const hv = byKey(held, "product", PRODUCTS).map((g) => ({ key: g.key, v: sum(g.rows, (r) => r.value), n: g.rows.length }));
    const o2 = baseOptions(P, { horizontal: true });
    o2.plugins.tooltip.callbacks = { label: (c) => ` ${money(c.raw)} across ${hv[c.dataIndex].n} shipments` };
    draw("c-heldvalue", {
      type: "bar",
      data: { labels: hv.map((x) => `${x.key} (${x.n})`), datasets: [{ data: hv.map((x) => x.v), backgroundColor: hv.map((x) => (ENERGY.has(x.key) ? P.accent : P.neutral)), borderRadius: 4, maxBarThickness: 26 }] },
      options: o2,
    }, `Stuck cargo value by product: ${hv.map((x) => `${x.key} ${money(x.v)}`).join("; ")}`);
  }

  // ---------- render: explorer ----------
  const COLS = [
    { key: "id", label: "ID" },
    { key: "date", label: "Departed", fmt: (v) => new Date(`${v}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) },
    { key: "customer", label: "Customer" },
    { key: "product", label: "Product" },
    { key: "route", label: "Route" },
    { key: "tons", label: "Tons", num: true, fmt: (v) => int(v) },
    { key: "rev", label: "Revenue", num: true, fmt: (v) => money(v) },
    { key: "cost", label: "Cost", num: true, fmt: (v) => money(v) },
    { key: "margin", label: "Margin", num: true, fmt: (v) => money(v, { sign: "plus" }), cls: tone },
    { key: "mpct", label: "Margin %", num: true, fmt: (v) => pct(v), cls: tone },
    { key: "delay", label: "Delay", num: true, fmt: (v) => (v ?? "–") },
    { key: "difot", label: "DIFOT", fmt: (v, r) => (r.route === HELD ? '<span class="pill">Held</span>' : v ? '<span class="pill pill--good">Met</span>' : '<span class="pill pill--bad">Missed</span>') },
  ];

  function explorerRows(rows) {
    const q = state.q.trim().toLowerCase();
    const out = rows
      .map((r) => ({ ...r, mpct: r.margin / r.rev }))
      .filter((r) => !q || [r.id, r.customer, r.product, r.route, r.region].some((s) => s.toLowerCase().includes(q)));
    const { key, dir } = state.sort;
    out.sort((a, b) => {
      const x = a[key], y = b[key];
      if (typeof x === "number" || typeof y === "number") return ((x ?? -Infinity) - (y ?? -Infinity)) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
    return out;
  }

  function renderExplorer(rows) {
    const list = explorerRows(rows);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages - 1);
    const slice = list.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    const head = COLS.map((c) => {
      const sorted = state.sort.key === c.key ? (state.sort.dir === 1 ? "ascending" : "descending") : "none";
      return `<th class="${c.num ? "num" : ""}" aria-sort="${sorted}"><button type="button" data-sort="${c.key}">${c.label}</button></th>`;
    }).join("");
    const body = slice.map((r) => `<tr>${COLS.map((c) => {
      const v = r[c.key];
      const shown = c.fmt ? c.fmt(v, r) : esc(v);
      return `<td class="${c.num ? "num" : ""} ${c.cls ? c.cls(v) : ""}">${shown}</td>`;
    }).join("")}</tr>`).join("");
    $("#t-ship").innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${COLS.length}">No shipments match.</td></tr>`}</tbody>`;
    $("#count").textContent = `${int(list.length)} shipment${list.length === 1 ? "" : "s"}`;
    $("#page").textContent = `Page ${state.page + 1} of ${pages}`;
    $("#prev").disabled = state.page === 0;
    $("#next").disabled = state.page >= pages - 1;
  }

  function downloadCSV() {
    const list = explorerRows(applyFilters(DATA));
    const keys = ["id", "date", "customer", "region", "since", "product", "cargo", "route", "tons", "value", "rev", "recog", "freight", "fuel", "ins", "pen", "cost", "margin", "plan", "actual", "delay", "difot"];
    const headers = ["Shipment_ID", "Departure_Date", "Customer", "Region", "Customer_Since", "Product", "Cargo_Type", "Route", "Tons", "Cargo_Value_USD", "Contracted_Revenue_USD", "Revenue_Recognized_USD", "Freight_USD", "Fuel_USD", "Insurance_USD", "Penalty_USD", "Cost_to_Serve_USD", "Gross_Margin_USD", "Planned_Days", "Actual_Days", "Delay_Days", "DIFOT_Met"];
    const cell = (v) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "boolean" ? (v ? "Y" : "N") : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...list.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "war-room-shipments.csv" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- main render ----------
  function render() {
    const rows = applyFilters(DATA);
    const P = palette();
    if (window.Chart) {
      Chart.defaults.font.family = cssVar("--font-body");
      Chart.defaults.color = P.text2;
    }
    syncFilterUI();
    renderOverview(rows);
    renderDrivers(rows, P);
    renderEconomics(rows, P);
    renderCustomers(rows, P);
    renderHeld(rows, P);
    renderExplorer(rows);
  }

  // ---------- wiring ----------
  function init() {
    fillSelect("route", ROUTES);
    fillSelect("product", PRODUCTS);
    fillSelect("customer", [...new Set(DATA.map((r) => r.customer))].sort());
    fillSelect("region", [...new Set(DATA.map((r) => r.region))].sort());

    const params = new URLSearchParams(location.search);
    FILTER_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v && [...$(`select[name="${k}"]`).options].some((o) => o.value === v)) state[k] = v;
    });

    const form = $("#filters");
    form.addEventListener("change", (e) => {
      if (!e.target.name) return;
      state[e.target.name] = e.target.value;
      state.page = 0;
      render();
    });
    form.addEventListener("reset", (e) => {
      e.preventDefault();
      FILTER_KEYS.forEach((k) => { state[k] = ""; });
      state.page = 0;
      render();
    });

    const toggle = $(".filters-toggle");
    toggle.addEventListener("click", () => {
      const open = form.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    $(".theme-toggle").addEventListener("click", () => {
      const next = effectiveTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("wr-theme", next); } catch (e) { /* storage unavailable */ }
      destroyCharts();
      render();
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!document.documentElement.getAttribute("data-theme")) { destroyCharts(); render(); }
    });

    let t;
    $("#q").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = e.target.value; state.page = 0; renderExplorer(applyFilters(DATA)); }, 120);
    });
    $("#t-ship").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sort]");
      if (!b) return;
      const key = b.dataset.sort;
      state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : (["margin", "mpct"].includes(key) ? 1 : -1) };
      renderExplorer(applyFilters(DATA));
    });
    $("#prev").addEventListener("click", () => { state.page -= 1; renderExplorer(applyFilters(DATA)); });
    $("#next").addEventListener("click", () => { state.page += 1; renderExplorer(applyFilters(DATA)); });
    $("#download").addEventListener("click", downloadCSV);

    const links = $$(".sections a");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${en.target.id}`));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main .section").forEach((s) => io.observe(s));

    if (!window.Chart) {
      $$(".chart").forEach((c) => { c.innerHTML = '<div class="empty">Charts could not load. Check your connection and refresh.</div>'; });
    }
    render();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { destroyCharts(); render(); });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
