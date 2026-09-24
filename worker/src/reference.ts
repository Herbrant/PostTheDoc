// Tabelle condivise con la pipeline Python: la fonte è data/reference/*.json.
import regioni from "../../data/reference/regioni.json";
import ruoli from "../../data/reference/ruoli.json";
import settori from "../../data/reference/settori.json";
import strutture from "../../data/reference/strutture.json";

export const reference = { regioni, ruoli, settori, strutture };

export const roleCodes = new Set(ruoli.map((r) => r.code));
export const regionCodes = new Set(regioni.map((r) => r.code));
export const gsdCodes = new Set(settori.gsd.map((g) => g.code));
export const strutturaCodes = new Set(strutture.map((s) => s.code));
