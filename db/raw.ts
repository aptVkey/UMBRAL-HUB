/**
 * Acesso à base de dados Supabase (Postgres) com a mesma interface que a app usava no D1:
 * prepare(sql).bind(...).first()/all()/run() e batch([...]) (uma transação).
 * As instruções seguem para a função `exec_sql` do Postgres, só chamável com a chave secreta,
 * que aplica os parâmetros como literais escapados e devolve as linhas e o nº de linhas afetadas.
 */
type Row = Record<string, unknown>;
type Spec = { sql: string; params: unknown[] };
type Out = { rows: Row[]; changes: number };
const BUCKET = "umbral-files";
function config() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase não configurado: define SUPABASE_URL e SUPABASE_SECRET_KEY.");
  return { url, key, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}
async function rpc(stmts: Spec[]): Promise<Out[]> {
  const { url, headers } = config();
  const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ stmts }) });
  const data = await r.json().catch(() => null) as any;
  if (!r.ok) throw new Error(data?.message || `Supabase respondeu ${r.status}`);
  return data as Out[];
}
/** `?` e `?N` (estilo D1) passam a `$N` (estilo Postgres). */
const toPg = (sql: string) => { let n = 0; return sql.replace(/\?(\d+)?/g, (_, d) => "$" + (d || ++n)); };
class Stmt {
  constructor(readonly sql: string, readonly params: unknown[] = []) {}
  bind(...params: unknown[]) { return new Stmt(this.sql, params); }
  spec(): Spec { return { sql: toPg(this.sql), params: this.params.map(p => p === undefined ? null : p) }; }
  async first<T = Row>() { const [r] = await rpc([this.spec()]); return (r.rows[0] ?? null) as T | null; }
  async all<T = Row>() { const [r] = await rpc([this.spec()]); return { results: r.rows as T[], meta: { changes: r.changes }, success: true }; }
  async run() { const [r] = await rpc([this.spec()]); return { results: r.rows, meta: { changes: r.changes }, success: true }; }
}
class Db {
  prepare(sql: string) { return new Stmt(sql); }
  async batch(stmts: Stmt[]) { const out = await rpc(stmts.map(s => s.spec())); return out.map(r => ({ results: r.rows, meta: { changes: r.changes }, success: true })); }
}
export function database() { config(); return new Db() as unknown as D1Database; }

/** Ficheiros (contratos e anexos) no Supabase Storage, com a interface mínima que a app usava no R2. */
const objectUrl = (base: string, key: string) => `${base}/storage/v1/object/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
class Files {
  async put(key: string, body: ReadableStream | ArrayBuffer | string, opts?: { httpMetadata?: { contentType?: string } }) {
    const { url, headers } = config();
    const data = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body;
    const r = await fetch(objectUrl(url, key), { method: "POST", headers: { ...headers, "Content-Type": opts?.httpMetadata?.contentType || "application/octet-stream", "x-upsert": "true" }, body: data });
    if (!r.ok) throw new Error(`Falha ao guardar o ficheiro (${r.status}).`);
  }
  async get(key: string) {
    const { url, headers } = config();
    const r = await fetch(objectUrl(url, key), { headers });
    if (!r.ok || !r.body) return null;
    return { body: r.body, size: Number(r.headers.get("content-length") || 0) };
  }
  async delete(key: string) {
    const { url, headers } = config();
    const r = await fetch(objectUrl(url, key), { method: "DELETE", headers });
    if (!r.ok && r.status !== 404 && r.status !== 400) throw new Error(`Falha ao remover o ficheiro (${r.status}).`);
  }
}
export function storage() { config(); return new Files() as unknown as R2Bucket; }
/** Copia um ficheiro dentro do Storage, sem o descarregar. Devolve false se não for possível. */
export async function copyObject(from: string, to: string) {
  const { url, headers } = config();
  const r = await fetch(`${url}/storage/v1/object/copy`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ bucketId: BUCKET, sourceKey: from, destinationKey: to }) });
  return r.ok;
}
