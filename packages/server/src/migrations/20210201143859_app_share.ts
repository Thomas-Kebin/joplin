import { Knex } from 'knex';
import { DbConnection } from '../db';

export async function up(db: DbConnection): Promise<any> {
	await db.schema.createTable('share_users', function(table: Knex.CreateTableBuilder) {
		table.string('id', 32).unique().primary().notNullable();
		table.string('share_id', 32).notNullable();
		table.string('user_id', 32).notNullable();
		table.integer('status').defaultTo(0).notNullable();
		table.bigInteger('updated_time').notNullable();
		table.bigInteger('created_time').notNullable();
	});

	await db.schema.alterTable('share_users', function(table: Knex.CreateTableBuilder) {
		table.unique(['share_id', 'user_id']);
	});

	await db.schema.alterTable('files', function(table: Knex.CreateTableBuilder) {
		table.string('source_file_id', 32).defaultTo('').notNullable();
	});

	await db.schema.alterTable('files', function(table: Knex.CreateTableBuilder) {
		table.index(['owner_id']);
		table.index(['source_file_id']);
	});

	await db.schema.alterTable('changes', function(table: Knex.CreateTableBuilder) {
		table.index(['item_id']);
	});

	await db.schema.dropTable('shares');

	await db.schema.createTable('shares', function(table: Knex.CreateTableBuilder) {
		table.string('id', 32).unique().primary().notNullable();
		table.string('owner_id', 32).notNullable();
		table.string('item_id', 32).notNullable();
		table.integer('type').notNullable();
		table.bigInteger('updated_time').notNullable();
		table.bigInteger('created_time').notNullable();
	});
}

export async function down(db: DbConnection): Promise<any> {
	await db.schema.dropTable('share_users');
}
