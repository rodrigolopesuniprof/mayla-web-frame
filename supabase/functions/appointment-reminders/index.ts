import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const in1Day = new Date(now);
    in1Day.setDate(in1Day.getDate() + 1);
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    // Find confirmed appointments for 1 day and 3 days from now
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, user_id, specialty, appointment_date, municipality_id")
      .eq("status", "confirmed")
      .gte("appointment_date", formatDate(in1Day) + "T00:00:00")
      .lte("appointment_date", formatDate(in3Days) + "T23:59:59");

    if (error) throw error;

    let sentCount = 0;

    for (const apt of appointments || []) {
      const aptDate = new Date(apt.appointment_date);
      const daysUntil = Math.round((aptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let reminderType: string | null = null;
      if (daysUntil <= 1) reminderType = "1_day";
      else if (daysUntil <= 3) reminderType = "3_days";

      if (!reminderType) continue;

      // Check if reminder already sent
      const { data: existing } = await supabase
        .from("appointment_reminders")
        .select("id")
        .eq("appointment_id", apt.id)
        .eq("reminder_type", reminderType)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const aptDateStr = new Date(apt.appointment_date).toLocaleDateString("pt-BR");
      const title = reminderType === "1_day"
        ? "Consulta amanhã! 📋"
        : "Consulta em 3 dias 📅";
      const body = reminderType === "1_day"
        ? `Lembrete: sua consulta de ${apt.specialty} é amanhã, ${aptDateStr}. Não se esqueça!`
        : `Sua consulta de ${apt.specialty} está marcada para ${aptDateStr}. Prepare-se!`;

      // Create notification
      const { error: notifError } = await supabase.from("notifications").insert({
        title,
        body,
        emoji: reminderType === "1_day" ? "⏰" : "📅",
        scope: "personal",
        target_user_id: apt.user_id,
        municipality_id: apt.municipality_id,
        created_by: apt.user_id,
        color: "204 67% 32%",
      });

      if (!notifError) {
        // Record reminder as sent
        await supabase.from("appointment_reminders").insert({
          appointment_id: apt.id,
          reminder_type: reminderType,
        });
        sentCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, reminders_sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
