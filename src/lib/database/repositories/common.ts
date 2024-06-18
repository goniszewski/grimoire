export const mapRelationsToWithStatements = <T extends string>(
	relations: T[]
): { [key: string]: boolean | { [key: string]: boolean } } => {
	const nestedRelations: { [key: string]: { [key: string]: boolean } } = {};
	const withStatements: { [key: string]: boolean } = {};
	relations.forEach((relation) => {
		if (relation.includes('.')) {
			const [parent, child] = relation.split('.');
			nestedRelations[parent] = nestedRelations[parent] || {};
			nestedRelations[parent][child] = true;
		} else {
			withStatements[relation] = true;
		}
	});

	return { ...withStatements, ...nestedRelations };
};
