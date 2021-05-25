import { Knex } from 'knex';
import { DbConnection } from '../db';

export async function up(db: DbConnection): Promise<any> {
	await db.schema.alterTable('users', function(table: Knex.CreateTableBuilder) {
		table.integer('email_confirmed').defaultTo(0).notNullable();
		table.integer('must_set_password').defaultTo(0).notNullable();
	});

	await db.schema.createTable('emails', function(table: Knex.CreateTableBuilder) {
		table.increments('id').unique().primary().notNullable();
		table.text('recipient_name', 'mediumtext').defaultTo('').notNullable();
		table.text('recipient_email', 'mediumtext').defaultTo('').notNullable();
		table.string('recipient_id', 32).defaultTo(0).notNullable();
		table.integer('sender_id').notNullable();
		table.string('subject', 128).notNullable();
		table.text('body').notNullable();
		table.bigInteger('sent_time').defaultTo(0).notNullable();
		table.integer('sent_success').defaultTo(0).notNullable();
		table.text('error').defaultTo('').notNullable();
		table.bigInteger('updated_time').notNullable();
		table.bigInteger('created_time').notNullable();
	});

	await db.schema.createTable('tokens', function(table: Knex.CreateTableBuilder) {
		table.increments('id').unique().primary().notNullable();
		table.string('value', 32).notNullable();
		table.string('user_id', 32).defaultTo('').notNullable();
		table.bigInteger('updated_time').notNullable();
		table.bigInteger('created_time').notNullable();
	});

	await db.schema.alterTable('emails', function(table: Knex.CreateTableBuilder) {
		table.index(['sent_time']);
		table.index(['sent_success']);
	});

	await db('users').update({ email_confirmed: 1 });

	await db.schema.alterTable('tokens', function(table: Knex.CreateTableBuilder) {
		table.index(['value', 'user_id']);
	});
}

export async function down(_db: DbConnection): Promise<any> {

}
