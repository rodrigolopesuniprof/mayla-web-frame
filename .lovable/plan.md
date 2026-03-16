

# Plan: Consultation Duration + Map Fix + Medical Records Hook

## Issues

1. **Consultation duration**: Currently the availability slot shows `start_time – end_time` (e.g. 08:00 – 12:00), treating the entire block as one consultation. Need to add a `slot_duration_minutes` column to `doctor_availability` so the system can split a time block into individual appointment slots (e.g. 08:00–08:30, 08:30–09:00, etc.).

2. **Map crash**: The `react-leaflet@4.2.1` is installed but the "context consumer" error persists. This is a known React 18 strict-mode incompatibility with how `MapContainer` children are rendered. The fix is to ensure `leaflet` CSS is loaded and wrap map children properly. However, the real fix is to use dynamic import (`React.lazy`) for map components so Leaflet initializes correctly, or to pin `@react-leaflet/core` explicitly.

3. **Medical records (prontuário) integration**: Add a placeholder architecture hook for future API integration with an online medical records system. No full implementation now.

## Changes

### 1. DB Migration: Add `slot_duration_minutes` to `doctor_availability`
```sql
ALTER TABLE public.doctor_availability
ADD COLUMN slot_duration_minutes integer NOT NULL DEFAULT 30;
```

### 2. Update `DoctorAvailabilityEditor.tsx`
- Add a "Duração (min)" input field (select with options: 15, 20, 30, 45, 60 minutes)
- Include `slot_duration_minutes` in the save payload

### 3. Update `PartnerForm.tsx` (inline availability in registration)
- Add the same duration selector to the inline availability editor used during partner registration

### 4. Update `ConsultationFlow.tsx` — Time slot splitting
- In the schedule step, instead of showing `08:00 – 12:00` as a single slot, compute individual time windows based on `slot_duration_minutes`
- Example: if `start_time=08:00`, `end_time=12:00`, `slot_duration_minutes=30` → generate 08:00–08:30, 08:30–09:00, ..., 11:30–12:00
- User selects one specific time window
- The confirmation screen shows the exact window (e.g. "08:00 – 08:30")

### 5. Fix map crash in `HealthPartnersMap.tsx` and `ConsultationFlow.tsx`
- The `react-leaflet` v4 context consumer error with React 18 is caused by the way children are rendered inside `MapContainer`. The fix: wrap all map child components (`TileLayer`, `Marker`, `Popup`, custom components) to ensure they are direct children of `MapContainer` and not conditionally rendered in a way that breaks the context.
- Alternative approach: lazy-load the map components using `React.lazy` + `Suspense` to ensure Leaflet initializes in the correct order.
- Most likely root cause: the `.vite/deps` cache has a stale version. We should also ensure `leaflet` version is explicitly `^1.9.4` (not a v2 prerelease).

### 6. Medical records architecture hook
- Add a commented interface and placeholder in `ConsultationFlow.tsx` for future prontuário integration:
  ```typescript
  /** Future: integrate with electronic medical records API */
  interface MedicalRecord {
    appointment_id: string;
    patient_id: string;
    doctor_id: string;
    diagnosis: string;
    prescription: string;
    notes: string;
    created_at: string;
  }
  ```
- Add a `notes` field to the appointment confirmation (optional, for patient to describe symptoms)
- In the "done" step, mention that the consultation record will be available in the patient's history

## Files to Modify
| File | Changes |
|------|---------|
| DB Migration | Add `slot_duration_minutes` column |
| `src/components/admin/DoctorAvailabilityEditor.tsx` | Add duration selector |
| `src/components/admin/PartnerForm.tsx` | Add duration to inline availability |
| `src/components/mayla/ConsultationFlow.tsx` | Split time blocks into individual slots, add medical record hooks, fix map rendering |
| `src/components/mayla/HealthPartnersMap.tsx` | Fix map rendering (lazy load approach) |
| `package.json` | Pin leaflet version if needed |

