import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://gp_user:gp_password@localhost:5432/gestionpatrimonial';

export const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export { schema };
