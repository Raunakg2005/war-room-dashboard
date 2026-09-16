# War Room Dashboard — Strait Outta Hormuz

Interactive analysis dashboard for the Quantiz'26 Round 2 case (War Room Masterplan).
It covers 243 shipments (5 Jan – 22 Mar 2026) and shows where the Strait of Hormuz
blockade turned into a margin and cash problem.

## What's inside

- **Overview** – headline KPIs and plain-language insights that update with the filters
- **Loss drivers** – non-overlapping loss buckets, margin by route and product, % vs $ check, weekly trend
- **Unit economics** – cost vs revenue per ton, cost composition, on-time delivery (DIFOT) by route
- **Customers** – loss by account and a customer exposure table
- **Held in Gulf** – stuck cargo value, cost already paid, days stuck
- **Shipment explorer** – search, sort and download any filtered view as CSV
- **Method** – glossary, data treatments and assumptions

Filters (cargo group, route, product, customer, region) apply to every section and are kept
in the URL, so a filtered view can be shared as a link. Light and dark themes; works on phones.

## Run locally

No build step. From this folder:

```
python -m http.server 8765
```

then open http://localhost:8765.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Layout, themes, responsive rules |
| `app.js` | Filtering, calculations, charts (Chart.js 4.4.1) |
| `data.js` | Cleaned shipment records exported from `Shipment_Data` |

## Data notes

- All 243 rows kept; shipment IDs are unique.
- Two lower-case region values were standardised.
- Two shipments (SGL-1185, SGL-1212) had a blank insurance cost; it was filled as
  total cost − freight − fuel − penalty, so totals and margins are unchanged.
- Total gross margin reconciles to −$189.6M.
