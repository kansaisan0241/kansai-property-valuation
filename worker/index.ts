
/** Cloudflare Worker entry point for the vinext-starter template. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ALLOWED_IPS?: string;

  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {

    // ========================================
    // 社内ネットワーク限定アクセス制限
    // ========================================

    const clientIP =
      request.headers.get("CF-Connecting-IP")?.trim() ?? "";

    const allowedIPs = (env.ALLOWED_IPS ?? "")
      .split(/[\s,]+/)
      .map((ip) => ip.trim())
      .filter(Boolean);

    if (!clientIP || !allowedIPs.includes(clientIP)) {
      return new Response(
        `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width, initial-scale=1.0">
<title>アクセス制限</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#f4f6f9;
  font-family:Arial,"Meiryo",sans-serif;
  color:#1f2e55;
}
.card{
  background:#fff;
  border-top:5px solid #1f2e55;
  padding:48px 32px;
  width:90%;
  max-width:520px;
  text-align:center;
  border-radius:10px;
  box-shadow:0 8px 32px #0000000d;
}
.logo{
  font-size:36px;
  font-weight:bold;
  letter-spacing:5px;
}
.line{
  width:40px;
  height:3px;
  background:#b9870e;
  margin:24px auto;
}
h1{font-size:23px}
p{
  font-size:14px;
  color:#666;
  line-height:1.9;
}
footer{
  margin-top:32px;
  font-size:11px;
  color:#999;
}
</style>
</head>
<body>
<div class="card">
  <div class="logo">CASA</div>
  <div class="line"></div>
  <h1>アクセスできません</h1>
  <p>
    本サイトは社内ネットワーク専用です。<br>
    会社のネットワークに接続したうえで、<br>
    再度アクセスしてください。
  </p>
  <footer>
    関西不動産販売株式会社<br>
    ACCESS DENIED / 403
  </footer>
</div>
</body>
</html>`,
        {
          status: 403,
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        }
      );
    }

    // ========================================
    // 既存のサイト処理
    // ========================================

    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [
        ...DEFAULT_DEVICE_SIZES,
        ...DEFAULT_IMAGE_SIZES,
      ];

      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(
              new Request(new URL(path, request.url))
            ),

          transformImage: async (
            body,
            { width, format, quality }
          ) => {
            const result = await env.IMAGES
              .input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });

            return result.response();
          },
        },
        allowedWidths
      );
    }

    const response = await handler.fetch(request, env, ctx);
    const securedResponse = new Response(response.body, response);
    securedResponse.headers.set("Cache-Control", "private, no-store");
    return securedResponse;
  },
};

export default worker;
