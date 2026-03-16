import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointment_id } = await req.json();
    if (!appointment_id) {
      return new Response(JSON.stringify({ error: "appointment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch appointment details
    const { data: appointment, error: apptErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .single();

    if (apptErr || !appointment) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch patient profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, cpf")
      .eq("user_id", appointment.user_id)
      .single();

    // Fetch patient email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(appointment.user_id);
    const patientEmail = authUser?.user?.email || "não informado";

    // Find the partner (doctor or clinic) to get notification_email
    const doctorName = appointment.doctor_name || "";
    const { data: partners } = await supabase
      .from("partners")
      .select("id, name, notification_email, email, partner_type")
      .or(`name.eq.${doctorName}`)
      .limit(5);

    // Try to find the matching partner
    const partner = partners?.find((p) => p.name === doctorName) || partners?.[0];
    const recipientEmail = partner?.notification_email || partner?.email;

    if (!recipientEmail) {
      console.log("No notification email found for partner:", doctorName);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format appointment date
    const apptDate = new Date(appointment.appointment_date);
    const formattedDate = apptDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const formattedTime = apptDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const patientName = profile?.full_name || "Paciente";
    const patientPhone = profile?.phone || "não informado";

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f5f0;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="color: #2a6496; font-size: 20px; margin-bottom: 4px;">📋 Nova Consulta Agendada</h1>
    <p style="color: #888; font-size: 13px; margin-top: 0;">Plataforma Mayla Saúde</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
    
    <table style="width: 100%; font-size: 14px; color: #333;">
      <tr>
        <td style="padding: 8px 0; color: #888; width: 140px;">Especialidade</td>
        <td style="padding: 8px 0; font-weight: 600;">${appointment.specialty}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888;">Paciente</td>
        <td style="padding: 8px 0; font-weight: 600;">${patientName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888;">Email do Paciente</td>
        <td style="padding: 8px 0;">${patientEmail}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888;">Telefone</td>
        <td style="padding: 8px 0;">${patientPhone}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888;">Data</td>
        <td style="padding: 8px 0; font-weight: 600;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888;">Horário</td>
        <td style="padding: 8px 0; font-weight: 600;">${formattedTime}</td>
      </tr>
      ${appointment.notes ? `
      <tr>
        <td style="padding: 8px 0; color: #888; vertical-align: top;">Sintomas</td>
        <td style="padding: 8px 0; font-style: italic; color: #555;">${appointment.notes}</td>
      </tr>` : ""}
    </table>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
    
    <p style="font-size: 12px; color: #aaa; text-align: center;">
      Este é um email automático da plataforma Mayla Saúde.<br>
      O paciente aguarda a confirmação da consulta.
    </p>
  </div>
</body>
</html>`;

    // Try sending via email queue if available, otherwise log
    try {
      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: recipientEmail,
          subject: `Nova Consulta: ${appointment.specialty} — ${patientName} em ${formattedDate}`,
          html: emailHtml,
          message_id: `appointment-${appointment_id}`,
          template_name: "appointment_notification",
        },
      });
      console.log("Email enqueued for:", recipientEmail);
    } catch (queueErr) {
      // Queue might not be set up — log for manual follow-up
      console.log("Email queue not available, logging notification:", recipientEmail);
      await supabase.from("email_send_log").insert({
        recipient_email: recipientEmail,
        template_name: "appointment_notification",
        status: "pending",
        message_id: `appointment-${appointment_id}`,
        metadata: {
          specialty: appointment.specialty,
          patient_name: patientName,
          appointment_date: appointment.appointment_date,
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, recipient: recipientEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-appointment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
