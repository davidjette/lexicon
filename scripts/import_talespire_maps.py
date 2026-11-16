"""Adds TaleSpire screenshots to the Maps gallery (src/data/maps.json + public/images/maps).

    python scripts/import_talespire_maps.py            # dry run: lists what would be added
    python scripts/import_talespire_maps.py apply

Source: C:/dev/sharn-campaign/images, the DM's TaleSpire builds of Korth and the Ivory Lazaret
(released at the end of the campaign; see sources/dave/2026-11-14-end-of-campaign-release.md).
Each row is (source file, title, description). A file already imported (same `source`) is skipped,
so the script can be run again after adding rows.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path('C:/dev/sharn-campaign/images')
OUT = ROOT / 'public' / 'images' / 'maps'
DATA = ROOT / 'src' / 'data' / 'maps.json'

K = 'Korth'
L = 'The Ivory Lazaret'
NM = 'Nos Matre'
H = 'Heatherhill'

ROWS = [
    # ---- Korth, the Imperial capital
    ('korth talespire 1.png', f'{K} — City Overview', 'The TaleSpire build of Korth, the Imperial capital of Karrnath, looking up the plazas to the Great Palace.'),
    ('korth talespire 7.png', f'{K} — From Above', 'The whole of the Korth build from high above. It is a single raised platform, with an airship at the palace pad on the right.'),
    ('The Great Palace.png', f'{K} — The Great Palace', 'The Great Palace of Korth, seen from the plaza stairs below its doors.'),
    ('upper and lower plaza.png', f'{K} — Upper and Lower Plaza', 'The Upper and Lower Plaza at the centre of Korth, between the Great Palace and the ministries.'),
    ('korth talespire 3.png', f'{K} — The Plaza Steps', 'The stepped plaza of Korth among green domes, with an airship overhead.'),
    ('korth talespire 4.png', f'{K} — The Ministry Blocks', 'Government blocks and towers around the plaza steps in the middle of Korth.'),
    ('korth talespire 5.png', f'{K} — The Winged Statue', 'A glowing winged statue on a green dome, above the rooftops of Korth.'),
    ('korth talespire 8.png', f'{K} — Streets and Yards', 'Streets, yards and stacked cargo on the edge of the Korth build.'),
    ('ministry of law.png', f'{K} — Ministry of Law', 'The Ministry of Law in the north-east of Korth, with its jail and the steam vats beside it.'),
    ('rekkenmark research lab + Hall of Records.png', f'{K} — Rekkenmark Research Lab and Hall of Records', 'The Rekkenmark Research Lab and the Hall of Records, on the north side of Korth.'),
    ('military command center and powerhouse.png', f'{K} — Military Command Center and Powerhouse', 'The Military Command Center and the Powerhouse, on the west side of Korth.'),
    ('residences + eden training facility + barracks.png', f'{K} — Residences, Eden Training Facility and Barracks', "The residences, the Eden Training Facility and the barracks in the south-west of Korth."),
    ('residences and palace airship pad.png', f'{K} — Residences and Palace Airship Pad', 'The residences and the palace airship pad in the south-east of Korth, with an airship docked.'),
    ('hall of submission + intel listening post (disguised as guildhouse).png', f'{K} — Hall of Submission and the Listening Post', 'The Hall of Submission on the east side of Korth. The intelligence listening post beside it is disguised as a guildhouse.'),
    ('intel listening post interior room 1.png', f'{K} — Listening Post, Main Room', 'The main room of the listening post in Korth, with the roof lifted.'),
    ('intel listening post interior room 2.png', f'{K} — Listening Post, Back Room', 'A back room of the listening post in Korth, with the roof lifted.'),

    # ---- the valley of the Ivory Lazaret
    ('map looking north (westhouse + gardens + heatherhill palace).png', f'{L} — Valley Map, Looking North', "The valley of the Ivory Lazaret from the river, looking north: the Westhouse, the Emperor's Gardens and Heatherhill below Nos Matre."),
    ('map looking south (lodge + counting house + stairs + plaza).png', f'{L} — Valley Map, Looking South', 'The valley looking south: the Grand Lodge, the Imperial Counting House, the Stairs of Her Mercy and the plaza.'),
    ('map looking east (serene path and ancient bridges and marsh.png', f'{L} — Valley Map, Looking East', 'The valley looking east: the Serene Path, the ancient bridges and the marsh.'),
    ('map looking west (heatherhill + hunting grounds (off limits) + grand lodge).png', f'{L} — Valley Map, Looking West', 'The valley looking west: Heatherhill, the hunting grounds, which are off limits, and the Grand Lodge.'),
    ('lazaret 1.png', f'{L} — The Hill from the Plaza', 'The hill of the Ivory Lazaret with Nos Matre on its crown, the Stairs of Her Mercy climbing to it from the plaza.'),
    ('lazaret 2.png', f'{L} — Lodge, Counting House and Plaza', 'The Grand Lodge on the river, the Imperial Counting House and the Plaza of the Martyrs, with Nos Matre above them.'),
    ('lazaret 4.png', f'{L} — Heatherhill and the River', 'Heatherhill on the riverbank with its landing, the hill and Nos Matre behind it and the Grand Lodge in the distance.'),
    ('lazaret 5.png', f"{L} — The Emperor's Gardens and the Hill", "The walled Emperor's Gardens between the Westhouse and Heatherhill, with the path climbing to Nos Matre."),
    ('lazaret 6.png', f'{L} — Nos Matre and the Westhouse', 'Nos Matre on the hill and the Westhouse on the bluff below it, with its harbour.'),
    ('quay.png', f'{L} — The Quay', 'The stone quay where the night boat lands, with a coach waiting and ships on the river.'),
    ('imperial counting house + Plaza of the Martyrs + the Stairs of Her Mercy.png', f'{L} — Counting House, Plaza of the Martyrs and the Stairs', 'The Imperial Counting House, the crowded Plaza of the Martyrs and the foot of the Stairs of Her Mercy.'),
    ('stairs of Her Mercy (formerly the Sovereign Steps).png', f'{L} — The Stairs of Her Mercy', 'The Stairs of Her Mercy, formerly the Sovereign Steps, climbing the hill from the plaza toward Nos Matre.'),
    ('imperial counting house (formerly hospital for the weary).png', f'{L} — The Imperial Counting House', 'The Imperial Counting House, which was the Hospital for the Weary until the Emperor took it for offices.'),
    ('counting house east wing.png', f'{L} — Counting House, East Wing', 'The east wing of the Imperial Counting House, with the roof lifted.'),
    ('counting house west wing.png', f'{L} — Counting House, West Wing', 'The west wing of the Imperial Counting House, with the roof lifted.'),

    # ---- the Grand Lodge
    ('grand lodge.png', 'The Grand Lodge', 'The Grand Lodge, the old hunting lodge on the river, with a coach at its door.'),
    ('grand lodge ground floor.png', 'The Grand Lodge — Ground Floor', 'The ground floor of the Grand Lodge around its checkered stair hall.'),
    ('grand lodge studies and stair hall.png', 'The Grand Lodge — Studies and Stair Hall', 'The studies and the stair hall of the Grand Lodge.'),
    ('grand lodge library and roberts rooms.png', "The Grand Lodge — Library and Roberts's Rooms", "The library of the Grand Lodge and the rooms of Joseph Roberts."),
    ('grand lodge top floor.png', 'The Grand Lodge — Top Floor', 'The bedrooms on the top floor of the Grand Lodge.'),

    # ---- Nos Matre
    ('Nos Matre (Cathedral of the Mother).png', f'{NM} — The Cathedral of the Mother', 'Nos Matre, the Cathedral of the Mother, on the crown of the hill, with the Polygon floating in its forecourt.'),
    ('eternal-flame-03 nos matre from the air.png', f'{NM} — From the Air', 'Nos Matre from the air, with the eternal flame on its terrace and the stair down the hill.'),
    ('temple approach + the polygon + tomb of Kaius I.png', f'{NM} — The Approach, the Polygon and the Tomb of Kaius I', 'The approach to Nos Matre: the Polygon over the forecourt and the Tomb of Kaius I on the lawn.'),
    ('tomb of kaius i.png', f'{NM} — The Tomb of Kaius I', 'The Tomb of Kaius I, a gilded sarcophagus on the lawn beside the cathedral.'),
    ('eternal-flame-02 with orrery.png', f'{NM} — The Eternal Flame and the Orrery', 'The eternal flame on the cathedral terrace, with the orrery beside it.'),
    ('eternal-flame-01 close.png', f'{NM} — The Eternal Flame', 'The eternal flame at close range. The shaft beneath it leads down toward the Sept of Bones.'),
    ('temple nave interior.png', f'{NM} — The Nave', 'The nave of Nos Matre, with the roof lifted.'),
    ('temple nave fountain.png', f'{NM} — The Nave Fountain', 'The fountain court of the nave of Nos Matre.'),
    ('temple east transept.png', f'{NM} — East Transept', 'The east transept of Nos Matre from outside. The east wing is the altar.'),
    ('temple east transept interior.png', f'{NM} — East Transept, Interior', 'The interior of the east transept of Nos Matre.'),
    ('temple east transept roof.png', f'{NM} — East Transept, Roofs', 'The green barrel roofs and domes over the east transept of Nos Matre.'),
    ('temple west transept lobby interior.png', f'{NM} — West Transept, Lobby', 'The lobby of the west transept of Nos Matre. The west wing is the hospital.'),
    ('temple west transept lazarette interior.png', f'{NM} — West Transept, the Lazarette', 'The lazarette in the west transept of Nos Matre, with its rows of beds.'),
    ('temple west tower ground floor stairs down.png', f'{NM} — West Tower, Ground Floor', 'The ground floor of the west tower of Nos Matre, with the stairs down.'),
    ('temple west tower top floor.png', f'{NM} — West Tower, Top Floor', 'The top floor of the west tower of Nos Matre.'),
    ('rear steps from temple to garden.png', f'{NM} — Rear Steps to the Garden', "The steps from the back of Nos Matre down the hill to the Emperor's Gardens."),

    # ---- the west wing and the hospital under the hill
    ('hosp-01 trauma ward.jpg', 'The Lazaret Hospital — Trauma Ward', 'The trauma ward in the west wing of Nos Matre, the hospital the pilgrims are allowed to see.'),
    ('hosp-02 tower and ward stair.jpg', 'The Lazaret Hospital — Tower and Ward Stair', "The stair from the trauma ward up to the Director's tower room."),
    ('hosp-04 tower room.jpg', "The Lazaret Hospital — The Director's Tower Room", "The Director's tower room above the trauma ward."),
    ('hosp-05 stair house.jpg', 'The Lazaret Hospital — The Stair House', 'The stair house behind the tower, where a door in the hillside leads down to the hospital under the hill.'),
    ('hosp-06 level one.jpg', 'The Hospital Under the Hill — Level One', 'Level One of the hospital cut into the hill under Nos Matre, which receives the novices and the dying.'),
    ('hosp-07 level one top ward.jpg', 'The Hospital Under the Hill — Level One, Top Ward', 'The top ward on Level One of the hospital under the hill.'),
    ('hosp-08 level two.jpg', 'The Hospital Under the Hill — Level Two', 'Level Two of the hospital under the hill, where the dying are turned into soldiers.'),
    ('hosp-09 level two workrooms.jpg', 'The Hospital Under the Hill — Level Two, Workrooms', 'The workrooms on Level Two of the hospital under the hill.'),
    ('hosp-10 level three.jpg', 'The Hospital Under the Hill — Level Three', "Level Three of the hospital under the hill, which holds the classroom, the slab room and the inspector's office."),
    ('hosp-11 level three classroom.jpg', 'The Hospital Under the Hill — Level Three, Classroom', 'The classroom on Level Three of the hospital under the hill.'),
    ('lazarette dungeon top floor.png', 'The Lazarette Dungeon — Top Floor', 'The top floor of the lazarette dungeon under Nos Matre, in plan, with wards around a central court.'),
    ('lazarette dungeon top floor stariwell added.png', 'The Lazarette Dungeon — Top Floor Stairwell', 'The top floor of the lazarette dungeon from the side, showing the stairwell and the barred cells.'),
    ('lazarette dungeon second floor.png', 'The Lazarette Dungeon — Second Floor', 'The second floor of the lazarette dungeon under Nos Matre, in plan.'),
    ('underghround concourse between lazaret and blackdove HQ.png', 'The Concourse under the Hill', 'The underground concourse that runs south under the hill from the hospital to the Westhouse.'),

    # ---- the Westhouse and the gardens
    ('Kaius Triumphal Arch and the Westhouse (now black dove HQ).png', 'The Westhouse — With the Kaius Triumphal Arch', 'The Kaius Triumphal Arch and the green-domed Westhouse, the headquarters of the Black Doves.'),
    ('westhouse (black dove HQ).png', 'The Westhouse — From the Harbour', 'The Westhouse on its bluff above the small harbour, with a ship at the dock.'),
    ('westhouse ground level.png', 'The Westhouse — Ground Level', 'The ground level of the Westhouse, in plan.'),
    ('westhouse mid level.png', 'The Westhouse — Middle Level', 'The middle level of the Westhouse, in plan.'),
    ('westhouse top level.png', 'The Westhouse — Top Level', 'The top level of the Westhouse, in plan, with its dormitory rows.'),
    ("Emperor's Gardens.png", "The Emperor's Gardens", "The walled formal garden on the level ground between the Westhouse and the Summer Palace."),

    # ---- Heatherhill, the Summer Palace
    ('Heatherhill (Summer Palace).png', f'{H} — The Summer Palace', 'Heatherhill, the Summer Palace: a central block under green barrel roofs with two long wings, red-leafed trees in its forecourts.'),
    ('summer-palace-01 exterior from the bridge.png', f'{H} — From the Bridge', 'The Summer Palace from the garden side, with the stone bridge crossing the water garden to the main door.'),
    ('heatherhill back.png', f'{H} — From Behind', 'The back of the Summer Palace, with the river and the landing beyond it.'),
    ('heatherhill north wing cutaway and courtyard.png', f'{H} — North Wing and Courtyard', 'The north wing of the Summer Palace in cutaway, around its forecourt of red-leafed trees.'),
    ('heatherhill ground level middle.png', f'{H} — Central Block, Ground Level', 'The ground level of the central block of the Summer Palace, in plan.'),
    ('heatherhill top level middle.png', f'{H} — Central Block, Top Level', 'The top level of the central block of the Summer Palace, in plan.'),
    ('summer-palace-02 entrance hall dining and sitting.png', f'{H} — Entrance Hall', 'The entrance hall of the Summer Palace, with its dining and sitting rooms.'),
    ('summer-palace-03 throne hall.png', f'{H} — Throne Hall', 'The throne hall of the Summer Palace.'),
    ('summer-palace-04 corridor and checkered court.png', f'{H} — Corridor and Checkered Court', 'The long corridor of the Summer Palace beside one of the two checkered courts.'),
    ('summer-palace-11 banquet hall and lounge.png', f'{H} — Banquet Hall and Lounge', 'The banquet hall and the lounge of the Summer Palace.'),
    ('summer-palace-12 upper floor bedchamber and gallery.png', f'{H} — Upper Floor, Bedchamber and Gallery', "The bedchamber and the gallery on the upper floor of the Summer Palace."),
    ('summer-palace-05 nursery wing cutaway over the water.png', f'{H} — Nursery Wing over the Water', 'The nursery wing of the Summer Palace in cutaway, built out over the water.'),
    ('summer-palace-06 nursery wing interior.png', f'{H} — Nursery Wing, Interior', 'The interior of the nursery wing of the Summer Palace.'),
    ('summer-palace-09 daughters dormitory.png', f"{H} — The Daughters' Dormitory", "The dormitory of the Empress's daughters in the Summer Palace."),
    ('summer-palace-10 rear gate and checkered court.png', f'{H} — Rear Gate and Checkered Court', 'The rear gate of the Summer Palace and the checkered court before it.'),
    ('summer-palace-13 rear gate stair to the grotto pool.png', f'{H} — The Grotto Stair', 'The stair beyond the rear gate of the Summer Palace, leading to the grotto pool.'),

    # ---- the vampire lair
    ('vampire-lair-02 morgue furnaces lit with ward beside.png', 'The Vampire Lair — The Morgue Furnaces', 'The furnaces of the hospital morgue, with a ward beside them. A door here leads down to the lair.'),
    ('vampire-lair-03 overview dining hall cells and study.png', 'The Vampire Lair — Overview', "The lair of E'noch Qualanthri's brood below the hospital: halls of dark brick over black water, with the dining hall, the cells and the study."),
    ('vampire-lair-04 dining hall through the arch.png', 'The Vampire Lair — The Dining Hall', 'The dining hall of the vampire lair, seen through the arch.'),
    ('vampire-lair-06 blood pool hall overview.png', 'The Vampire Lair — The Blood Pool Hall', 'The hall of the blood pool in the vampire lair, from above.'),
    ('vampire-lair-07 blood pool with dragon.png', 'The Vampire Lair — The Blood Pool', 'The round pool of blood under its wall of rock, with the gold dragon Aurorix lying in it.'),

    # ---- the Sept of Bones
    ('bone-temple-01 eternal flame shaft open.png', 'The Sept of Bones — The Shaft under the Flame', 'The shaft under the eternal flame of Nos Matre, opened, one of the ways down to the Sept of Bones.'),
    ('bone-temple-02 crypt below the flame cutaway.png', "The Sept of Bones — The Council's Crypt, Cutaway", "The Council's crypt below the eternal flame, in cutaway."),
    ('bone-temple-03 crypt nine coffins.png', "The Sept of Bones — The Council's Crypt", "The Council's crypt, with nine coffins in a row and bones spilling down its stair."),
    ('bone-temple-04 view down into the temple.png', 'The Sept of Bones — Looking Down', 'The view down into the Sept of Bones from the crypt.'),
    ('bone-temple-05 the temple lit.png', 'The Sept of Bones', 'The Sept of Bones lit: stairs, altars and dark spires over a floor of piled bones.'),
]


def slug(s):
    s = s.lower().replace('’', '').replace("'", '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def main(apply):
    maps = json.loads(DATA.read_text(encoding='utf-8'))
    have = {m.get('source') for m in maps}
    n = max(m['n'] for m in maps)
    missing = [r[0] for r in ROWS if not (SRC / r[0]).exists()]
    if missing:
        sys.exit(f'missing source files: {missing}')
    added = 0
    for name, title, desc in ROWS:
        if name in have:
            continue
        n += 1
        mid = f'{n}-{slug(title)}'
        added += 1
        if not apply:
            print(mid, '|', title)
            continue
        im = Image.open(SRC / name).convert('RGB')
        if im.width > 1920:
            im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
        im.save(OUT / f'{mid}.webp', 'WEBP', quality=74, method=6)
        th = im.resize((520, round(im.height * 520 / im.width)), Image.LANCZOS)
        th.save(OUT / f'{mid}-thumb.webp', 'WEBP', quality=78, method=6)
        maps.append({
            'id': mid, 'n': n, 'title': title, 'description': desc,
            'src': f'/images/maps/{mid}.webp', 'thumb': f'/images/maps/{mid}-thumb.webp',
            'width': im.width, 'height': im.height, 'kind': 'talespire', 'source': name,
        })
    if apply:
        DATA.write_text(json.dumps(maps, indent=1, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f'{added} maps {"added" if apply else "to add"}; {len(maps)} in the gallery')


if __name__ == '__main__':
    main(len(sys.argv) > 1 and sys.argv[1] == 'apply')
