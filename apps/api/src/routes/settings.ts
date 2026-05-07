import { updateUserSettingsSchema } from '@gp/shared';
import type { FastifyPluginAsync } from 'fastify';
import { getUserSettings, updateUserSettings } from '../services/user-settings.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/settings', async () => getUserSettings(DEFAULT_USER_ID));

  app.patch('/settings', async (request) => {
    const patch = updateUserSettingsSchema.parse(request.body);
    return updateUserSettings(DEFAULT_USER_ID, patch);
  });
};
