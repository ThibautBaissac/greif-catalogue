import type { APIRoute } from "astro";
import { getCatalogue } from "~/lib/catalogue-astro";
import { toCsv } from "~/lib/opendata";

export const GET: APIRoute = async () =>
  new Response(toCsv(await getCatalogue()), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
