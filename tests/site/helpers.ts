import { readdirSync } from "node:fs";

/** Number of works in the catalogue, counted from the data files so the tests never hard-code it. */
export const WORK_COUNT = readdirSync("content/works").filter(f => f.endsWith(".yaml")).length;
