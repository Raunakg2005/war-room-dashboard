"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, CheckCircle2, Eye, Siren, UserRound } from "lucide-react";
import { Card, PageHeader, Segmented, cx } from "@/components/ui";
import { evaluateTriggers, type Trigger, type TriggerState } from "@/lib/analytics";

const ACTION_STYLE: Record<Trigger["action"], string> = {
  Protect: "bg-gain-soft text-gain",
  Renegotiate: "bg-gold-soft text-gold",
  Reroute: "bg-sky/12 text-sky",
  Triage: "bg-loss-soft text-loss",
  Restrict: "bg-violet/12 text-violet",
  Diversify: "bg-panel-2 text-ink-2 border border-line",
};

const STATE: Record<TriggerState, { label: string; cls: string; dot: string; icon: typeof Siren }> = {
  firing: { label: "Firing now", cls: "text-loss", dot: "bg-loss", icon: Siren },
  watch: { label: "Watch", cls: "text-gold", dot: "bg-gold", icon: Eye },
  clear: { label: "Clear", cls: "text-gain", dot: "bg-gain", icon: CheckCircle2 },
};

const PHASES = [
  { when: "Days 0–30", title: "Stop the bleeding", items: ["Restrict new Pipeline Bypass bookings", "Triage every held shipment past 30 days", "Open Meridian contract talks"] },
  { when: "Days 30–90", title: "Fix the economics", items: ["Sign mode-switch pass-through with Meridian", "Move non-Meridian energy volume to Cape", "Limit Air Bridge to critical cargo"] },
  { when: "Days 90–180", title: "Redesign the network", items: ["Add repricing clauses to every energy contract", "Qualify a second energy counterparty", "Run these triggers weekly as a standing playbook"] },
];

export function PlanView() {
  const triggers = useMemo(() => evaluateTriggers(), []);
  const [show, setShow] = useState<"all" | "firing">("all");
  const list = show === "firing" ? triggers.filter((t) => t.state === "firing") : triggers;
  const counts = { firing: 0, watch: 0, clear: 0 } as Record<TriggerState, number>;
  triggers.forEach((t) => { counts[t.state] += 1; });

  return (
    <>
      <PageHeader
        eyebrow="Action plan"
        title="Six moves, each with an owner, a deadline and a live trigger"
        lede="Every recommendation is tied to a rule that is checked against the shipment data. This turns the plan into a playbook the business can rerun at the next disruption."
        right={
          <div className="flex gap-2">
            {(["firing", "watch", "clear"] as const).map((s) => (
              <div key={s} className="rounded-2xl border border-line bg-panel px-4 py-3 text-center">
                <p className={cx("tabular font-serif text-3xl font-bold", STATE[s].cls)}>{counts[s]}</p>
                <p className="text-[11.5px] text-ink-3">{STATE[s].label}</p>
              </div>
            ))}
          </div>
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-ink-3">Triggers are evaluated on the full portfolio.</p>
        <Segmented label="Show" value={show} onChange={setShow} options={[{ value: "all", label: "All six" }, { value: "firing", label: `Firing (${counts.firing})` }]} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((t, i) => {
          const st = STATE[t.state];
          const Icon = st.icon;
          return (
            <motion.article
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col rounded-2xl border border-line bg-panel p-5 shadow-glow"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cx("rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider", ACTION_STYLE[t.action])}>{t.action}</span>
                <span className={cx("flex items-center gap-2 text-[12.5px] font-semibold", st.cls)}>
                  <span className="relative flex size-2.5">
                    {t.state === "firing" && <span className={cx("absolute inline-flex size-full animate-ping rounded-full opacity-60", st.dot)} />}
                    <span className={cx("relative inline-flex size-2.5 rounded-full", st.dot)} />
                  </span>
                  <Icon className="size-4" /> {st.label}
                </span>
              </div>
              <p className="mt-3 text-[15px] font-semibold leading-snug text-ink">{t.what}</p>
              <div className="mt-4 rounded-xl border border-line bg-panel-2 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Trigger</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{t.rule}</p>
                <p className={cx("tabular mt-2 text-[14px] font-semibold", st.cls)}>{t.reading}</p>
              </div>
              <p className="mt-3 text-[12.5px] leading-snug text-ink-3">{t.detail}</p>
              <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-4 text-[12.5px] text-ink-2">
                <span className="flex items-center gap-1.5"><UserRound className="size-3.5 text-ink-3" />{t.owner}</span>
                <span className="flex items-center gap-1.5"><CalendarClock className="size-3.5 text-ink-3" />{t.when}</span>
              </div>
            </motion.article>
          );
        })}
      </div>

      <Card className="mt-6 p-5">
        <p className="text-[15px] font-semibold text-ink">180-day roadmap</p>
        <ol className="relative mt-5 grid gap-6 md:grid-cols-3 md:gap-4">
          <div aria-hidden className="absolute left-3 top-3 hidden h-px w-[calc(100%-24px)] bg-line-2 md:block" />
          {PHASES.map((p, i) => (
            <li key={p.when} className="relative">
              <span className={cx("relative z-10 grid size-6 place-items-center rounded-full text-[12px] font-bold", i === 0 ? "bg-loss text-white" : i === 1 ? "bg-gold text-bg" : "bg-gain text-bg")}>{i + 1}</span>
              <p className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-3">{p.when}</p>
              <p className="mt-0.5 font-serif text-xl font-bold text-ink">{p.title}</p>
              <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />{it}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { k: "Protect", t: "Overland Truck for containerized cargo", d: "165 shipments, $1.6M of exposure, delivered on time.", c: "border-gain/40" },
          { k: "Change", t: "How energy freight is priced when the route changes", d: "Revenue stayed fixed while Pipeline cost per ton rose more than 5×.", c: "border-gold/50" },
          { k: "Stop", t: "Open-ended waiting and ranking routes by margin %", d: "Both hide where the real, dollar-denominated risk sits.", c: "border-loss/40" },
        ].map((x) => (
          <div key={x.k} className={cx("rounded-2xl border-2 bg-panel p-5", x.c)}>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">{x.k}</p>
            <p className="mt-1 font-serif text-lg font-bold leading-snug text-ink">{x.t}</p>
            <p className="mt-2 text-[13px] text-ink-2">{x.d}</p>
          </div>
        ))}
      </div>
    </>
  );
}
