import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './db/schema';

// Disable prefetch as it is not supported for "Transaction" pool mode
export const queryClient = postgres(env.DATABASE_URL || '', { prepare: false });
const rawDb = drizzle(queryClient, { schema });

// Monkey-patch db.execute to be backwards compatible with the old driver
const originalExecute = rawDb.execute.bind(rawDb);
rawDb.execute = async (...args: any[]) => {
	const res = await originalExecute(...args);
	if (Array.isArray(res)) {
		(res as any).rows = res;
	}
	return res;
};

export const db = rawDb;
