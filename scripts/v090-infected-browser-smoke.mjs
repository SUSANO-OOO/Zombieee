process.env.AI_MISSION_QA_STAGES ??= "17,18,19,20";
process.env.AI_MISSION_QA_VIEWPORTS ??= "844x390";
process.env.AI_MISSION_QA_INFECTED_ABILITIES = "1";
process.env.AI_MISSION_QA_EVIDENCE_DIR ??= "outputs/v090-infected-runtime";

await import("./ai-mission-browser-smoke.mjs");
