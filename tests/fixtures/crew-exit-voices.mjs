export const crewExitCast = {
  scout: "hachi", brawler: "paisen", engineer: "monkey", brute: "tatara",
  guardian: "gantetsu", zakimiya: "zakimiya", tky: "tky", "miyamoto-musashi": "miyamoto-musashi",
};
export const crewExitTakes = Object.values(crewExitCast).flatMap(role =>
  ["01", "02"].map(take => {
    const name = role + "-death-" + take;
    return { id: "voice-" + name, path: "/audio/quality-20261127/crew-exits/" + name + ".mp3" };
  }));
