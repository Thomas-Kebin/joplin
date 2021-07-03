import { Knex } from 'knex';
import { DbConnection } from '../db';

export async function up(db: DbConnection): Promise<any> {
	await db.schema.alterTable('users', function(table: Knex.CreateTableBuilder) {
		table.bigInteger('total_item_size').defaultTo(0).notNullable();
	});
}

export async function down(_db: DbConnection): Promise<any> {

}
