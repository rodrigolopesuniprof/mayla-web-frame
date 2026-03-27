# Consultations & Jitsi Video Architecture
Updated: 2026-03-27

## Tables
- `consultations`: user_id, professional_id (FK partners), professional_type (doctor|nurse), specialty, consultation_mode, consultation_flow_type (scheduled|on_demand), status (pending|confirmed|waiting|in_progress|completed|cancelled|no_show), scheduled_at, started_at, ended_at, jitsi_room_name (GENERATED: 'mayla-consulta-' || id), join_window_starts_at, call_duration_seconds, queue_position, triage_notes, municipality_id, company_id, **room_token** (uuid, auto-generated, unique per consultation)
- `professional_online_status`: professional_id (FK partners, unique), online_now, accepts_on_demand, always_available, max_parallel_waiting, estimated_response_minutes, last_seen_at

## Jitsi Server
- **Private domain**: `teleconsulta.saudecomvc.com.br` (self-hosted Jitsi)
- **Room name format**: `mayla-{room_token}` where room_token is a UUID auto-generated per consultation
- Old format `mayla-consulta-{id}` used as fallback if room_token is missing
- JWT authentication: **Phase 2** (not yet implemented) — requires `JITSI_APP_SECRET` in Prosody + edge function

## Security
- Room tokens are UUIDs — unpredictable and single-use per consultation
- Private Jitsi server prevents use of public infrastructure
- Future: JWT auth will restrict room access to authenticated participants only

## Status Flow
- On-demand: patient requests → consultation created with status `waiting` → professional sees in queue → professional clicks "Atender" → status `in_progress` → patient auto-enters Jitsi via realtime subscription
- Scheduled: patient books → consultation created with status `confirmed` → patient enters WaitingRoom → professional clicks "Iniciar" → status `in_progress` → patient auto-enters Jitsi
- End: either side leaves → status `completed`, ended_at + call_duration_seconds recorded

## Patient Flow
- ConsultationFlow: specialty → mode → doctor → schedule → confirm → WaitingRoom (realtime) → JitsiConsultationScreen
- OnDemandFlow: choose type → search professional → create consultation (status=waiting) → WaitingRoom (realtime) → JitsiConsultationScreen
- WaitingRoom subscribes to postgres_changes on consultations table, auto-transitions on status change

## Professional Dashboard
- Route: `/painel-profissional`, login: `/login-profissional`
- WaitingQueue: realtime subscription, "Atender" sets status=in_progress + started_at → opens JitsiConsultationScreen (passes roomToken)
- TodayConsultations: daily view with accept button for pending (passes roomToken)
- ConsultationHistory: search + duration tracking

## RLS
- Users: own consultations (SELECT, INSERT, UPDATE)
- Professionals: assigned consultations (SELECT, UPDATE) via partners.user_id
- Admins: full access
