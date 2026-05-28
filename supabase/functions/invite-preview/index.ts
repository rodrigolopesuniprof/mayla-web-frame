// Edge function: serves per-company social preview HTML for invite links.
// Crawlers (WhatsApp/Facebook/Twitter/etc) see HTML with og:image = company logo.
// Real browsers get 302 redirected to /cadastro/:token on the app.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROD_APP = "https://saude.saudecomvc.com.br";
const PREVIEW_APP = "https://id-preview--df420a59-17a0-4492-8987-13439d49f26d.lovable.app";

const DEFAULT_BANNER = `${SUPABASE_URL}/storage/v1/object/public/app-branding/social-banner.jpg`;
const DEFAULT_TITLE = "Você foi convidado para a Mayla";
const DEFAULT_DESCRIPTION = "Sua empresa oferece um benefício de saúde digital. Cadastre-se em 1 minuto.";

const CRAWLER_RE = /(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|WhatsApp|Pinterest|SkypeUriPreview|redditbot|Applebot|Googlebot|bingbot|vkShare|Embedly|quora link preview|outbrain|nuzzel)/i;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderHtml(opts: { title: string; description: string; image: string; url: string }): string {
  const { title, description, image, url } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const i = escapeHtml(image);
  const u = escapeHtml(url);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${u}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${i}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
<meta http-equiv="refresh" content="0; url=${u}" />
</head>
<body><p>Redirecionando para <a href="${u}">${u}</a>...</p></body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    // path: /invite-preview/:token  or  /functions/v1/invite-preview/:token
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("invite-preview");
    const token = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
    const isPreview = url.searchParams.get("preview") === "1";
    const appBase = isPreview ? PREVIEW_APP : PROD_APP;

    if (!token || token === "invite-preview") {
      return new Response("Missing token", { status: 400 });
    }

    const ua = req.headers.get("user-agent") || "";
    const isCrawler = CRAWLER_RE.test(ua);
    const targetUrl = `${appBase}/cadastro/${token}`;

    // Non-crawler → straight redirect
    if (!isCrawler) {
      return Response.redirect(targetUrl, 302);
    }

    // Crawler → look up company by token and render meta tags
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let companyName: string | null = null;
    let companyLogo: string | null = null;

    const { data: tok } = await supabase
      .from("company_invite_tokens")
      .select("company_id")
      .eq("token", token)
      .maybeSingle();

    if (tok?.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name, logo_url")
        .eq("id", tok.company_id)
        .maybeSingle();
      if (company) {
        companyName = company.name ?? null;
        companyLogo = company.logo_url ?? null;
      }
    }

    const title = companyName
      ? `${companyName} te convidou para a Mayla`
      : DEFAULT_TITLE;
    const description = companyName
      ? `${companyName} oferece um benefício de saúde digital. Cadastre-se em 1 minuto.`
      : DEFAULT_DESCRIPTION;
    const image = companyLogo || DEFAULT_BANNER;

    const html = renderHtml({ title, description, image, url: targetUrl });
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("invite-preview error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
