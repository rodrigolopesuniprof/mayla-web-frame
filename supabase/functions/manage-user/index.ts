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

    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
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

    const body = await req.json();
    const { action, user_id, updates } = body;

    if (action === "list_emails") {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const emailMap: Record<string, string> = {};
      for (const u of users) {
        emailMap[u.id] = u.email || "";
      }
      return new Response(JSON.stringify({ emails: emailMap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_company_admin") {
      const { email, password, company_id, full_name } = body;
      if (!email || !password || !company_id) {
        return new Response(JSON.stringify({ error: "email, password e company_id são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user with email confirmed
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "", company_id },
      });
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile with company_id (trigger handle_new_user already created it)
      await supabaseAdmin
        .from("profiles")
        .update({ company_id, full_name: full_name || "" })
        .eq("user_id", newUser.user.id);

      // Insert company_admin role
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "company_admin" });
      if (roleErr) {
        return new Response(JSON.stringify({ error: roleErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_email") {
      if (!user_id || !updates?.email) {
        return new Response(JSON.stringify({ error: "user_id e email são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email: updates.email,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-deletion
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode excluir sua própria conta" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete from auth (cascades to profiles and user_roles)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!user_id || !updates) {
        return new Response(JSON.stringify({ error: "user_id e updates são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      const profileUpdates: Record<string, any> = {};
      if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name;
      if (updates.cpf !== undefined) profileUpdates.cpf = updates.cpf;
      if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
      if (updates.company_id !== undefined) profileUpdates.company_id = updates.company_id || null;

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", user_id);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempPassword = `Mayla${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 90 + 10)}`;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: tempPassword,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, temporary_password: tempPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'delete', 'update', 'reset_password' ou 'create_company_admin'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
