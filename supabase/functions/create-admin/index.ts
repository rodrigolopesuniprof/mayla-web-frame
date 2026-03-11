import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Create user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: "contato@saudecomvc.com.br",
    password: "adm123",
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

  // Link to Boa Esperança municipality
  await supabaseAdmin
    .from("profiles")
    .update({ municipality_id: "b9347a47-5c3f-4ff7-b023-9f78451edbc3" })
    .eq("user_id", userData.user.id);

  return new Response(
    JSON.stringify({ success: true, user_id: userData.user.id, role_error: roleError?.message }),
    { headers: { "Content-Type": "application/json" } }
  );
});
