export function installInfectedAbilityPhaseObserver(kinds) {
  const observed = Object.fromEntries(kinds.map((kind) => [kind, {
    phases: [],
    firstWarningAt: null,
    firstActiveAt: null,
    completedActivations: [],
    fighters: {},
  }]));
  const sample = () => {
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
    if (snapshot) {
      for (const fighter of snapshot.fighters) {
        if (!observed[fighter.kind]) continue;
        const phase = fighter.stationAbility?.phase ?? "idle";
        const entry = observed[fighter.kind];
        if (!entry.phases.includes(phase)) entry.phases.push(phase);
        const fighterId = String(fighter.id);
        const fighterEntry = entry.fighters[fighterId] ?? {
          phase: "missing",
          warningAt: null,
          activeAt: null,
        };
        if (phase === "warning" && fighterEntry.phase !== "warning") {
          fighterEntry.warningAt = snapshot.time;
          fighterEntry.activeAt = null;
          if (entry.firstWarningAt === null) entry.firstWarningAt = snapshot.time;
        } else if (phase === "active" && fighterEntry.phase !== "active") {
          if (fighterEntry.phase === "warning"
            && fighterEntry.warningAt !== null
            && snapshot.time > fighterEntry.warningAt) {
            fighterEntry.activeAt = snapshot.time;
            entry.completedActivations.push({
              fighterId,
              warningAt: fighterEntry.warningAt,
              activeAt: snapshot.time,
            });
            if (entry.firstActiveAt === null) entry.firstActiveAt = snapshot.time;
          } else {
            fighterEntry.warningAt = null;
            fighterEntry.activeAt = null;
          }
        } else if (phase !== "warning" && phase !== "active" && fighterEntry.phase === "warning") {
          fighterEntry.warningAt = null;
          fighterEntry.activeAt = null;
        }
        fighterEntry.phase = phase;
        entry.fighters[fighterId] = fighterEntry;
      }
    }
    window.requestAnimationFrame(sample);
  };
  window.__ASHFALL_INFECTED_PHASE_OBSERVER__ = { observed };
  window.requestAnimationFrame(sample);
}
