// START OF FILE: main/ipc/modelsPageHandlers.ts

import { ipcMain } from 'electron';

/**
 * Paged, DB-sorted listing for fast startup.
 * - Alphabetical ORDER BY in SQL keeps paging stable (no resorting in JS).
 * - Only returns columns the grid needs to paint quickly.
 * - Accepts 'db' from 'sqlite' (promise API) or any duck-typed DB with .all/.get.
 */
export function registerModelsPageHandlers(db: any) {
    ipcMain.handle('models:list', async (_e, payload: { offset?: number; limit?: number; filters?: any }) => {
        const { offset = 0, limit = 100, filters = {} } = payload || {};

        const where: string[] = [];
        const params: any[] = [];

        if (filters?.has_images === true) where.push('has_images = 1');
        if (filters?.has_metadata === true) where.push('has_metadata = 1');
        if (filters?.model_type) { where.push('model_type = ?'); params.push(filters.model_type); }
        if (filters?.favorite === true) where.push('is_favorite = 1');

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const rows = await db.all(
            `
                SELECT
                    id,
                    model_hash,
                    file_name,
                    model_type,
                    base_model,
                    is_favorite,
                    main_image_path AS thumbnail_path
                FROM models
                         ${whereClause}
                ORDER BY file_name COLLATE NOCASE
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
        if (filters?.model_type) { where.push('model_type = ?'); params.push(filters.model_type); }
        if (filters?.favorite === true) where.push('is_favorite = 1');

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const row = await db.get(`SELECT COUNT(*) as cnt FROM models ${whereClause}`, params);
        return { total: row?.cnt ?? 0 };
    });
}

// END OF FILE: main/ipc/modelsPageHandlers.ts
