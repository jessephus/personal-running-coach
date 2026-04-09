import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type DatabaseSchema = typeof schema.dbSchema;
export type DatabaseClient = PostgresJsDatabase<DatabaseSchema>;
type PostgresClient = ReturnType<typeof postgres>;
type PostgresOptions = NonNullable<Parameters<typeof postgres>[1]>;

export type DatabaseConnection = {
  client: PostgresClient;
  db: DatabaseClient;
  close: () => Promise<void>;
};

export type DatabaseConnectionOptions = {
  connectionString?: string;
  postgresOptions?: PostgresOptions;
};

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a Postgres connection.");
  }

  return connectionString;
}

export function createDatabaseConnection(options: DatabaseConnectionOptions = {}): DatabaseConnection {
  const connectionString = options.connectionString ?? getDatabaseUrl();
  const client = postgres(connectionString, {
    prepare: false,
    ...options.postgresOptions,
  });
  const db = drizzle(client, { schema: schema.dbSchema });

  return {
    client,
    db,
    close: async () => {
      await client.end();
    },
  };
}
