import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user: caller },
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { users, municipality_id } = await req.json();

    if (!Array.isArray(users) || !municipality_id) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos. Envie { users: [{name, email, cpf}], municipality_id }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const u of users) {
      const email = (u.email || "").trim().toLowerCase();
      const name = (u.name || "").trim();
      const cpf = (u.cpf || "").trim();

      if (!email) {
        results.push({ email: "", success: false, error: "E-mail vazio" });
        continue;
      }

      // Create user with temporary password
      const tempPassword = `Mayla${Math.random().toString(36).slice(2, 8)}!`;
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: name },
        });

      if (userError) {
        // If user already exists, try to find and link
        if (userError.message.includes("already been registered")) {
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existing = existingUsers?.users?.find(
            (eu) => eu.email === email
          );
          if (existing) {
            await supabaseAdmin
              .from("profiles")
              .update({ municipality_id, cpf: cpf || undefined })
              .eq("user_id", existing.id);
            results.push({ email, success: true, error: "Usuário já existia, vinculado ao município" });
          } else {
            results.push({ email, success: false, error: userError.message });
          }
        } else {
          results.push({ email, success: false, error: userError.message });
        }
        continue;
      }

      // Update profile with municipality and CPF
      await supabaseAdmin
        .from("profiles")
        .update({
          municipality_id,
          cpf: cpf || undefined,
          full_name: name || undefined,
        })
        .eq("user_id", userData.user.id);

      // Assign user role
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userData.user.id, role: "user" }, { onConflict: "user_id,role" });

      results.push({ email, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ success: true, total: results.length, created: successCount, failed: failCount, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
