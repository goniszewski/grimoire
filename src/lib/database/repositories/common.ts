import type * as schema from '../schema';
import type { BuildQueryResult, DBQueryConfig, ExtractTablesWithRelations } from 'drizzle-orm';
import type { Exact } from 'type-fest';

type TSchema = ExtractTablesWithRelations<typeof schema>;

type QueryConfig<TableName extends keyof TSchema> = DBQueryConfig<
	'one' | 'many',
	boolean,
	TSchema,
	TSchema[TableName]
>;

export type InferQueryModel<
	TableName extends keyof TSchema,
	QBConfig extends Exact<QueryConfig<TableName>, QBConfig> = {}
> = BuildQueryResult<TSchema, TSchema[TableName], QBConfig>;

export const mapRelationsToWithStatements = <T extends string>(
	relations: T[]
): { [key: string]: boolean | { [key: string]: { [key: string]: boolean } } } => {
	const nestedRelations: {
		[key: string]: {
			with: { [key: string]: boolean };
		};
	} = {};
	const withStatements: { [key: string]: boolean } = {};
	relations.forEach((relation) => {
		if (relation.includes('.')) {
			const [parent, child] = relation.split('.');
			nestedRelations[parent] = nestedRelations[parent] || { with: {} };
			nestedRelations[parent].with[child] = true;
		} else {
			withStatements[relation] = true;
		}
	});

	return { ...withStatements, ...nestedRelations };
};
