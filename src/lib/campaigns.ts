import campaigns from '../data/campaigns.json';
import { getArticles, sortArticles, type Doc, type Kind } from './articles';

export type Campaign = (typeof campaigns)[number];
export const CAMPAIGNS: Campaign[] = campaigns;

/** Art for the Campaigns page banner and the front page tile. */
export const CAMPAIGNS_BANNER = '/images/generated/campaigns.webp';

export const withBase =(src: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + src;

/** The groups of a campaign index, in the order they are shown. */
export const GROUPS = [
	{ key: 'people', label: 'People', kinds: ['people'], featuredLabel: 'Player characters' },
	{ key: 'places', label: 'Places', kinds: ['places'] },
	{ key: 'organizations', label: 'Organizations', kinds: ['organizations'] },
	{ key: 'history', label: 'History', kinds: ['history'] },
	{ key: 'sessions', label: 'Sessions', kinds: ['sessions'] },
	{ key: 'lore', label: 'Items & Lore', kinds: ['items', 'lore', 'species'] },
] as const satisfies readonly { key: string; label: string; kinds: readonly Kind[]; featuredLabel?: string }[];
export type GroupKey = (typeof GROUPS)[number]['key'];

/** Articles whose front matter names the campaign. An id that is not a campaign matches nothing. */
export async function campaignArticles(id: string): Promise<Doc[]> {
	return sortArticles((await getArticles()).filter((e) => e.data.campaigns.includes(id)));
}

export type CampaignGroup = { key: GroupKey; label: string; featuredLabel?: string; featured: Doc[]; rest: Doc[] };

/** A campaign's articles by group: the hand-picked ones in their listed order, then the others.
 * A sealed article shows only its seal label. Empty groups are left out. */
export async function grouped(campaign: Campaign): Promise<CampaignGroup[]> {
	const members = await campaignArticles(campaign.id);
	return GROUPS.map((g) => {
		const inGroup = members.filter((e) => (g.kinds as readonly string[]).includes(e.data.kind ?? e.id.split('/')[0]));
		const picks: string[] = campaign.featured[g.key] ?? [];
		const featured = picks.map((p) => inGroup.find((e) => e.id === p)).filter((e): e is Doc => !!e);
		const rest = inGroup.filter((e) => !featured.includes(e));
		return { key: g.key, label: g.label, featuredLabel: 'featuredLabel' in g ? g.featuredLabel : undefined, featured, rest };
	}).filter((g) => g.featured.length + g.rest.length > 0);
}
