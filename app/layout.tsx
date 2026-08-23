import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "不動産簡易査定書メーカー｜関西不動産販売",
    description: "土地・中古戸建て・マンションに対応した、周辺事例取込と自動計算ができる不動産簡易査定書作成ツールです。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "不動産簡易査定書メーカー",
      description: "REINS事例の取込から査定価格・販売戦略まで、編集してそのままPDF保存。",
      type: "website",
      locale: "ja_JP",
      images: [{ url: new URL("/og.png", base).toString(), width: 1672, height: 941, alt: "不動産査定報告書" }],
    },
    twitter: { card: "summary_large_image", title: "不動産簡易査定書メーカー", description: "土地・戸建て・マンション対応の査定書作成ツール", images: [new URL("/og.png", base).toString()] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
