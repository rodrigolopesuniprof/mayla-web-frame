

# Healthcare Marketplace ("Uber Médico") - Foundation Plan

## Overview
Build the data layer and admin management for a multi-type partner marketplace (doctors, clinics, gyms, labs, pharmacies). Replace the current placeholder `AdminSpecialties` with a full CRUD admin panel. Add external self-registration routes. No user-facing map or booking redesign.

## 1. Database Migration

### Table: `partners` (unified base entity)
All partner types share one table with a `partner_type` enum.

```sql
CREATE TYPE partner_type AS ENUM ('doctor','clinic','gym','laboratory','pharmacy');
CREATE TYPE approval_status AS ENUM ('pending','approved','blocked');

CREATE TABLE partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_type partner_type NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  description text,
  city text,
  state text DEFAULT 'ES',
  full_address text,
  zip_code text,
  latitude numeric,
  longitude numeric,
  active boolean DEFAULT false,
  approval_status approval_status DEFAULT 'pending',
  logo_url text,
  opening_hours jsonb DEFAULT '{}',
  services_offered jsonb DEFAULT '[]',
  accepted_payments jsonb DEFAULT '[]',
  contact_link text,
  -- Doctor-specific (null for non-doctors)
  crm text,
  crm_state text,
  specialty text,
  sub_specialty text,
  consultation_type text, -- online/presencial/both
  consultation_price numeric,
  notification_email text,
  online_consultation_enabled boolean DEFAULT false,
  -- Clinic
  specialties_offered jsonb,
  booking_link text,
  service_mode text,
  -- Gym
  wellness_activities jsonb,
  is_partner_gym boolean DEFAULT false,
  -- Laboratory
  exam_types jsonb,
  collection_methods jsonb,
  appointment_only boolean DEFAULT false,
  scheduling_link text,
  -- Pharmacy
  delivery_available boolean DEFAULT false,
  service_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Table: `partner_locations` (multiple locations per partner)
```sql
CREATE TABLE partner_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  location_name text,
  full_address text,
  city text,
  state text,
  zip_code text,
  latitude numeric,
  longitude numeric,
  is_main boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### Table: `doctor_availability` (weekly schedule slots)
```sql
CREATE TABLE doctor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  weekday integer NOT NULL, -- 0=Sun..6=Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  consultation_mode text DEFAULT 'both',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Table: `partner_doctor_links` (doctor ↔ clinic links)
```sql
CREATE TABLE partner_doctor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  clinic_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(doctor_id, clinic_id)
);
```

### RLS Policies
- Admin full access on all 4 tables
- Authenticated SELECT on approved+active partners
- Anon INSERT on `partners` (for self-registration, with `approval_status='pending'`)
- Trigger: `update_updated_at_column` on partners

### Storage
- Create `partner-logos` public bucket

## 2. Admin Panel Changes

### Replace `AdminSpecialties` tab with `AdminPartners`
Rename the "Especialistas" tab to "Parceiros" and create a new `AdminPartners.tsx` component with:

- **Sub-tabs**: Médicos | Clínicas | Academias | Laboratórios | Farmácias
- **List view** per type: table with name, city, status badges (approval + active), actions
- **Create/Edit modal**: reusable form that shows common fields + type-specific fields
- **Approve/Block buttons**: quick-action buttons in the list
- **CSV Import button** per type: modal with file upload, basic field validation, bulk insert

### Update `Admin.tsx`
- Change tab id from `especialistas` to `parceiros`
- Update label to "🏥 Parceiros"
- Import `AdminPartners` instead of `AdminSpecialties`

## 3. Reusable Components

### `PartnerForm.tsx`
Single form component that adapts fields based on `partner_type`:
- Common section (name, email, phone, address, description, opening hours, payments)
- Doctor section (CRM, specialty, consultation type/price, online toggle)
- Clinic section (specialties offered, booking link, service mode)
- Gym section (activities, partner flag)
- Lab section (exam types, collection methods, appointment only, scheduling link)
- Pharmacy section (delivery, service notes)

### `PartnerLocationsEditor.tsx`
Inline editor for managing multiple locations per partner (add/remove rows with address + coordinates).

### `DoctorAvailabilityEditor.tsx`
Weekly schedule grid editor (weekday × time range × mode).

### `PartnerCsvImport.tsx`
CSV upload with preview table, validation errors, and bulk insert.

## 4. External Self-Registration

### New page: `/cadastro-parceiro`
- Route added to `App.tsx` (public, no auth required)
- Partner type selector → type-specific registration form (reuses `PartnerForm`)
- Submits with `approval_status='pending'`, `active=false`
- Success screen: "Cadastro recebido! Aguarde aprovação."

## 5. Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/components/admin/AdminPartners.tsx` |
| Create | `src/components/admin/PartnerForm.tsx` |
| Create | `src/components/admin/PartnerLocationsEditor.tsx` |
| Create | `src/components/admin/DoctorAvailabilityEditor.tsx` |
| Create | `src/components/admin/PartnerCsvImport.tsx` |
| Create | `src/pages/PartnerRegistration.tsx` |
| Modify | `src/pages/Admin.tsx` (swap tab) |
| Modify | `src/App.tsx` (add `/cadastro-parceiro` route) |
| Delete | `src/components/admin/AdminSpecialties.tsx` (replaced) |
| Migration | 4 tables + enums + RLS + storage bucket |

## 6. Scope Boundaries (Not Included)
- No user-facing map or search
- No booking/payment flow
- No Jitsi integration
- No changes to existing wellbeing/mission flows

