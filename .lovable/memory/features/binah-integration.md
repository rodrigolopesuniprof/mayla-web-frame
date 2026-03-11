Binah.ai special measurement integration: feature flags, monthly limits, and capture component

## Architecture
- `municipality_features` table: per-municipality feature flags with config (monthly_limit)
- `special_measurements` table: stores Binah results as jsonb in measurement_data
- `BinahCapture.tsx`: placeholder component ready for Binah Web SDK (uploaded SDKs were React Native, incompatible)
- Admin toggle per municipality in AdminMunicipalities with configurable monthly limit
- HealthTab shows "Medição Especial" CTA only when enabled, with X/Y counter

## API Key
- Stored as BINAH_API_KEY secret
- Value: 9FE0E4-F8E4ED-48B396-2CF86D-322751-1B04DE

## SDK Status
- React Native SDK uploaded but NOT usable in web project
- Need Binah Web SDK for actual integration
- BinahCapture.tsx has simulated flow as placeholder
