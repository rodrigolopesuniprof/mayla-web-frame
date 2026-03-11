Appointment scheduling system with multiple specialists, locations, and automated reminders.

## DB Schema Changes
- `appointment_slots`: added `health_unit_id` (FK health_units) and `professional_name` (text)
- `appointment_reminders` table: tracks sent reminders per appointment (1_day, 3_days)
- Trigger `trg_notify_appointment_confirmed`: auto-creates personal notification when appointment status → confirmed
- Cron job `appointment-reminders-daily`: runs at 8am, calls edge function to send 1-day and 3-day reminders

## Booking Model
- "Reserva de presença no dia" — user books a day, not specific time
- Calendar-based UI in AppointmentBooking.tsx shows days with available slots
- UBS warning: inscription needs confirmation from health unit
- User gets notified: on confirmation, 3 days before, 1 day before

## Admin (AdminSpecialties.tsx)
- Slot creation includes: health unit dropdown, professional name field
- Batch generation: date range + weekday selector to generate multiple slots at once
