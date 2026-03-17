# Consultations & Jitsi Video Architecture
Updated: 2026-03-17

## Tables
- `consultations`: user_id, professional_id (FK partners), professional_type (doctor|nurse), specialty, consultation_mode, consultation_flow_type (scheduled|on_demand), status (pending|confirmed|waiting|in_progress|completed|cancelled|no_show), scheduled_at, started_at, ended_at, jitsi_room_name (generated: mayla-consulta-{id}), join_window_starts_at, call_duration_seconds, queue_position, triage_notes, municipality_id, company_id
- `professional_online_status`: professional_id (FK partners, unique), online_now, accepts_on_demand, max_parallel_waiting, estimated_response_minutes, last_seen_at

## Enums
- consultation_flow_type: scheduled, on_demand
- consultation_professional_type: doctor, nurse
- consultation_status: pending, confirmed, waiting, in_progress, completed, cancelled, no_show

## Realtime
- consultations table added to supabase_realtime publication

## Jitsi Room
- Auto-generated column: `mayla-consulta-{consultation_id}`
- Embed via `https://meet.jit.si/{jitsi_room_name}` in iframe

## RLS
- Users: own consultations (SELECT, INSERT, UPDATE)
- Admins: full access
- Online status: authenticated SELECT, admin full access
