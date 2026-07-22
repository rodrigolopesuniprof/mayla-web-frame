import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfileTool from "./tools/get_my_profile";
import listMyAppointmentsTool from "./tools/list_my_appointments";
import getMyHealthSummaryTool from "./tools/get_my_health_summary";

// Direct Supabase host — not the Lovable Cloud proxy — is required for OAuth issuer.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mayla-mcp",
  title: "Mayla — Bem-estar Corporativo",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in Mayla user. Read the user's profile, upcoming appointments, and latest health scores/vitals. All data is descriptive and scoped to the authenticated user — never diagnostic.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfileTool, listMyAppointmentsTool, getMyHealthSummaryTool],
});
