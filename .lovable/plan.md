

# Plan: Map-first Doctor Selection with Expandable Cards

## Problem
1. Map only shows for `presencial` mode — should always show when doctors have coordinates
2. Doctor cards don't show ratings or inline availability
3. Clicking a doctor navigates to a separate "schedule" step instead of expanding inline

## Changes

### `src/components/mayla/ConsultationFlow.tsx`

**A. Show map for ALL consultation modes** (line 527)
- Remove the `consultMode === "presencial"` gate
- Show the map whenever `userPos` is available and there are doctors with coordinates

**B. Redesign doctor cards with expandable inline slots**
- Replace the current card (which navigates to schedule step on click) with an expandable card:
  - **Collapsed**: name, ⭐ rating (placeholder "Novo"), specialty, distance, price
  - **Expanded on click**: fetches and shows available time slots grouped by weekday, each slot clickable to go directly to confirm step
- Use a new state `expandedDoctorId` to track which card is open
- Clicking a time slot calls `handleSelectTime` and skips the separate "schedule" step

**C. Rating placeholder**
- Show `⭐ Novo` badge on each card (the `avg_rating` field already exists on the interface but has no data yet)

**D. Eager availability display**
- Availability is already fetched in step 3 (`availability` state). Use it to compute inline time windows per doctor when their card is expanded.
- Group slots by weekday, split into time windows using existing `splitIntoWindows`, show next 2-3 available days.

### Card layout (expanded)
```text
┌──────────────────────────────────┐
│ 🩺 Dr. Rodrigo Lopes    ⭐ Novo │
│ Endocrinologia  📏 2.3km  R$250 │
│                                  │
│ Segunda (24/mar):                │
│  [08:00] [08:30] [09:00] [09:30] │
│ Quarta (26/mar):                 │
│  [14:00] [14:30] [15:00]         │
└──────────────────────────────────┘
```

### Files to modify
| File | What |
|------|------|
| `src/components/mayla/ConsultationFlow.tsx` | Remove presencial gate for map, add expandable cards with inline slots, add rating placeholder, wire slot selection to skip schedule step |

No database changes needed.

