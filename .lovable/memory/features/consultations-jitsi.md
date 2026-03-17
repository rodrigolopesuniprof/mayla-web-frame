# Consultations & Jitsi Video Architecture
Updated: 2026-03-17

## Tables
- `consultations`: user_id, professional_id (FK partners), professional_type (doctor|nurse), specialty, consultation_mode, consultation_flow_type (scheduled|on_demand), status (pending|confirmed|waiting|in_progress|completed|cancelled|no_show), scheduled_at, started_at, ended_at, jitsi_room_name (GENERATED: 'mayla-consulta-' || id), join_window_starts_at, call_duration_seconds, queue_position, triage_notes, municipality_id, company_id
- `professional_online_status`: professional_id (FK partners, unique), online_now, accepts_on_demand, always_available, max_parallel_waiting, estimated_response_minutes, last_seen_at

## Jitsi Room
- **Generated column**: `jitsi_room_name = 'mayla-consulta-' || id` — auto-populated on insert
- Embed via `https://meet.jit.si/{jitsi_room_name}` in iframe
- Both patient and professional use JitsiConsultationScreen with same consultation.id

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
- WaitingQueue: realtime subscription, "Atender" sets status=in_progress + started_at → opens JitsiConsultationScreen
- TodayConsultations: daily view with accept button for pending
- ConsultationHistory: search + duration tracking

## RLS
- Users: own consultations (SELECT, INSERT, UPDATE)
- Professionals: assigned consultations (SELECT, UPDATE) via partners.user_id
- Admins: full access
