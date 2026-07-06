// Sentinel id used to represent the "Liga Mayla" (global company ranking)
// in the same UI components used for private leagues.
export const MAYLA_LEAGUE_ID = "__mayla__";

export const isMaylaLeague = (id: string) => id === MAYLA_LEAGUE_ID;
