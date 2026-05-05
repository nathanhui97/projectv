import type { GameState } from '@project-v/schemas';

export function checkWinCondition(
  state: GameState,
): { winner: 0 | 1; reason: string } | null {
  if (state.winner_index !== undefined) {
    return { winner: state.winner_index as 0 | 1, reason: state.end_reason ?? 'unknown' };
  }
  return null;
}

// Called by action handlers when they detect a loss condition.
// Returns state with winner set. Caller should return this immediately.
export function setWinner(
  state: GameState,
  winner: 0 | 1,
  reason: string,
): GameState {
  return {
    ...state,
    winner_index: winner,
    end_reason: reason,
    ended_at: new Date().toISOString(),
  };
}
