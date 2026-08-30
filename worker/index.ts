/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/employee-draft") {
      const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
      if (!env.DB) return json({ error: "D1_NOT_CONFIGURED" }, 503);

      const employeeIdFromUrl = url.searchParams.get("employeeId")?.trim() ?? "";
      if (request.method === "GET") {
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(employeeIdFromUrl)) return json({ error: "INVALID_EMPLOYEE_ID" }, 400);
        const row = await env.DB.prepare("SELECT payload, updated_at FROM valuation_drafts WHERE employee_id = ?")
          .bind(employeeIdFromUrl).first<{ payload: string; updated_at: string }>();
        if (!row) return json({ draft: null });
        try { return json({ draft: JSON.parse(row.payload), updatedAt: row.updated_at }); }
        catch { return json({ error: "INVALID_SAVED_DATA" }, 500); }
      }

      if (request.method === "PUT") {
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > 750_000) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
        let body: { employeeId?: string; payload?: unknown };
        try { body = await request.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
        const employeeId = body.employeeId?.trim() ?? "";
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(employeeId) || !body.payload || typeof body.payload !== "object") return json({ error: "INVALID_REQUEST" }, 400);
        const payload = JSON.stringify(body.payload);
        if (payload.length > 700_000) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
        await env.DB.prepare(`INSERT INTO valuation_drafts (employee_id, payload, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(employee_id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`)
          .bind(employeeId, payload).run();
        return json({ ok: true });
      }

      if (request.method === "DELETE") {
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(employeeIdFromUrl)) return json({ error: "INVALID_EMPLOYEE_ID" }, 400);
        await env.DB.prepare("DELETE FROM valuation_drafts WHERE employee_id = ?").bind(employeeIdFromUrl).run();
        return json({ ok: true });
      }

      return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
