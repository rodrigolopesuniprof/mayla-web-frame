Binah.ai special measurement integration with real Web SDK

## Architecture
- `company_features` table: per-company feature flags with config (monthly_limit)
- `special_measurements` table: stores Binah results as jsonb in measurement_data
- `BinahCapture.tsx`: real SDK integration with fallback to simulation mode
- Admin toggle per company in AdminCompanies with configurable monthly limit
- HealthTab/WellbeingTab shows "Medição Especial" CTA only when enabled

## SDK Integration
- SDK files in `public/binah-sdk/` (main.js, a.js, a.wasm.gz, a.worker.js, 799.js, legacyVideos.js)
- Version: @biosensesignal/web-sdk v5.11.4-1
- Loaded dynamically via script tag
- Requires COOP/COEP headers (configured in vite.config.ts)
- Falls back to simulation mode if SDK fails to load

## API Key
- License Key: 9FE0E4-F8E4ED-48B396-2CF86D-322751-1B04DE (hardcoded as publishable key)
- Also stored as BINAH_API_KEY secret

## Vital Signs Available
pulseRate, oxygenSaturation, respirationRate, sdnn, stressLevel, bloodPressure,
hemoglobin, hemoglobinA1c, wellnessLevel, prq, cardiacWorkload, and more
