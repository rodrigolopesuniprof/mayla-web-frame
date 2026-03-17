# Consultations & Jitsi Video Architecture
Updated: 2026-03-17

## Tables
- `consultations`: user_id, professional_id (FK partners), professional_type (doctor|nurse), specialty, consultation_mode, consultation_flow_type (scheduled|on_demand), status (pending|confirmed|waiting|in_progress|completed|cancelled|no_show), scheduled_at, started_at, ended_at, jitsi_room_name (generated: mayla-consulta-{id}), join_window_starts_at, call_duration_seconds, queue_position, triage_notes, municipality_id, company_id
- `professional_online_status`: professional_id (FK partners, unique), online_now, accepts_on_demand, max_parallel_waiting, estimated_response_minutes, last_seen_at
- `partners.user_id`: links partners to auth.users for professional login

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
- Professionals: consultations assigned to them (SELECT, UPDATE) via partners.user_id
- Professionals: own online status (SELECT, INSERT, UPDATE) via partners.user_id
- Admins: full access
- Online status: authenticated SELECT, admin full access

## Patient Flow
- HomeTab "Consulta Online" → redirects to ConsultationFlow (ServicosTab) with `initialMode="online"`
- After scheduling online consultation → WaitingRoom component with realtime status subscription
- WaitingRoom auto-transitions to JitsiConsultationScreen when professional joins (status=in_progress)
- On-demand flow: OnDemandFlow matches online professional → creates consultation → JitsiConsultationScreen

## Professional Dashboard
- Route: `/painel-profissional`
- Requires partner with user_id linked + active + approved
- Online status toggle (online_now, accepts_on_demand)
- Realtime waiting queue with "Atender" button
- Consultation history with duration, mode, flow type
- JitsiConsultationScreen overlay for active calls
