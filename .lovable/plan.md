

# Partner Registration Fixes & Enhancements

## Issues Identified

1. **Comma bug in services/payments**: The `split(",")` on every keystroke destroys the comma as it's typed. Need to use a raw text state and only parse on blur/submit.
2. **Specialty field**: Replace free-text input with a searchable dropdown of Brazilian medical specialties + "Outro" option.
3. **RLS error on insert**: The `anon` INSERT policy requires `approval_status='pending' AND active=false`. The registration page uses `supabase` client with anon key but the payload spreads the full form data which includes `opening_hours`, `services_offered`, `accepted_payments` as objects/arrays. The real issue is likely that the user is **authenticated** (not anon), so the authenticated role has no INSERT policy. Need to add an authenticated INSERT policy for self-registration, or ensure the insert works for both roles.
4. **Doctor availability missing from registration**: Add an inline availability editor to the doctor registration form.
5. **Clinic doctor management**: Add ability for clinics to list their doctors with details and availability, plus a pricing model toggle (fixed price vs per-doctor).
6. **Pharmacy virtual store**: Add a `virtual_store_url` field and embed it via iframe in the app.
7. **Laboratory**: Keep simple — just listing with address (already mostly done).

## Plan

### 1. Fix comma-separated fields (PartnerForm.tsx)
- Change services_offered, accepted_payments, specialties_offered, wellness_activities, exam_types, collection_methods fields to use raw text state
- Only split into array on form submit, not on every keystroke
- This fixes the "can't type comma" bug

### 2. Specialty dropdown (PartnerForm.tsx)
- Create a `MEDICAL_SPECIALTIES` constant with ~50 main Brazilian specialties (Clínico Geral, Cardiologia, Dermatologia, Ginecologia, Ortopedia, Pediatria, Psiquiatria, etc.)
- Replace the `<Input>` for specialty with a `<Select>` + an "Outro" option
- When "Outro" is selected, show a text input for custom specialty
- Reuse same list for clinic `specialties_offered` (multi-select checkboxes)

### 3. Fix RLS for self-registration
- Add an **authenticated** INSERT policy on `partners` table allowing inserts where `approval_status='pending' AND active=false`
- This covers both anon and authenticated users doing self-registration

### 4. Doctor availability in registration (PartnerForm.tsx)
- Add an inline availability section to the doctor form (simplified version of DoctorAvailabilityEditor)
- Store availability data locally in form state as an array
- On submit, after the partner is inserted, insert availability rows
- Update `PartnerRegistration.tsx` to handle the two-step insert (partner → availability)

### 5. Clinic doctor management
- Add a `clinic_doctors` section to the clinic form for self-registration
- Each doctor entry: name, CRM, specialty (dropdown), consultation_price, availability slots
- Add a pricing model toggle: "Valor único para todos" vs "Valor por médico"
- On submission, create `partners` (type=doctor) linked via `partner_doctor_links`
- For admin, show linked doctors in the clinic edit view

### 6. Pharmacy virtual store
- Add `virtual_store_url` column to partners table (DB migration)
- Add URL field in pharmacy section of PartnerForm
- In the user-facing PartnerDetail, if pharmacy has `virtual_store_url`, show a "Loja Virtual" button that opens an iframe overlay

### 7. Laboratory — no changes needed
- Already has address and map support via the existing partner structure

## Files to Modify
| File | Changes |
|------|---------|
| `src/components/admin/PartnerForm.tsx` | Fix comma fields, add specialty dropdown, add availability section, clinic doctors section, pharmacy URL field |
| `src/pages/PartnerRegistration.tsx` | Handle two-step insert (partner + availability + linked doctors) |
| `src/components/mayla/PartnerDetail.tsx` | Add pharmacy iframe embed |
| DB Migration | Add authenticated INSERT policy on partners; add `virtual_store_url` column |

## Medical Specialties List (sample)
Clínico Geral, Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Geriatria, Ginecologia e Obstetrícia, Hematologia, Infectologia, Mastologia, Medicina do Trabalho, Nefrologia, Neurologia, Nutrição, Oftalmologia, Oncologia, Ortopedia, Otorrinolaringologia, Pediatria, Pneumologia, Proctologia, Psiquiatria, Reumatologia, Urologia, Cirurgia Geral, Cirurgia Plástica, Anestesiologia, Medicina Esportiva, Medicina de Família, Fisiatria, Angiologia, Alergologia, Homeopatia, Acupuntura, Outro

