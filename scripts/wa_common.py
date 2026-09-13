"""Shared constants for the World Anvil import scripts."""

# The campaign folder, which holds the DM-only files the leak check compares against.
CAMPAIGN_DIR = r'C:\dev\sharn-campaign'
# The frozen World Anvil working folder (read-only import source).
WA_DIR = r'C:\dev\sharn-campaign\worldanvil'

# World Anvil `type` -> site kind (content folder). Near-duplicate WA types collapse here.
# `article` is WA's catch-all and is mixed (campaign hubs, species, decrees); it lands in lore for now.
KIND_OF_TYPE = {
    'person': 'people',
    'organization': 'organizations',
    'ethnicity': 'organizations',
    'species': 'species',
    'creature': 'species',
    'settlement': 'places',
    'landmark': 'places',
    'building / landmark': 'places',
    'building': 'places',
    'geography': 'places',
    'geographic location': 'places',
    'event': 'history',
    'conflict': 'history',
    'plot': 'history',
    'report': 'sessions',
    'item': 'items',
    'technology': 'items',
    'vehicle': 'items',
    'material': 'items',
    'document': 'items',
    'concept': 'lore',
    'myth': 'lore',
    'ritual': 'lore',
    'condition': 'lore',
    'article': 'lore',
}

KIND_LABELS = {
    'people': 'People',
    'organizations': 'Organizations',
    'places': 'Places',
    'items': 'Items',
    'history': 'History',
    'sessions': 'Sessions',
    'species': 'Species & Creatures',
    'lore': 'Lore',
}

KNOWN_TAGS = {'p', 'b', 'i', 'url', 'h2', 'h3', 'ul', 'ol', 'li', 'quote', 'small',
              'table', 'tr', 'td', 'th', 'hr'}
