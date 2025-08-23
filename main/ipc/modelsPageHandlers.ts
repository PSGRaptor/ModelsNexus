// START OF FILE: main/ipc/modelsPageHandlers.ts

import { ipcMain } from 'electron';

export function registerModelsPageHandlers(db: any) { // <- accept sqlite wrapper or raw db
    ipcMain.handle('models:list', async (_e, payload: { offset: number; limit: number; filters?: any }) => {
        const { offset = 0, limit = 100, filters = {} } = payload || {};

        const where: string[] = [];
        const params: any[] = [];

        if (filters?.has_images === true) where.push('has_images = 1');
        if (filters?.has_metadata === true) where.push('has_metadata = 1');
        if (filters?.model_type) {
            where.push('model_type = ?');
            params.push(filters.model_type);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const rows = await db.all(
            `
      SELECT id, name, file_name, version, model_hash, model_type, file_path,
             main_image_path AS thumbnail_path,
             has_metadata, has_images, is_favorite, base_model
      FROM models
      ${whereClause}
      ORDER BY date_added DESC
      LIMIT ? OFFSET ?
      `,
            [...params, limit, offset]
        );

        return rows;
    });

    ipcMain.handle('models:count', async (_e, payload: { filters?: any }) => {
        const { filters = {} } = payload || {};
        const where: string[] = [];
        const params: any[] = [];

        if (filters?.has_images === true) where.push('has_images = 1');
        if (filters?.has_metadata === true) where.push('has_metadata = 1');
        if (filters?.model_type) {
            where.push('model_type = ?');
            params.push(filters.model_type);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const row = await db.get(`SELECT COUNT(*) as cnt FROM models ${whereClause}`, params);
        return { total: row?.cnt ?? 0 };
    });
}

// END OF FILE: main/ipc/modelsPageHandlers.ts
