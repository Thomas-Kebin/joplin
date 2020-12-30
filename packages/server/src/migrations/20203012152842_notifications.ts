import * as Knex from 'knex';
import { DbConnection } from '../db';

export async function up(db: DbConnection): Promise<any> {
	await db.schema.createTable('notifications', function(table: Knex.CreateTableBuilder) {
		table.string('id', 32).unique().primary().notNullable();
		table.string('owner_id', 32).notNullable();
		table.integer('level').notNullable();
		table.text('key', 'string').notNullable();
		table.text('message', 'mediumtext').notNullable();
		table.integer('read').defaultTo(0).notNullable();
		table.integer('canBeDismissed').defaultTo(1).notNullable();
		table.bigInteger('updated_time').notNullable();
		table.bigInteger('created_time').notNullable();
	});

	await db.schema.alterTable('notifications', function(table: Knex.CreateTableBuilder) {
		table.unique(['owner_id', 'key']);
	});
}

export async function down(db: DbConnection): Promise<any> {
	await db.schema.dropTable('notifications');
}
