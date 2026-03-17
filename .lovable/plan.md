

# Plan: Fix Online Consultation Flow + Professional Dashboard

## Problem Analysis

There are **two disconnected flows** for online consultations:

1. **HomeTab "Consulta Online" button** → opens `TelemedicineScreen` which is a legacy placeholder (shows "Em breve" or loads an external iframe). It does NOT connect to the Jitsi system.
2. **ServicosTab → "Realizar Consulta" → Online** → goes through `ConsultationFlow` which creates a consultation record and shows a "done" screen, but never opens the video call directly — only saves the record.
3. **"Atendimento Agora" (on-demand)** → works via `OnDemandFlow` but requires professionals to be online in `professional_online_status`, which has no management interface.

There is **no professional-side panel** at all — professionals register via `/cadastro-parceiro` but have no dashboard to see waiting patients or manage their online status.

## Plan

### 1. Fix Patient-Side: "Consulta Online" from HomeTab

**Change**: When user clicks "Consulta Online" from HomeTab dialog, redirect to `ConsultationFlow` (in ServicosTab) with `consultMode=online` pre-selected, instead of opening the legacy `TelemedicineScreen`.

- Update `HomeTab.tsx`: replace `onOpenTelemedicine()` with navigation to ServicosTab's consultation flow in online mode
- Update `MaylaApp.tsx` to support a `startConsultationOnline` callback that sets ServicosTab active with online mode pre-selected

### 2. Fix Scheduled Online Consultation: Show Waiting Screen After Booking

**Change**: After booking an online consultation in `ConsultationFlow`, instead of just showing "done", show a **waiting screen** with:
- Professional name and specialty
- "O profissional será notificado e entrará na sala em breve"
- Countdown to scheduled time
- "Entrar na videochamada" button (active when join window opens)
- Real-time status subscription on the consultation record

Update `ConsultationFlow.tsx`:
- Add a new step `"waiting_room"` after confirm for online consultations
- Show consultation details + waiting animation
- Subscribe to consultation status changes via realtime
- When status becomes `in_progress`, auto-transition to `video_call` step

### 3. Create Professional Dashboard Page

**New route**: `/painel-profissional` — a dedicated panel for doctors/nurses.

**New component**: `ProfessionalDashboard.tsx` with:

- **Login**: Professionals log in with their email (same auth system)
- **Online Status Toggle**: Set `online_now` and `accepts_on_demand` in `professional_online_status`
- **Waiting Patients Queue**: Real-time list of consultations with `status = waiting/confirmed` for this professional
  - Show patient name, specialty, wait time, triage notes
  - "Atender" button → opens `JitsiConsultationScreen` for the professional side
- **Consultation History**: List of past consultations with status, duration, type (online/presencial, scheduled/on_demand)
- **Profile Summary**: Name, specialty, CRM

**Database changes needed**:
- Link partners to auth users: add `user_id` column to `partners` table (nullable UUID referencing auth.users)
- RLS policy: professionals can SELECT/UPDATE their own consultations (where `professional_id` matches their partner record)
- RLS policy: professionals can manage their own `professional_online_status`

### 4. Professional Notification for Waiting Patients

- When a consultation is created with `status = confirmed`, the professional dashboard shows it in real-time via Supabase realtime subscription on `consultations` table (already enabled)
- Visual + audio indicator for new waiting patients
- Professional clicks "Atender" → consultation status updates to `in_progress` → patient sees update via their realtime subscription

### 5. Database Migration

```sql
-- Add user_id to partners for professional login
ALTER TABLE public.partners ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- RLS: professionals can view consultations assigned to them
CREATE POLICY "Professionals can view assigned consultations"
ON public.consultations FOR SELECT TO authenticated
USING (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));

-- RLS: professionals can update assigned consultations
CREATE POLICY "Professionals can update assigned consultations"  
ON public.consultations FOR UPDATE TO authenticated
USING (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));

-- RLS: professionals can manage own online status
CREATE POLICY "Professionals can manage own status"
ON public.professional_online_status FOR ALL TO authenticated
USING (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
))
WITH CHECK (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));
```

### 6. Files to Create/Modify

| File | Action |
|---|---|
| `src/pages/ProfessionalDashboard.tsx` | **Create** — Full professional panel |
| `src/components/professional/WaitingQueue.tsx` | **Create** — Real-time waiting patients list |
| `src/components/professional/ConsultationHistory.tsx` | **Create** — Past consultations table |
| `src/components/professional/OnlineStatusToggle.tsx` | **Create** — Toggle online/on-demand status |
| `src/App.tsx` | **Edit** — Add `/painel-profissional` route |
| `src/components/mayla/ConsultationFlow.tsx` | **Edit** — Add waiting room step for online |
| `src/components/mayla/HomeTab.tsx` | **Edit** — Fix "Consulta Online" to use ConsultationFlow |
| `src/components/mayla/MaylaApp.tsx` | **Edit** — Support online consultation navigation |
| Migration SQL | **Create** — `partners.user_id` + RLS policies |

