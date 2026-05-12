/**
 * LendingPhoto Domain Types
 *
 * Represents a before/after photo attached to a lending record.
 * Max 4 photos per phase.
 */

export type LendingPhotoPhase = 'before' | 'after';

export const MAX_PHOTOS_PER_PHASE = 4;

export interface LendingPhoto {
  id: string;
  lending_id: string;
  phase: LendingPhotoPhase;
  photo_uri: string;
  sort_order: number;
  created_at: Date;
}

export interface LendingPhotoCreateInput {
  lending_id: string;
  phase: LendingPhotoPhase;
  photo_uri: string;
}
