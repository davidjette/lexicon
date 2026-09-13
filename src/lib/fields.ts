// Infobox rows from the World Anvil template fields. Only short, known values are shown; long
// prose fields (history, defenses, architecture...) belong in the article body, not the sidebar box.
const LABELS: [string, string][] = [
	['ggmtitle', 'Titles'],
	['alternativename', 'Also called'],
	['type', 'Type'],
	['species', 'Species'],
	['gender', 'Gender'],
	['age', 'Age'],
	['dobDisplay', 'Born'],
	['birthplace', 'Birthplace'],
	['residence', 'Residence'],
	['status', 'Status'],
	['currentstatus', 'Status'],
	['rpgAlignment', 'Alignment'],
	['children', 'Children'],
	['height', 'Height'],
	['weight', 'Weight'],
	['eyes', 'Eyes'],
	['hair', 'Hair'],
	['skin', 'Skin'],
	['leader', 'Leader'],
	['ruler', 'Ruler'],
	['government', 'Government'],
	['headquarters', 'Headquarters'],
	['seat', 'Seat'],
	['deity', 'Deity'],
	['founding', 'Founded'],
	['founded', 'Founded'],
	['population', 'Population'],
	['demonym', 'Demonym'],
	['location', 'Location'],
	['parentLocation', 'Part of'],
	['owner', 'Owner'],
	['purpose', 'Purpose'],
	['rarity', 'Rarity'],
	['itemType', 'Item type'],
	['creator', 'Creator'],
	['owningOrganization', 'Held by'],
	['campaign', 'Campaign'],
	['era', 'Era'],
	['region', 'Region'],
	['date', 'Date'],
	['outcome', 'Outcome'],
	['allies', 'Allies'],
	['enemies', 'Enemies'],
];
const MAX = 140;

export function infoboxRows(fields: Record<string, string> = {}, hide: (text: string) => boolean = () => false): [string, string][] {
	const rows: [string, string][] = [];
	const seen = new Set<string>();
	for (const [key, label] of LABELS) {
		const value = (fields[key] ?? '').trim();
		if (!value || /^unknown\.?$/i.test(value) || value.length > MAX || seen.has(label) || hide(value)) continue;
		seen.add(label);
		rows.push([label, value]);
	}
	return rows;
}
