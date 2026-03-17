
-- Clean up: drop the trigger and function since jitsi_room_name is already a generated column
DROP TRIGGER IF EXISTS trg_set_jitsi_room_name ON public.consultations;
DROP FUNCTION IF EXISTS public.set_jitsi_room_name();
