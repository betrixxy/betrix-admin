/** Stüdyonun oyuncu seçim anahtarı: "<API-Football oyuncu kimliği>:<takım kimliği>" — saf. */
export const playerKey = (playerId: number, teamId: number) => `${playerId}:${teamId}`;

export function parsePlayerKey(key: string): { playerId: number; teamId: number } | null {
  const match = /^(\d+):(\d+)$/.exec(key);
  return match ? { playerId: Number(match[1]), teamId: Number(match[2]) } : null;
}
