import { Kysely, Migration, Migrator } from "kysely";
import { getDb } from ".";

const migrations: Record<string, Migration> = {
  "001": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("auth_state")
        .addColumn("key", "text", (col) => col.primaryKey())
        .addColumn("value", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("auth_session")
        .addColumn("key", "text", (col) => col.primaryKey())
        .addColumn("value", "text", (col) => col.notNull())
        .execute();
    },
    async down(db: Kysely<unknown>) {
      await db.schema.dropTable("auth_session").execute();
      await db.schema.dropTable("auth_state").execute();
    },
  },
  "002": {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable("user_location")
        .addColumn("did", "text", (col) => col.primaryKey())
        .addColumn("latitude", "real", (col) => col.notNull())
        .addColumn("longitude", "real", (col) => col.notNull())
        .addColumn("accuracy_meters", "real", (col) => col.notNull())
        .addColumn("updated_at", "integer", (col) => col.notNull())
        .execute();

      await db.schema
        .createIndex("user_location_updated_at_idx")
        .on("user_location")
        .column("updated_at")
        .execute();
    },
    async down(db: Kysely<unknown>) {
      await db.schema.dropIndex("user_location_updated_at_idx").execute();
      await db.schema.dropTable("user_location").execute();
    },
  },
};

export function getMigrator() {
  const db = getDb();
  return new Migrator({
    db,
    provider: {
      getMigrations: async () => migrations,
    },
  });
}
