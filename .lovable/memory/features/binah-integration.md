Binah.ai special measurement integration with real Web SDK (v2 — hook-based architecture)

## Architecture
- `company_features` table: per-company feature flags with config (monthly_limit)
- `municipality_features` table: per-municipality feature flags
- `special_measurements` table: stores Binah results as jsonb in measurement_data
- `useBinahMonitor.ts` hook: encapsulates full SDK lifecycle (init, face session, start/stop, demo mode)
- `BinahCapture.tsx`: UI component using the hook, with face validity feedback, progress bar, info modals
- Admin toggle per company in AdminCompanies with configurable monthly limit
- HealthTab/WellbeingTab shows "Medição Especial" CTA only when enabled

## SDK Integration
- SDK files in `public/binah-sdk/` (main.js, a.js, a.wasm.gz, a.worker.js, 799.js, legacyVideos.js)
- Version: @biosensesignal/web-sdk v5.11.4-1
- Loaded dynamically via `import("@biosensesignal/web-sdk")` — marked as external in build
- Requires COOP/COEP headers (configured in vite.config.ts)
- Falls back to demo mode if `crossOriginIsolated === false` or SDK fails to load
- Vite plugins: `vite-plugin-wasm` and `vite-plugin-top-level-await`

## API Key
- License Key: 9FE0E4-F8E4ED-48B396-2CF86D-322751-1B04DE (hardcoded as publishable key)

## Vital Signs Available
pulseRate, oxygenSaturation, respirationRate, sdnn, stressLevel, bloodPressure,
hemoglobin, hemoglobinA1c, wellnessLevel, prq, cardiacWorkload

## Key Files
- `src/hooks/useBinahMonitor.ts` — SDK lifecycle hook
- `src/types/binah-sdk.d.ts` — type declarations for compilation without npm package
- `src/components/mayla/BinahCapture.tsx` — capture UI with consent, measuring, results phases
- `src/components/mayla/WellbeingTab.tsx` — shows Binah CTA when company feature enabled
- `DEPLOY.md` — VPS deployment instructions with nginx headers
