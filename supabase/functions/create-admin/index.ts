import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Delete existing user if any
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === "contato@saudecomvc.com.br");
  if (existing) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", existing.id);
    await supabaseAdmin.auth.admin.deleteUser(existing.id);
  }

  // Create user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: "contato@saudecomvc.com.br",
    password: "Adm@123",
    email_confirm: true,
    user_metadata: { full_name: "Administrador" },
  });

  if (userError) {
    return new Response(JSON.stringify({ error: userError.message }), { status: 400 });
  }

  // Assign admin role
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userData.user.id, role: "admin" });

  return new Response(
    JSON.stringify({ success: true, user_id: userData.user.id, role_error: roleError?.message }),
    { headers: { "Content-Type": "application/json" } }
  );
});
