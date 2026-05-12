/**
 * LendingPhotoRepository
 *
 * Data access layer for lending photos.
 * Enforces max 4 photos per phase at the repository level.
 */

import { getDatabase } from '../../../db/client';
import { generateUUID } from '../../../utils/uuid';
import {
  LendingPhoto,
  LendingPhotoCreateInput,
  LendingPhotoPhase,
  MAX_PHOTOS_PER_PHASE,
} from '../models/LendingPhoto';

export class LendingPhotoRepository {
  private get db() {
    return getDatabase();
  }

  private rowToPhoto(row: any): LendingPhoto {
    return {
      id: row.id,
      lending_id: row.lending_id,
      phase: row.phase as LendingPhotoPhase,
      photo_uri: row.photo_uri,
      sort_order: row.sort_order,
      created_at: new Date(row.created_at),
    };
  }

  async getByLendingId(lendingId: string, phase?: LendingPhotoPhase): Promise<LendingPhoto[]> {
    if (phase) {
      const rows = await this.db.getAllAsync(
        `SELECT * FROM lending_photos WHERE lending_id = ? AND phase = ? ORDER BY sort_order ASC, created_at ASC`,
        [lendingId, phase]
      );
      return rows.map(this.rowToPhoto);
    }
    const rows = await this.db.getAllAsync(
      `SELECT * FROM lending_photos WHERE lending_id = ? ORDER BY phase ASC, sort_order ASC, created_at ASC`,
      [lendingId]
    );
    return rows.map(this.rowToPhoto);
  }

  async countByPhase(lendingId: string, phase: LendingPhotoPhase): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM lending_photos WHERE lending_id = ? AND phase = ?`,
      [lendingId, phase]
    );
    return row?.count ?? 0;
  }

  async create(input: LendingPhotoCreateInput): Promise<LendingPhoto> {
    const count = await this.countByPhase(input.lending_id, input.phase);
    if (count >= MAX_PHOTOS_PER_PHASE) {
      throw new Error(`MAX_PHOTOS_EXCEEDED`);
    }

    const id = generateUUID();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO lending_photos (id, lending_id, phase, photo_uri, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.lending_id, input.phase, input.photo_uri, count, now]
    );

    const created = await this.db.getFirstAsync<any>(
      `SELECT * FROM lending_photos WHERE id = ?`,
      [id]
    );
    return this.rowToPhoto(created!);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM lending_photos WHERE id = ?`, [id]);
  }

  async deleteByLendingId(lendingId: string, phase?: LendingPhotoPhase): Promise<void> {
    if (phase) {
      await this.db.runAsync(
        `DELETE FROM lending_photos WHERE lending_id = ? AND phase = ?`,
        [lendingId, phase]
      );
    } else {
      await this.db.runAsync(
        `DELETE FROM lending_photos WHERE lending_id = ?`,
        [lendingId]
      );
    }
  }
}
