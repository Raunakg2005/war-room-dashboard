# War Room — Strait Outta Hormuz

An analysis dashboard for the War Room Masterplan case. It explains where the $189.6M gross-margin loss came from during the Strait of Hormuz blockade, and what to do about it.

**Live:** https://raunakg2005.github.io/war-room-dashboard/

## What's inside

| View | What it answers |
| --- | --- |
| Command center | Headline KPIs, corridor map, revenue-to-margin waterfall, loss buckets, weekly margin, margin-% vs dollar-loss rank |
| Route economics | Cost vs revenue per ton, route margin, service vs economics, cost mix, scorecard |
| Customer exposure | Account concentration, account × route heatmap, account table |
| Held in Gulf | Days stuck, value at risk, a ranked triage queue |
| Deep dives | Pareto concentration, cost bridge, break-even pricing, hidden penalty and insurance rules, tenure, geography |
| What-if simulator | Reroute, pass-through and hold-cap levers with preset scenarios |
| Stress test | Projects the loss forward if the blockade lasts 1–26 more weeks, current playbook vs plan |
| Action plan | Six recommendations, each with a trigger evaluated live against the data |
| Data & method | Every data check, fix and exclusion, plus a searchable shipment explorer with CSV export |
| Story mode | An eight-slide, full-screen walkthrough for presenting |

Filters (route, product, account, region, status) apply across every view, and most charts are clickable to filter.

## Data

`src/data/shipments.json` is built from the `Shipment_Data` sheet (243 rows). Two blank insurance values were filled in as total − freight − fuel − penalty, two lower-case region labels were standardised, and `Customer_Concentration_Risk_Pct` is not used. Details are on the Data & method page. All values are USD.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` produces a static export in `out/`. Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

Built with Next.js, React, Tailwind CSS, Recharts and Motion.
