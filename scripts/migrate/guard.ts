import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Returns the refusal message when a rerun would delete edited works, undefined when it may proceed. */
export function shouldRefuse(contentDir: string, argv: string[]): string | undefined {
  if (argv.includes("--force")) return undefined;
  const worksDir = join(contentDir, "works");
  if (!existsSync(worksDir) || !readdirSync(worksDir).some(f => f.endsWith(".yaml"))) return undefined;
  return (
    `${worksDir} contient déjà des notices : relancer la migration les supprimerait et perdrait ` +
    `les modifications faites dans le CMS.\n` +
    `Si c'est bien voulu : npm run migrate -- --force`
  );
}
