import type { APIRoute } from "astro";
import { getCatalogue } from "~/lib/catalogue-astro";
import { toOpenData } from "~/lib/opendata";

export const GET: APIRoute = async () =>
  new Response(`${JSON.stringify(toOpenData(await getCatalogue()), null, 2)}\n`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
