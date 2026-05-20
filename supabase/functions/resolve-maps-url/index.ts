// Resolves Google Maps short links (maps.app.goo.gl / goo.gl/maps) to their full URL
// and extracts latitude/longitude.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractCoords(url: string): { latitude: number; longitude: number } | null {
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]destination=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

async function followRedirects(url: string, maxHops = 5): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LovableMapsResolver/1.0)",
      },
    });
    const loc = res.headers.get("location");
    if (loc) {
      current = loc.startsWith("http") ? loc : new URL(loc, current).toString();
      continue;
    }
    // Try to extract from HTML body (Google sometimes returns HTML with the long URL)
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const body = await res.text();
      const m = body.match(/https?:\/\/(?:www\.)?google\.[^"'\s<]+\/maps\/[^"'\s<]+/);
      if (m) return m[0];
    }
    return current;
  }
  return current;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already long? just extract.
    let coords = extractCoords(url);
    let resolved = url;
    if (!coords) {
      resolved = await followRedirects(url);
      coords = extractCoords(resolved);
    }

    return new Response(JSON.stringify({ resolved_url: resolved, coordinates: coords }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
