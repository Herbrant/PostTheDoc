// The observatory's figures as CSV files for the default period (the page's script rewrites the
// links for the period the reader picks), for checking them or reusing them.
import type { APIRoute } from "astro";
import { CSV_FILES, type CsvFile, csvTable } from "../../lib/observatory-csv";
import { loadObservatory } from "../../lib/observatory-data";

export const getStaticPaths = () => CSV_FILES.map((file) => ({ params: { file } }));

export const GET: APIRoute = ({ params }) =>
  new Response(csvTable(params.file as CsvFile, loadObservatory("it")?.figures ?? null), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
