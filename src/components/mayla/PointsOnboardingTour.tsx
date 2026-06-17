// Onboarding popup tour permanently disabled.
// Kept as a no-op to preserve imports of POINTS_TOUR_EVENT / POINTS_TOUR_COMPLETED_EVENT
// from legacy code without rendering any modal or reopening logic.

export const POINTS_TOUR_EVENT = "open-points-tour";
export const POINTS_TOUR_COMPLETED_EVENT = "points-tour-completed";

export function PointsOnboardingTour(_props: any) {
  return null;
}
