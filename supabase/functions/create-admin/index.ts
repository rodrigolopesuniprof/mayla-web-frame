import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find existing user
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === "contato@saudecomvc.com.br");
  
  if (existing) {
    // Update password and confirm email
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: "Adm@123",
      email_confirm: true,
    });
    
    // Ensure admin role exists
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({ success: true, user_id: existing.id, updated: true, error: updateError?.message }),
      { headers: { "Content-Type": "application/json" } }
    );
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

  await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userData.user.id, role: "admin" });

  return new Response(
    JSON.stringify({ success: true, user_id: userData.user.id, created: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
