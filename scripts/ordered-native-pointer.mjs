// Playwright's zero-delay Mouse.click pipelines move/down/up concurrently.
// Await native protocol acknowledgements in order; do not synthesize events,
// add retries, sleep, or change the caller's receipt/acceptance deadline.
export async function orderedNativePointer(page, point, phases = []) {
  for (const [name, input] of [
    ["move", () => page.mouse.move(point.x, point.y)],
    ["down", () => page.mouse.down()],
    ["up", () => page.mouse.up()],
  ]) {
    const phase = { name, startedAt: Date.now(), status: "pending" };
    phases.push(phase);
    try { await input(); phase.status = "completed"; }
    catch (error) { phase.status = "error"; phase.error = String(error); throw error; }
    finally { phase.endedAt = Date.now(); }
  }
}
