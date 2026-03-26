/**
 * seed-db.ts — Create and seed the map SQLite database.
 *
 * All map data lives here as SQL. The DB (data/map.db) is the single
 * source of truth. Foreign keys enforce referential integrity.
 *
 * Run: bun scripts/seed-db.ts
 */

import { Database } from "bun:sqlite";

const DB_PATH = "data/map.db";

try { require("fs").unlinkSync(DB_PATH); } catch {}

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE huts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    lon         REAL NOT NULL,
    lat         REAL NOT NULL,
    beds        INTEGER NOT NULL,
    elevation   INTEGER,
    open        TEXT,
    label       TEXT NOT NULL,
    info        TEXT NOT NULL,
    source      TEXT
  );

  CREATE TABLE trails (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    distance    TEXT,
    duration    TEXT,
    info        TEXT NOT NULL,
    geojson     TEXT
  );

  CREATE TABLE attractions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    lon         REAL,
    lat         REAL,
    info        TEXT NOT NULL
  );

  CREATE TABLE hut_trails (
    hut_id      TEXT NOT NULL REFERENCES huts(id),
    trail_id    TEXT NOT NULL REFERENCES trails(id),
    PRIMARY KEY (hut_id, trail_id)
  );

  CREATE TABLE hut_attractions (
    hut_id      TEXT NOT NULL REFERENCES huts(id),
    attraction_id TEXT NOT NULL REFERENCES attractions(id),
    PRIMARY KEY (hut_id, attraction_id)
  );

  -- Trails
  INSERT INTO trails VALUES ('laugavegur',        'Laugavegurinn',      '54 km',   '2–4 dagar', 'Frægasta gönguleið Íslands, frá Landmannalaugum til Þórsmerkur yfir litríkt hálendi.', 'data/laugavegur.geojson');
  INSERT INTO trails VALUES ('fimmvorduhals',     'Fimmvörðuháls',      '25 km',   '1 dagur',   'Yfir skarðið milli Eyjafjallajökuls og Mýrdalsjökuls, frá Skógum til Þórsmerkur.', NULL);
  INSERT INTO trails VALUES ('tindfjallahringur', 'Tindfjallahringur',  '~25 km',  '2 dagar',   'Hringur um Tindfjöll í Þórsmörk.', NULL);
  INSERT INTO trails VALUES ('kjolur-interior',   'Kjalvegur',          '~55 km',  '3–5 dagar', 'Forn leið yfir hálendið milli Gullfoss og Hveravalla, meðfram Langjökli og Hofsjökli.', NULL);
  INSERT INTO trails VALUES ('langjokull-interior','Langjökulsleiðir',   NULL,      NULL,        'Hálendisleiðir nálægt Langjökli, milli Hagavatns og Hlöðuvalla.', NULL);
  INSERT INTO trails VALUES ('sprengisandur',     'Sprengisandsleið',   '~200 km', 'Akstur 1 dagur, ganga margir dagar', 'Leið yfir Sprengisand, óbyggðasta hálendi Íslands, milli norðurs og suðurs.', NULL);
  INSERT INTO trails VALUES ('hornstrandir',      'Hornstrandir',        NULL,      NULL,        'Gönguleiðir á Hornströndum, ósnortnu náttúruverndarsvæði á Vestfjörðum.', NULL);

  -- Attractions
  INSERT INTO attractions VALUES ('hot-springs-lml',  'Heitar laugar Landmannalauga', -19.0580, 63.9940, 'Náttúrulegar heitar laugar við jaðar Laugahrauns, frægasta sundlaug hálendisins.');
  INSERT INTO attractions VALUES ('rhyolite-mountains','Litríkar líparitfjöll',        NULL,     NULL,    'Líparitfjöll í Fjallabaki, þekkt fyrir regnbogaliti sína.');
  INSERT INTO attractions VALUES ('fridland-fjallabaki','Friðland að Fjallabaki',      NULL,     NULL,    'Náttúruverndarsvæði í kringum Landmannalaugar, fjölbreyttar gönguleiðir.');
  INSERT INTO attractions VALUES ('obsidian',          'Hrafntinnuhraunssvæðið',       NULL,     NULL,    'Svartur hrafntinna (obsidían) í hrauninu við Hrafntinnusker.');
  INSERT INTO attractions VALUES ('ice-caves',         'Íshellar',                     NULL,     NULL,    'Íshellar í nágrenni Hrafntinnuskers, myndaðir af jarðhita og jöklum.');
  INSERT INTO attractions VALUES ('alftaskard',        'Álftaskarð',                   -19.2100, 63.8650, 'Skarð nálægt Álftavatni, stutt ganga frá skálanum.');
  INSERT INTO attractions VALUES ('markarfljotsgljufur','Markarfljótsgljúfur',         -19.3500, 63.7700, 'Stórfenglegt og djúpt gil Markarfljóts, stutt ganga frá Emstrum.');
  INSERT INTO attractions VALUES ('valahnukur',        'Valahnúkur',                   -19.5200, 63.6780, 'Útsýnistindur í Þórsmörk, stutt en brött ganga með víðsýni yfir dalinn.');
  INSERT INTO attractions VALUES ('stakkholtsgja',     'Stakkholtsgjá',                -19.4850, 63.6700, 'Þröngt og falleg gjá í Þórsmörk, með foss innst í gljúfrinu.');
  INSERT INTO attractions VALUES ('nauthusagil',       'Nauthúsagil',                  -19.5250, 63.6350, 'Leyndardómsfull gjá sem opnast inn í mosaklædd gljúfur með foss.');
  INSERT INTO attractions VALUES ('magni-modi',        'Magni og Móði',                -19.4400, 63.6300, 'Gígir frá Fimmvörðuháls-gosinu 2010, nefndir eftir sonum Þórs.');
  INSERT INTO attractions VALUES ('hagavatn-lake',     'Hagavatn',                     -20.2939, 64.4627, 'Hálendisvatn nálægt Langjökli.');
  INSERT INTO attractions VALUES ('hlodufell',         'Hlöðufell',                    -20.5500, 64.4100, 'Stórbrotið stapafjall nálægt Langjökli.');
  INSERT INTO attractions VALUES ('tungnafellsjokull', 'Tungnafellsjökull',            -17.9200, 64.7350, 'Litill jökull á Sprengisandi, nálægt Nýjadal.');
  INSERT INTO attractions VALUES ('hornbjarg-cliffs',  'Hornbjarg',                    -22.3800, 66.4200, 'Ein af stórfenglegustu fuglabörgunum á Íslandi, á ysta norðurhorni Hornstrandna.');
  INSERT INTO attractions VALUES ('arctic-fox',        'Tófuáhorf á Hornströndum',     NULL,     NULL,    'Hornstrandir eru besta svæðið á Íslandi til að sjá tófur í villtri náttúru.');
  INSERT INTO attractions VALUES ('krossneslaug',      'Krossneslaug',                 -21.5100, 66.0830, 'Heit útisundlaug á ströndinni í Norðurfirði, með útsýni yfir Grænlandshafið.');

  -- Huts
  INSERT INTO huts VALUES ('lml-hut', 'Landmannalaugar',             -19.0610, 63.9933, 78, 550,  '~20. júní – ~15. september',        'Skáli', 'Stór skáli við Laugahraun, upphaf Laugavegar, með heitum laugum og litríkum líparitfjöllum.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/landmannalaugar');
  INSERT INTO huts VALUES ('hrf',     'Hrafntinnusker',              -19.1685, 63.9336, 52, 1100, '~seint í júní – ~byrjun september', 'Skáli', 'Hæsti skáli FÍ, 1.100 m y.s., umkringdur hrauni, jöklum og hverasvæðum á Laugavegi.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/hrafntinnusker');
  INSERT INTO huts VALUES ('alf',     'Álftavatn',                   -19.2273, 63.8578, 72, 550,  '~20. júní – ~15. september',        'Skáli', 'Tveir skálar við Álftavatn, áfangastaður á Laugavegi með útsýni yfir vatnið.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/alftavatn');
  INSERT INTO huts VALUES ('hvg',     'Hvanngil',                    -19.2048, 63.8319, 60, 550,  '~20. júní – ~15. september',        'Skáli', 'Rúmgóður skáli í Hvanngilshrauni á Laugavegi, skjólgóður tjaldstaður.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/hvanngil');
  INSERT INTO huts VALUES ('ems',     'Emstrur',                     -19.3742, 63.7663, 60, 465,  '~20. júní – ~15. september',        'Skáli', 'Þrír eins skálar á Botnum í Emstrum, skammt frá Markarfljótsgljúfri.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/emstrur');
  INSERT INTO huts VALUES ('tmk-hut', 'Þórsmörk / Langidalur',      -19.5148, 63.6827, 73, 200,  '~20. júní – ~15. september',        'Skáli', 'Aðalskáli FÍ í Þórsmörk, endastaður Laugavegar og upphaf Fimmvörðuhálsleiðar.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/thorsmork-langidalur');
  INSERT INTO huts VALUES ('fmv',     'Fimmvörðuháls / Baldvinsskáli',-19.4412, 63.6111, 16, 900, '~20. júní – ~15. september',        'Skáli', 'Lítill neyðarskáli á 900 m hæð á Fimmvörðuhálsskarðinu milli Eyjafjallajökuls og Mýrdalsjökuls.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/fimmvorduhals-baldvinsskali');
  INSERT INTO huts VALUES ('hvt',     'Hvítárnes',                   -19.7566, 64.6168, 30, 550,  '~20. júní – ~15. september',        'Skáli', 'Elsti skáli FÍ, reistur 1930, á húsmunaverndarlista. Tveggja hæða skáli á Kjöl.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/hvitarnes');
  INSERT INTO huts VALUES ('tvb',     'Þverbrekknamúli',             -19.6143, 64.7183, 20, 520,  '~20. júní – ~15. september',        'Skáli', 'Notalegur skáli á hálendinu, 20 rúm í opnu herbergi, aðeins aðgengilegur gangandi.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/thverbrekknamuli');
  INSERT INTO huts VALUES ('tjd',     'Þjófadalir',                  -19.7085, 64.8150, 12, 610,  '~20. júní – ~15. september',        'Skáli', 'Lítill og afskektur skáli á hálendinu, reistur 1939, aðeins aðgengilegur gangandi.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/thjofadalir');
  INSERT INTO huts VALUES ('hgv',     'Hagavatn',                    -20.2939, 64.4627, 12, 320,  '~20. júní – ~15. september',        'Skáli', 'Lítill skáli undir Einifelli við Hagavatn, nálægt Langjökli.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/hagavatn');
  INSERT INTO huts VALUES ('hld',     'Hlöðuvellir',                 -20.5565, 64.3985, 15, 450,  '~20. júní – ~15. september',        'Skáli', 'Skáli undir Hlöðufelli á hálendinu, 15 rúm, nálægt Langjökli.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/hloduvellir');
  INSERT INTO huts VALUES ('nyd',     'Nýidalur',                    -18.0725, 64.7355, 54, 830,  '~20. júní – ~15. september',        'Skáli', 'Tveir skálar á Sprengisandsleið, 830 m y.s., nálægt Tungnafellsjökli.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/nyidalur');
  INSERT INTO huts VALUES ('hrn',     'Hornbjargsviti',              -22.3795, 66.4107, 40, 21,   '~seint í júní – ~ágúst',            'Skáli', 'Gamalt vitaverðahús á Hornströndum, við stórfenglegustu fuglabörg landsins.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/hornbjargsviti');
  INSERT INTO huts VALUES ('nfj',     'Norðurfjörður / Valgeirsstaðir',-21.5662, 66.0513, 26, 25, '~20. júní – ~15. september',        'Skáli', 'Gamall bær í Norðurfirði á Ströndum, nálægt Krossneslaugum.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/nordurfjordur-valgeirsstadir');
  INSERT INTO huts VALUES ('mos',     'Sæluhúsið á Mosfellsheiði',   -21.3950, 64.1735, 0,  NULL, 'Opið allt árið – dagskýli eingöngu', 'Sæluhús', 'Endurreist steinskýli frá um 1890 á Gamla Þingvallavegi, dagskýli, ekki til næturgistingar.', 'https://www.fi.is/is/skalar/skalar-ferdafelags-islands/saeluhusid-a-mosfellsheidi');

  -- Hut ↔ Trail links
  INSERT INTO hut_trails VALUES ('lml-hut', 'laugavegur');
  INSERT INTO hut_trails VALUES ('hrf',     'laugavegur');
  INSERT INTO hut_trails VALUES ('alf',     'laugavegur');
  INSERT INTO hut_trails VALUES ('hvg',     'laugavegur');
  INSERT INTO hut_trails VALUES ('ems',     'laugavegur');
  INSERT INTO hut_trails VALUES ('tmk-hut', 'laugavegur');
  INSERT INTO hut_trails VALUES ('tmk-hut', 'fimmvorduhals');
  INSERT INTO hut_trails VALUES ('tmk-hut', 'tindfjallahringur');
  INSERT INTO hut_trails VALUES ('fmv',     'fimmvorduhals');
  INSERT INTO hut_trails VALUES ('hvt',     'kjolur-interior');
  INSERT INTO hut_trails VALUES ('tvb',     'kjolur-interior');
  INSERT INTO hut_trails VALUES ('tjd',     'kjolur-interior');
  INSERT INTO hut_trails VALUES ('hgv',     'langjokull-interior');
  INSERT INTO hut_trails VALUES ('hld',     'langjokull-interior');
  INSERT INTO hut_trails VALUES ('nyd',     'sprengisandur');
  INSERT INTO hut_trails VALUES ('hrn',     'hornstrandir');
  INSERT INTO hut_trails VALUES ('nfj',     'hornstrandir');

  -- Hut ↔ Attraction links
  INSERT INTO hut_attractions VALUES ('lml-hut', 'hot-springs-lml');
  INSERT INTO hut_attractions VALUES ('lml-hut', 'rhyolite-mountains');
  INSERT INTO hut_attractions VALUES ('lml-hut', 'fridland-fjallabaki');
  INSERT INTO hut_attractions VALUES ('hrf',     'obsidian');
  INSERT INTO hut_attractions VALUES ('hrf',     'ice-caves');
  INSERT INTO hut_attractions VALUES ('alf',     'alftaskard');
  INSERT INTO hut_attractions VALUES ('ems',     'markarfljotsgljufur');
  INSERT INTO hut_attractions VALUES ('tmk-hut', 'valahnukur');
  INSERT INTO hut_attractions VALUES ('tmk-hut', 'stakkholtsgja');
  INSERT INTO hut_attractions VALUES ('tmk-hut', 'nauthusagil');
  INSERT INTO hut_attractions VALUES ('tmk-hut', 'magni-modi');
  INSERT INTO hut_attractions VALUES ('fmv',     'magni-modi');
  INSERT INTO hut_attractions VALUES ('hgv',     'hagavatn-lake');
  INSERT INTO hut_attractions VALUES ('hld',     'hlodufell');
  INSERT INTO hut_attractions VALUES ('nyd',     'tungnafellsjokull');
  INSERT INTO hut_attractions VALUES ('hrn',     'hornbjarg-cliffs');
  INSERT INTO hut_attractions VALUES ('hrn',     'arctic-fox');
  INSERT INTO hut_attractions VALUES ('nfj',     'krossneslaug');
`);

const count = (table: string) => (db.query(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

console.log(`Created ${DB_PATH}:`);
console.log(`  ${count("huts")} huts`);
console.log(`  ${count("trails")} trails`);
console.log(`  ${count("attractions")} attractions`);
console.log(`  ${count("hut_trails")} hut↔trail links`);
console.log(`  ${count("hut_attractions")} hut↔attraction links`);

try {
  db.prepare("INSERT INTO hut_trails VALUES (?, ?)").run("fake-hut", "laugavegur");
  console.log("\n  ✗ FK constraint NOT enforced!");
} catch {
  console.log("\n  ✓ Foreign key constraints enforced");
}

db.close();
