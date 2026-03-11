import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "contato@saudecomvc.com.br";
  const password = "Adm@123";

  // Try to create first
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Administrador" },
  });

  if (createError && createError.message.includes("already been registered")) {
    // User exists - find by email and update password
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const user = listData?.users?.find(u => u.email === email);
    
    if (!user) {
      return new Response(JSON.stringify({ error: "User exists but could not be found" }), { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({ success: true, user_id: user.id, updated: true, update_error: updateError?.message }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
  }

  await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userData.user.id, role: "admin" });

  return new Response(
    JSON.stringify({ success: true, user_id: userData.user.id, created: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
