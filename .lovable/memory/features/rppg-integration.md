rPPG native integration: camera capture component, edge function proxy, health measurements timeline

## Architecture
- `RppgCapture.tsx`: Native camera capture via getUserMedia (6fps, 320x240, 20s, JPEG 0.4), sends frames to edge function
- `rppg-proxy` edge function: Proxies to rppg.saudecomvc.com.br via WebSocket, saves results to health_measurements
- `HealthTab.tsx`: Displays real data from health_measurements table + BPM trend chart + timeline history
- No iframe, no second login needed - uses Supabase JWT from the logged-in user

## API Flow (single "measure" action)
1. POST rppg-proxy {action:"measure", frames[], fps, duration}
2. Edge function calls /sessions/start with {consent:true, fps, duration}
3. Waits 500ms, then opens WS to /ws/sessions/{id}
4. Streams frames in chunks {chunk_seq, n, frames[]}, waits for ack between chunks
5. Sends {type:"end"} when done, receives {type:"result"} with measurements
6. Saves to health_measurements and completes daily rPPG mission
7. Frames limited to max 150, payload ~1.2MB

## Backend Fields Mapping
- bpm/heart_rate/hr → heart_rate
- rr_bpm/respiratory_rate/rr → respiratory_rate  
- stress/stress_level/ans_index → stress_level
- spo2/oxygen → spo2

## Known Issues Fixed
- Camera black screen: video ref was null during stream assignment (fixed: always render video element)
- session_not_found: too many frames + no delay before WS connect (fixed: 500ms delay, reduced to 120 frames)
