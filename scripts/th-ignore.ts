// Netlify `ignore` command: exit 0 cancels the build. A push whose Th are not consistent
// is a Keystatic edit waiting for the GitHub Action; the Action's own commit gets built instead.
import { isConsistent } from "../src/lib/renumber.ts";
import { readWorkThs } from "./th-files.ts";

if (isConsistent(readWorkThs())) {
  process.exit(1);
} else {
  console.log("Th en attente de renumérotation : build ignoré.");
  process.exit(0);
}
