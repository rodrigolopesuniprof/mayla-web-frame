import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RPPG_BACKEND = "https://rppg.saudecomvc.com.br";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    // ACTION: measure - full flow: start session, stream frames via WS, get result
    if (action === "measure") {
      const { frames, fps, duration } = body;

      if (!frames?.length) {
        return jsonResponse({ error: "frames array is required" }, 400);
      }

      // 1. Start session with consent
      const startRes = await fetch(`${RPPG_BACKEND}/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          fps: fps || 8,
          duration: duration || 25,
        }),
      });

      if (!startRes.ok) {
        const errText = await startRes.text();
        console.error("Session start failed:", startRes.status, errText);
        return jsonResponse(
          { error: `Backend start failed: ${startRes.status}`, details: errText },
          502
        );
      }

      const startData = await startRes.json();
      const sessionId = startData.session_id;
      const maxChunkSize = startData.max_chunk_size || 5;

      if (!sessionId) {
        return jsonResponse({ error: "No session_id from backend", details: startData }, 502);
      }

      // Limit frames to 150 max
      const limitedFrames = frames.length > 150 ? frames.slice(0, 150) : frames;
      const payloadSizeKB = Math.round(JSON.stringify(limitedFrames).length / 1024);
      console.log(`rPPG session started: ${sessionId}, frames: ${limitedFrames.length}, maxChunk: ${maxChunkSize}, payloadKB: ${payloadSizeKB}`);

      // 2. Wait 2000ms for backend to register session
      await new Promise(r => setTimeout(r, 2000));

      // 3. Health-check: verify session exists before opening WS
      try {
        const statusRes = await fetch(`${RPPG_BACKEND}/sessions/${sessionId}/status`);
        console.log("Session status check:", statusRes.status);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          console.log("Session status:", JSON.stringify(statusData));
        } else {
          console.warn("Session status check returned:", statusRes.status);
        }
      } catch (e) {
        console.warn("Session status endpoint not available, proceeding anyway");
      }

      const wsUrl = `${RPPG_BACKEND.replace("https://", "wss://").replace("http://", "ws://")}/ws/sessions/${sessionId}`;
      const MAX_WS_RETRIES = 2;

      const connectAndMeasure = (attempt: number): Promise<Record<string, unknown>> =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("WebSocket timeout (60s)")),
            60000
          );

          try {
            const ws = new WebSocket(wsUrl);
            let chunkSeq = 0;
            let frameCursor = 0;
            const totalFrames = limitedFrames.length;

            const sendNextChunk = () => {
              if (frameCursor >= totalFrames) {
                ws.send(JSON.stringify({ type: "end" }));
                return;
              }
              const end = Math.min(frameCursor + maxChunkSize, totalFrames);
              const chunkFrames = limitedFrames.slice(frameCursor, end);
              ws.send(
                JSON.stringify({
                  chunk_seq: chunkSeq,
                  n: chunkFrames.length,
                  frames: chunkFrames,
                })
              );
              frameCursor = end;
              chunkSeq++;
            };

            ws.onopen = () => {
              console.log(`WS connected (attempt ${attempt + 1}), sending first chunk`);
              sendNextChunk();
            };

            ws.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                console.log("WS msg type:", msg.type || "unknown");

                if (msg.type === "ack" || msg.type === "progress") {
                  sendNextChunk();
                } else if (msg.type === "result" || msg.bpm !== undefined) {
                  clearTimeout(timeout);
                  ws.close();
                  resolve(msg);
                } else if (msg.type === "error") {
                  clearTimeout(timeout);
                  ws.close();
                  const errMsg = msg.message || msg.error || "Backend WS error";
                  // Retry on session_not_found
                  if (
                    attempt < MAX_WS_RETRIES &&
                    errMsg.includes("session_not_found")
                  ) {
                    console.warn(`session_not_found on attempt ${attempt + 1}, retrying in 1.5s...`);
                    setTimeout(() => {
                      connectAndMeasure(attempt + 1).then(resolve).catch(reject);
                    }, 1500);
                  } else {
                    reject(new Error(errMsg));
                  }
                }
              } catch (e) {
                console.error("WS message parse error:", e);
              }
            };

            ws.onerror = (err) => {
              clearTimeout(timeout);
              if (attempt < MAX_WS_RETRIES) {
                console.warn(`WS error on attempt ${attempt + 1}, retrying in 1.5s...`);
                setTimeout(() => {
                  connectAndMeasure(attempt + 1).then(resolve).catch(reject);
                }, 1500);
              } else {
                reject(new Error("WebSocket error: " + String(err)));
              }
            };

            ws.onclose = (event) => {
              if (event.code === 4404) {
                clearTimeout(timeout);
                if (attempt < MAX_WS_RETRIES) {
                  console.warn(`WS 4404 on attempt ${attempt + 1}, retrying in 1.5s...`);
                  setTimeout(() => {
                    connectAndMeasure(attempt + 1).then(resolve).catch(reject);
                  }, 1500);
                } else {
                  reject(new Error("Session not found or expired"));
                }
              } else if (!event.wasClean) {
                clearTimeout(timeout);
                reject(new Error(`WebSocket closed: code=${event.code} reason=${event.reason}`));
              }
            };
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });

      const measurement = await connectAndMeasure(0);

      console.log("rPPG result received:", JSON.stringify(measurement).slice(0, 200));

      // 3. Map result fields
      const heartRate = Math.round(
        Number(measurement.bpm || measurement.heart_rate || measurement.hr || 0)
      );
      const respiratoryRate = Math.round(
        Number(measurement.rr_bpm || measurement.respiratory_rate || measurement.rr || 0)
      );
      const stressLevel = Math.round(
        Number(measurement.stress_level || measurement.stress || measurement.ans_index || 0)
      );
      const spo2Raw = Number(measurement.spo2 || measurement.oxygen || 0);
      const spo2 = spo2Raw > 0 ? spo2Raw : null;

      // 4. Save to health_measurements
      if (heartRate > 0) {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        await serviceClient.from("health_measurements").insert({
          user_id: userId,
          measurement_type: "rppg",
          heart_rate: heartRate,
          respiratory_rate: respiratoryRate > 0 ? respiratoryRate : null,
          stress_level: stressLevel > 0 ? stressLevel : null,
          spo2,
          source: "rppg_native",
          notes: `Sessão ${sessionId}`,
        });

        // Award points via centralized engine (respects admin rules + caps)
        try {
          await serviceClient.rpc("award_event", {
            _user_id: userId,
            _event_key: "rppg_measurement",
            _description: "Medição rPPG concluída",
          });
        } catch (e) {
          console.warn("award_event failed:", e);
        }

        // Trigger health score calculation
        try {
          const scoreRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/calculate-health-scores`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ user_id: userId, days: 7 }),
            }
          );
          console.log("Health score calculation:", scoreRes.status);
        } catch (e) {
          console.warn("Failed to calculate health scores:", e);
        }

        // Complete rPPG daily mission
        const { data: pendingMissions } = await serviceClient
          .from("user_missions")
          .select("id, mission_id")
          .eq("user_id", userId)
          .eq("status", "pending");

        if (pendingMissions) {
          for (const m of pendingMissions) {
            const { data: mission } = await serviceClient
              .from("missions")
              .select("title, frequency")
              .eq("id", m.mission_id)
              .single();

            if (
              mission?.frequency === "daily" &&
              mission?.title?.toLowerCase().includes("rppg")
            ) {
              await serviceClient
                .from("user_missions")
                .update({
                  status: "completed",
                  completed_at: new Date().toISOString(),
                })
                .eq("id", m.id);
              break;
            }
          }
        }
      }

      const finalMeasurement = {
        heart_rate: heartRate,
        respiratory_rate: respiratoryRate > 0 ? respiratoryRate : null,
        stress_level: stressLevel > 0 ? stressLevel : null,
        spo2,
      };

      return jsonResponse({ success: true, measurement: finalMeasurement });
    }

    return jsonResponse(
      { error: "Invalid action. Use 'measure'" },
      400
    );
  } catch (error) {
    console.error("rppg-proxy error:", error);
    return jsonResponse(
      {
        error: "Internal error",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
