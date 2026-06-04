import fs from 'fs';
import path from 'path';
import http from 'https';

const COUNTRIES_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const SUBDIVISIONS_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const RIVERS_GLOBAL_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson';
const RIVERS_EUROPE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_europe.geojson';
const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=cca2,capital,population,area,tld,idd,timezones,flag,currencies,translations';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

const PUBLIC_DIR = path.resolve('public/data');
const DATA_DIR = path.resolve('src/data');
const COUNTRIES_OUTPUT = path.join(PUBLIC_DIR, 'countries.json');
const SUBDIVISIONS_OUTPUT = path.join(PUBLIC_DIR, 'subdivisions.json');
const RIVERS_OUTPUT = path.join(PUBLIC_DIR, 'rivers.json');
const GEODB_OUTPUT = path.join(DATA_DIR, 'geodb.json');

const ISO3_TO_ISO2 = {
  DEU: 'DE', USA: 'US', GBR: 'GB', FRA: 'FR', ITA: 'IT',
  ESP: 'ES', CAN: 'CA', AUS: 'AU', BRA: 'BR', JPN: 'JP',
  CHN: 'CN', IND: 'IN', RUS: 'RU', AUT: 'AT', CHE: 'CH'
};
const targetIso2 = new Set(['DE', 'US', 'GB', 'FR', 'IT', 'ES', 'CA', 'AU', 'BR', 'JP', 'CN', 'IN', 'RU', 'AT', 'CH']);

const RIVERS_DATA = [
  {
    id: 'river_rhein',
    name: 'Rhein',
    englishName: 'Rhine',
    lengthKm: 1232,
    countries: ['CH', 'LI', 'AT', 'DE', 'FR', 'NL'],
    mouth: 'Nordsee',
    facts: [
      'Der Rhein ist einer der verkehrsreichsten Wasserwege der Welt.',
      'Er entspringt in den Schweizer Alpen und mündet in die Nordsee.',
      'Bekannter Reim für den Hunsrück: „Mosel, Saar, Nahe, Rhein schließen rings den Hunsrück ein.“'
    ]
  },
  {
    id: 'river_donau',
    name: 'Donau',
    englishName: 'Danube',
    lengthKm: 2857,
    countries: ['DE', 'AT', 'SK', 'HU', 'HR', 'RS', 'RO', 'BG', 'MD', 'UA'],
    mouth: 'Schwarzes Meer',
    facts: [
      'Die Donau ist nach der Wolga der zweitlängste Fluss in Europa.',
      'Eselsbrücke für Quellflüsse: „Brigach und Breg bringen die Donau zuweg.“',
      'Eselsbrücke für rechte Zuflüsse: „Iller, Lech, Isar, Inn fließen rechts zur Donau hin.“',
      'Eselsbrücke für linke Zuflüsse: „Altmühl, Naab und Regen fließen ihr entgegen.“'
    ]
  },
  {
    id: 'river_elbe',
    name: 'Elbe',
    englishName: 'Elbe',
    lengthKm: 1091,
    countries: ['CZ', 'DE'],
    mouth: 'Nordsee',
    facts: [
      'Die Elbe entspringt im Riesengebirge in Tschechien und mündet bei Cuxhaven in die Nordsee.',
      'Sie fließt unter anderem durch Dresden, Magdeburg und Hamburg.',
      'Die Elbe war während des Kalten Krieges Teil des Grenzverlaufs zwischen Ost- und Westdeutschland.'
    ]
  },
  {
    id: 'river_weser',
    name: 'Weser',
    englishName: 'Weser',
    lengthKm: 452,
    countries: ['DE'],
    mouth: 'Nordsee',
    facts: [
      'Die Weser entsteht bei Hannoversch Münden aus dem Zusammenfluss von Werra und Fulda.',
      'Merkspruch zum Ursprung: „Wo Werra und Fulda sich küssen und ihren Namen lassen müssen, entsteht durch diesen dicken Kuss so nebenbei der Weserfluss.“',
      'Sie ist der einzige große Strom Deutschlands, der ein ausschließlich deutsches Einzugsgebiet hat.'
    ]
  },
  {
    id: 'river_main',
    name: 'Main',
    englishName: 'Main',
    lengthKm: 527,
    countries: ['DE'],
    mouth: 'Rhein',
    facts: [
      'Der Main ist der längste rechte Nebenfluss des Rheins.',
      'Merkspruch für den Spessart: „Kinzig, Sinn und Main schließen den Spessart ein.“',
      'Er fließt von Osten nach Westen unter anderem durch Würzburg und Frankfurt am Main.'
    ]
  },
  {
    id: 'river_oder',
    name: 'Oder',
    englishName: 'Oder',
    lengthKm: 854,
    countries: ['CZ', 'PL', 'DE'],
    mouth: 'Ostsee',
    facts: [
      'Die Oder entspringt in Tschechien, fließt durch Polen und bildet die Grenze zwischen Deutschland und Polen.',
      'Sie mündet über das Stettiner Haff in die Ostsee.',
      'Die Oder ist ein ökologisch bedeutender Fluss mit ausgedehnten Auenlandschaften.'
    ]
  },
  {
    id: 'river_neckar',
    name: 'Neckar',
    englishName: 'Neckar',
    lengthKm: 362,
    countries: ['DE'],
    mouth: 'Rhein',
    facts: [
      'Der Neckar entspringt im Schwenninger Moos und mündet bei Mannheim in den Rhein.',
      'Er fließt unter anderem durch Tübingen, Stuttgart und Heidelberg.',
      'Das Neckartal ist für seinen Weinbau und zahlreiche Burgen bekannt.'
    ]
  },
  {
    id: 'river_mosel',
    name: 'Mosel',
    englishName: 'Moselle',
    lengthKm: 544,
    countries: ['FR', 'LU', 'DE'],
    mouth: 'Rhein',
    facts: [
      'Die Mosel entspringt in den französischen Vogesen und mündet in Koblenz am Deutschen Eck in den Rhein.',
      'Sie bildet einen Teil der Grenze zwischen Luxemburg und Deutschland.',
      'Das Moseltal ist berühmt für seine steilen Weinberge und Schleifen.'
    ]
  },
  {
    id: 'river_isar',
    name: 'Isar',
    englishName: 'Isar',
    lengthKm: 295,
    countries: ['AT', 'DE'],
    mouth: 'Donau',
    facts: [
      'Die Isar entspringt im Karwendelgebirge in Tirol und mündet in Bayern in die Donau.',
      'Sie fließt direkt durch die bayerische Landeshauptstadt München.',
      'Die Isar ist in München ein wichtiger Naherholungsraum.'
    ]
  },
  {
    id: 'river_inn',
    name: 'Inn',
    englishName: 'Inn',
    lengthKm: 517,
    countries: ['CH', 'AT', 'DE'],
    mouth: 'Donau',
    facts: [
      'Der Inn entspringt im Schweizer Engadin, fließt durch Tirol und mündet in Passau in die Donau.',
      'In Passau ist der Inn an der Mündungsstelle breiter als die Donau selbst.',
      'Er fließt unter anderem durch St. Moritz, Innsbruck und Rosenheim.'
    ]
  },
  {
    id: 'river_ems',
    name: 'Ems',
    englishName: 'Ems',
    lengthKm: 371,
    countries: ['DE'],
    mouth: 'Nordsee',
    facts: [
      'Die Ems fließt durch das nordwestliche Deutschland und mündet in den Dollart bei Emden.',
      'Sie ist bekannt für die Überführung großer Kreuzfahrtschiffe der Meyer Werft in Papenburg.',
      'Die Ems fließt durch eine flache, von Mooren geprägte Landschaft.'
    ]
  },
  {
    id: 'river_ruhr',
    name: 'Ruhr',
    englishName: 'Ruhr',
    lengthKm: 219,
    countries: ['DE'],
    mouth: 'Rhein',
    facts: [
      'Die Ruhr entspringt im Sauerland und mündet bei Duisburg-Ruhrort in den Rhein.',
      'Sie ist der Namensgeber des Ruhrgebiets, des größten Ballungsraums in Deutschland.',
      'Die Ruhr dient heute vor allem der Wasserversorgung und als Freizeitrevier.'
    ]
  },
  {
    id: 'river_spree',
    name: 'Spree',
    englishName: 'Spree',
    lengthKm: 382,
    countries: ['DE'],
    mouth: 'Havel',
    facts: [
      'Die Spree fließt durch Sachsen, Brandenburg und Berlin, wo sie in die Havel mündet.',
      'In Berlin umfließt sie die berühmte Museumsinsel.',
      'Der Spreewald südlich von Berlin ist ein bekanntes Biosphärenreservat mit verzweigten Fließen.'
    ]
  },
  {
    id: 'river_seine',
    name: 'Seine',
    englishName: 'Seine',
    lengthKm: 777,
    countries: ['FR'],
    mouth: 'Ärmelkanal',
    facts: [
      'Die Seine fließt durch Paris und mündet bei Le Havre in den Ärmelkanal.',
      'Ihre Uferpromenaden in Paris gehören zum UNESCO-Weltkulturerbe.',
      'Die Seine teilt Paris in die Rive Gauche (linkes Ufer) und Rive Droite (rechtes Ufer).'
    ]
  },
  {
    id: 'river_themse',
    name: 'Themse',
    englishName: 'Thames',
    lengthKm: 346,
    countries: ['GB'],
    mouth: 'Nordsee',
    facts: [
      'Die Themse fließt durch das südliche England, insbesondere durch die Hauptstadt London.',
      'Sie ist der zweitlängste Fluss des Vereinigten Königreichs.',
      'Die Themse mündet in einem weiten Ästuarsystem in die Nordsee.'
    ]
  },
  {
    id: 'river_po',
    name: 'Po',
    englishName: 'Po',
    lengthKm: 652,
    countries: ['IT'],
    mouth: 'Adriatisches Meer',
    facts: [
      'Der Po ist der längste Fluss Italiens.',
      'Er fließt durch die fruchtbare Po-Ebene im Norden Italiens von West nach Ost.',
      'Der Po mündet südlich von Venedig über ein großes Delta in die Adria.'
    ]
  },
  {
    id: 'river_ebro',
    name: 'Ebro',
    englishName: 'Ebro',
    lengthKm: 930,
    countries: ['ES'],
    mouth: 'Mittelmeer',
    facts: [
      'Der Ebro ist der wasserreichste Fluss Spaniens und fließt durch den Nordosten des Landes.',
      'Er fließt unter anderem durch Saragossa und mündet in einem großen Delta ins Mittelmeer.',
      'Sein Name leitet sich von den Iberern ab, die der Halbinsel ihren Namen gaben.'
    ]
  },
  {
    id: 'river_rhone',
    name: 'Rhone',
    englishName: 'Rhône',
    lengthKm: 813,
    countries: ['CH', 'FR'],
    mouth: 'Mittelmeer',
    facts: [
      'Die Rhone entspringt im Schweizer Kanton Wallis am Rhonegletscher.',
      'Sie durchfließt den Genfersee und fließt danach durch Frankreich nach Süden zum Mittelmeer.',
      'Sie mündet in der Camargue über ein verzweigtes Delta in das Mittelmeer.'
    ]
  },
  {
    id: 'river_loire',
    name: 'Loire',
    englishName: 'Loire',
    lengthKm: 1006,
    countries: ['FR'],
    mouth: 'Atlantischer Ozean',
    facts: [
      'Die Loire ist der längste Fluss Frankreichs, der vollständig auf französischem Gebiet verläuft.',
      'Das Tal der Loire ist weltberühmt für seine Renaissance-Schlösser (Loire-Schlösser).',
      'Die Loire gilt als der letzte große Wildfluss Europas mit einer unberührten Flussdynamik.'
    ]
  },
  {
    id: 'river_tajo',
    name: 'Tajo',
    englishName: 'Tagus',
    lengthKm: 1007,
    countries: ['ES', 'PT'],
    mouth: 'Atlantischer Ozean',
    facts: [
      'Der Tajo ist der längste Fluss der Iberischen Halbinsel.',
      'Er entspringt in Ostspanien, fließt durch Toledo und mündet bei Lissabon in den Atlantik.',
      'Der Fluss bildet zeitweise die Grenze zwischen Spanien und Portugal.'
    ]
  },
  {
    id: 'river_weichsel',
    name: 'Weichsel',
    englishName: 'Vistula',
    lengthKm: 1047,
    countries: ['PL'],
    mouth: 'Ostsee',
    facts: [
      'Die Weichsel ist der längste Fluss Polens und das wichtigste Gewässer des Landes.',
      'Sie fließt durch Krakau und Warschau und mündet bei Danzig in die Ostsee.',
      'Das Einzugsgebiet der Weichsel umfasst fast 60 Prozent der Fläche Polens.'
    ]
  },
  {
    id: 'river_wolga',
    name: 'Wolga',
    englishName: 'Volga',
    lengthKm: 3530,
    countries: ['RU'],
    mouth: 'Kaspisches Meer',
    facts: [
      'Die Wolga ist der längste und wasserreichste Fluss Europas.',
      'Sie verläuft vollständig im europäischen Teil Russlands.',
      'Die Wolga mündet in einem riesigen Mündungsdelta in das abflusslose Kaspische Meer.'
    ]
  },
  {
    id: 'river_nil',
    name: 'Nil',
    englishName: 'Nile',
    lengthKm: 6650,
    countries: ['EG', 'SD', 'SS', 'ET', 'UG', 'KE', 'TZ', 'RW', 'BI', 'CD'],
    mouth: 'Mittelmeer',
    facts: [
      'Der Nil gilt traditionell als der längste Fluss der Erde.',
      'Er entspringt in den Bergen von Burundi/Ruanda und fließt nach Norden durch die Sahara.',
      'Ohne das Nilwasser wäre die Oasenwirtschaft und Besiedlung Ägyptens unmöglich.'
    ]
  },
  {
    id: 'river_amazonas',
    name: 'Amazonas',
    englishName: 'Amazon',
    lengthKm: 6400,
    countries: ['BR', 'PE', 'CO'],
    mouth: 'Atlantischer Ozean',
    facts: [
      'Der Amazonas ist der wasserreichste Fluss der Erde, weit vor jedem anderen Strom.',
      'Er entwässert das größte tropische Regenwaldgebiet unseres Planeten.',
      'Der Amazonas besitzt keine einzige Brücke, die den Hauptstrom überspannt.'
    ]
  },
  {
    id: 'river_mississippi',
    name: 'Mississippi',
    englishName: 'Mississippi',
    lengthKm: 3730,
    countries: ['US'],
    mouth: 'Golf von Mexiko',
    facts: [
      'Der Mississippi ist der zweitlängste Fluss der USA und bildet mit dem Missouri ein riesiges Flusssystem.',
      'Er entspringt im Lake Itasca in Minnesota und mündet südlich von New Orleans.',
      'Der Fluss spielte eine zentrale Rolle für den Handel und die Kultur der US-Südstaaten.'
    ]
  },
  {
    id: 'river_jangtsekiang',
    name: 'Jangtsekiang',
    englishName: 'Yangtze',
    lengthKm: 6300,
    countries: ['CN'],
    mouth: 'Ostchinesisches Meer',
    facts: [
      'Der Jangtsekiang ist der längste Fluss Asiens und der drittlängste der Welt.',
      'Er fließt vollständig innerhalb des Staatsgebiets der Volksrepublik China.',
      'Am Fluss befindet sich die Drei-Schluchten-Talsperre, das größte Wasserkraftwerk der Erde.'
    ]
  },
  {
    id: 'river_ganges',
    name: 'Ganges',
    englishName: 'Ganges',
    lengthKm: 2525,
    countries: ['IN', 'BD'],
    mouth: 'Golf von Bengalen',
    facts: [
      'Der Ganges ist der heiligste Fluss der Hindus in Indien.',
      'Er entspringt im Himalaya und vereinigt sich in Bangladesch mit dem Brahmaputra.',
      'Das Gangesdelta ist das größte Flussdelta der Welt und extrem dicht besiedelt.'
    ]
  },
  {
    id: 'river_kongo',
    name: 'Kongo',
    englishName: 'Congo',
    lengthKm: 4700,
    countries: ['CD', 'CG', 'AO'],
    mouth: 'Atlantischer Ozean',
    facts: [
      'Der Kongo ist der zweitlängste Fluss Afrikas und der tiefste Fluss der Welt (bis zu 220 m).',
      'Er durchquert zweimal den Äquator im regenwaldreichen Kongobecken.',
      'Sein Abflussvolumen wird nur vom Amazonas übertroffen.'
    ]
  },
  {
    id: 'river_mekong',
    name: 'Mekong',
    englishName: 'Mekong',
    lengthKm: 4350,
    countries: ['CN', 'MM', 'LA', 'TH', 'KH', 'VN'],
    mouth: 'Südchinesisches Meer',
    facts: [
      'Der Mekong ist der Lebensnerv Südostasiens.',
      'Er entspringt im Hochland von Tibet und fließt durch sechs Länder vor seiner Mündung in Vietnam.',
      'Das Mekongdelta ist eine der fruchtbarsten Reisbauterrassen weltweit.'
    ]
  },
  {
    id: 'river_yukon',
    name: 'Yukon',
    englishName: 'Yukon',
    lengthKm: 3190,
    countries: ['CA', 'US'],
    mouth: 'Beringmeer',
    facts: [
      'Der Yukon fließt durch das kanadische Yukon-Territorium und den US-Bundesstaat Alaska.',
      'Er war der zentrale Verkehrsweg während des Klondike-Goldrausches Ende des 19. Jahrhunderts.',
      'Der Yukon friert im Winter fast vollständig zu.'
    ]
  },
  {
    id: 'river_murray',
    name: 'Murray',
    englishName: 'Murray',
    lengthKm: 2508,
    countries: ['AU'],
    mouth: 'Indischer Ozean',
    facts: [
      'Der Murray River ist der längste Fluss Australiens.',
      'Zusammen mit dem Darling River bildet er das wichtigste landwirtschaftliche Einzugsgebiet des Kontinents.',
      'Er mündet nahe Adelaide in den Indischen Ozean.'
    ]
  },
  {
    id: 'river_lena',
    name: 'Lena',
    englishName: 'Lena',
    lengthKm: 4294,
    countries: ['RU'],
    mouth: 'Laptewsee',
    facts: [
      'Die Lena ist der östlichste der drei großen nordsibirischen Ströme Russlands.',
      'Sie entspringt nahe dem Baikalsee und mündet in einem riesigen Delta im Arktischen Ozean.',
      'Ihr Verlauf liegt fast vollständig im Dauerfrostgebiet (Permafrost).'
    ]
  },
  {
    id: 'river_yenisey',
    name: 'Jenissei',
    englishName: 'Yenisey',
    lengthKm: 3487,
    countries: ['MN', 'RU'],
    mouth: 'Karasee',
    facts: [
      'Der Jenissei ist der wasserreichste Fluss Sibiriens und mündet ins Nordpolarmeer.',
      'Er entspringt in der Mongolei und fließt nach Norden durch ganz Sibirien.',
      'Sein gewaltiges Flusssystem dient der Stromerzeugung durch gigantische Staudämme.'
    ]
  },
  {
    id: 'river_ob',
    name: 'Ob',
    englishName: 'Ob',
    lengthKm: 3650,
    countries: ['RU'],
    mouth: 'Obbusen',
    facts: [
      'Der Ob ist der westlichste der drei großen sibirischen Ströme.',
      'Sein Mündungsarm, der Obbusen, ist die längste Flussmündung der Welt (ca. 800 km).',
      'Der Ob fließt durch sumpfige westsibirische Nadelwald- und Tundragebiete.'
    ]
  },
  {
    id: 'river_amur',
    name: 'Amur',
    englishName: 'Amur',
    lengthKm: 2824,
    countries: ['RU', 'CN'],
    mouth: 'Ochotskisches Meer',
    facts: [
      'Der Amur ist ein Grenzfluss im Fernen Osten zwischen Russland und China.',
      'Sein chinesischer Name Heilong Jiang bedeutet „Fluss des Schwarzen Drachen“.',
      'Er fließt durch bewaldete Gebirgsregionen und mündet gegenüber Sachalin.'
    ]
  },
  {
    id: 'river_indus',
    name: 'Indus',
    englishName: 'Indus',
    lengthKm: 3180,
    countries: ['CN', 'IN', 'PK'],
    mouth: 'Arabisches Meer',
    facts: [
      'Der Indus ist der längste Fluss auf dem indischen Subkontinent und Lebensader Pakistans.',
      'An seinen Ufern entwickelte sich vor 5000 Jahren die frühe Indus-Kultur.',
      'Er entspringt in Tibet, durchquert den Himalaya und mündet ins Arabische Meer.'
    ]
  },
  {
    id: 'river_euphrat',
    name: 'Euphrat',
    englishName: 'Euphrates',
    lengthKm: 2800,
    countries: ['TR', 'SY', 'IQ'],
    mouth: 'Schatt al-Arab',
    facts: [
      'Der Euphrat bildet zusammen mit dem Tigris das antike Zweistromland (Mesopotamien).',
      'Er entspringt in der Türkei, fließt durch Syrien und den Irak.',
      'Er vereinigt sich mit dem Tigris zum Schatt al-Arab und mündet in den Persischen Golf.'
    ]
  },
  {
    id: 'river_tigris',
    name: 'Tigris',
    englishName: 'Tigris',
    lengthKm: 1900,
    countries: ['TR', 'SY', 'IQ'],
    mouth: 'Schatt al-Arab',
    facts: [
      'Der Tigris ist der östliche Partner des Euphrat im historischen Zweistromland.',
      'Er fließt unter anderem durch die irakischen Metropolen Mossul und Bagdad.',
      'Sein Einzugsgebiet ist eine Wiege der menschlichen Zivilisation.'
    ]
  },
  {
    id: 'river_colorado',
    name: 'Colorado',
    englishName: 'Colorado',
    lengthKm: 2330,
    countries: ['US', 'MX'],
    mouth: 'Golf von Kalifornien',
    facts: [
      'Der Colorado River schuf den weltberühmten Grand Canyon in Arizona.',
      'Er ist das wichtigste Wasserreservoir im extrem trockenen Südwesten der USA.',
      'Durch massive Wasserentnahmen (z.B. Hoover Dam) erreicht er heute selten das Meer.'
    ]
  },
  {
    id: 'river_sambesi',
    name: 'Sambesi',
    englishName: 'Zambezi',
    lengthKm: 2574,
    countries: ['ZM', 'AO', 'NA', 'BW', 'ZW', 'MZ'],
    mouth: 'Indischer Ozean',
    facts: [
      'Der Sambesi fließt durch das southern Afrika und ist für die Victoriafälle bekannt.',
      'An den Victoriafällen stürzt der Fluss über 100 Meter tief in eine Schlucht.',
      'Er mündet in Mosambik in den Indischen Ozean.'
    ]
  },
  {
    id: 'river_orinoco',
    name: 'Orinoco',
    englishName: 'Orinoco',
    lengthKm: 2140,
    countries: ['CO', 'VE'],
    mouth: 'Atlantischer Ozean',
    facts: [
      'Der Orinoco fließt durch Venezuela und Kolumbien im Norden Südamerikas.',
      'Er mündet über ein riesiges, artenreiches Delta in den Atlantischen Ozean.',
      'Alexander von Humboldt erforschte im Jahr 1800 weite Teile des Flusslaufes.'
    ]
  },
  {
    id: 'river_rio_grande',
    name: 'Rio Grande',
    englishName: 'Rio Grande',
    lengthKm: 3034,
    countries: ['US', 'MX'],
    mouth: 'Golf von Mexiko',
    facts: [
      'Der Rio Grande bildet die natürliche Grenze zwischen Texas (USA) und Mexiko.',
      'In Mexiko wird der Fluss „Río Bravo del Norte“ genannt.',
      'Er entspringt in den Rocky Mountains von Colorado.'
    ]
  },
  {
    id: 'river_sankt_lorenz',
    name: 'Sankt-Lorenz-Strom',
    englishName: 'Saint Lawrence',
    lengthKm: 1197,
    countries: ['CA', 'US'],
    mouth: 'Sankt-Lorenz-Golf',
    facts: [
      'Der Sankt-Lorenz-Strom verbindet die Großen Seen Nordamerikas mit dem Atlantik.',
      'Er bildet eine der wichtigsten Wasserstraßen Kanadas und Nordamerikas.',
      'In seinem Ästuar können Weißwale (Belugas) beobachtet werden.'
    ]
  },
  {
    id: 'river_niger',
    name: 'Niger',
    englishName: 'Niger',
    lengthKm: 4180,
    countries: ['GN', 'ML', 'NE', 'BJ', 'NG'],
    mouth: 'Golf von Guinea',
    facts: [
      'Der Niger ist der drittlängste Fluss Afrikas und verläuft in einem weiten Bogen.',
      'Er besitzt eine ungewöhnliche Flussschleife (Nigerbogen), die durch die Wüste führt.',
      'Er mündet im ölreichen Nigerdelta in den Atlantischen Ozean.'
    ]
  },
  {
    id: 'river_parana',
    name: 'Paraná',
    englishName: 'Paraná',
    lengthKm: 4880,
    countries: ['BR', 'PY', 'AR'],
    mouth: 'Río de la Plata',
    facts: [
      'Der Paraná ist nach dem Amazonas der zweitlängste Fluss Südamerikas.',
      'Ein Nebenfluss speist die weltberühmten Iguazú-Wasserfälle an der Grenze zu Brasilien.',
      'Zusammen mit dem Uruguay River bildet er die breite Flussmündung Río de la Plata.'
    ]
  },
  {
    id: 'river_darling',
    name: 'Darling',
    englishName: 'Darling',
    lengthKm: 1472,
    countries: ['AU'],
    mouth: 'Murray',
    facts: [
      'Der Darling River ist ein großer Nebenfluss des Murray und entspringt in Queensland.',
      'Er leidet häufig unter starker Trockenheit und unregelmäßiger Wasserführung.',
      'Er ist ein wichtiger Bestandteil des Outbacks im südöstlichen Australien.'
    ]
  },
  {
    id: 'river_huang_he',
    name: 'Huang He',
    englishName: 'Huang He',
    lengthKm: 5464,
    countries: ['CN'],
    mouth: 'Bohai-Meer',
    facts: [
      'Der Huang He wird auch „Gelber Fluss“ genannt wegen der mitgeführten Lösssedimente.',
      'Er gilt als Wiege der chinesischen Zivilisation.',
      'Durch verheerende Hochwasserkatastrophen in der Geschichte erhielt er den Beinamen „Chinas Kummer“.'
    ]
  },
  {
    id: 'river_tiber',
    name: 'Tiber',
    englishName: 'Tiber',
    lengthKm: 405,
    countries: ['IT'],
    mouth: 'Mittelmeer',
    facts: [
      'Der Tiber ist der drittlängste Fluss Italiens und fließt durch die Hauptstadt Rom.',
      'Laut Sage wurden die Zwillinge Romulus und Remus in einem Korb auf dem Tiber ausgesetzt.',
      'Er entspringt im Apennin und mündet bei Ostia in das Tyrrhenische Meer.'
    ]
  },
  {
    id: 'river_hudson',
    name: 'Hudson',
    englishName: 'Hudson',
    lengthKm: 507,
    countries: ['US'],
    mouth: 'Atlantischer Ozean',
    facts: [
      'Der Hudson River fließt von Norden nach Süden durch den US-Bundesstaat New York.',
      'Er trennt die Metropolen New York City und Jersey City an seiner Mündung.',
      'Der Fluss ist nach dem englischen Seefahrer Henry Hudson benannt.'
    ]
  },
  {
    id: 'river_neva',
    name: 'Newa',
    englishName: 'Neva',
    lengthKm: 74,
    countries: ['RU'],
    mouth: 'Ostsee',
    facts: [
      'Die Newa ist trotz ihrer Kürze von 74 km einer der wasserreichsten Flüsse Europas.',
      'Sie verbindet den Ladogasee mit der Ostsee (Finnischer Meerbusen).',
      'Die Metropole Sankt Petersburg erstreckt sich über das Mündungsdelta der Newa.'
    ]
  }
];

const NAME_MAP = {
  'rhein': ['rhine', 'rhein'],
  'donau': ['danube', 'donau'],
  'elbe': ['elbe'],
  'weser': ['weser'],
  'main': ['main'],
  'oder': ['oder'],
  'neckar': ['neckar'],
  'mosel': ['moselle', 'mosel'],
  'isar': ['isar'],
  'inn': ['inn'],
  'ems': ['ems'],
  'ruhr': ['ruhr'],
  'spree': ['spree'],
  'seine': ['seine'],
  'themse': ['thames', 'themse'],
  'po': ['po'],
  'ebro': ['ebro'],
  'rhone': ['rhone', 'rhône'],
  'loire': ['loire'],
  'tajo': ['tagus', 'tajo', 'tejo'],
  'weichsel': ['vistula', 'weichsel', 'wisla'],
  'wolga': ['volga', 'wolga'],
  'nil': ['nile', 'nil'],
  'amazonas': ['amazon', 'amazonas'],
  'mississippi': ['mississippi'],
  'jangtsekiang': ['yangtze', 'chang jiang', 'yangtse', 'jangtsekiang'],
  'ganges': ['ganges', 'ganga'],
  'kongo': ['congo', 'kongo', 'zaire'],
  'mekong': ['mekong'],
  'yukon': ['yukon'],
  'murray': ['murray'],
  'lena': ['lena'],
  'jenissei': ['yenisey', 'yenisei', 'jenissei'],
  'ob': ['ob', 'ob\''],
  'amur': ['amur'],
  'indus': ['indus'],
  'euphrat': ['euphrates', 'euphrat'],
  'tigris': ['tigris'],
  'colorado': ['colorado'],
  'sambesi': ['zambezi', 'sambesi'],
  'orinoco': ['orinoco'],
  'rio grande': ['rio grande', 'rio bravo'],
  'sankt-lorenz-strom': ['saint lawrence', 'st. lawrence', 'sankt-lorenz-strom'],
  'niger': ['niger'],
  'paraná': ['parana', 'paraná'],
  'darling': ['darling'],
  'huang he': ['huang he', 'yellow river', 'yellow'],
  'tiber': ['tiber', 'tevere'],
  'hudson': ['hudson'],
  'newa': ['neva', 'newa']
};

const CAPITAL_TRANSLATIONS = {
  'Vienna': 'Wien',
  'Rome': 'Rom',
  'Warsaw': 'Warschau',
  'Prague': 'Prag',
  'Copenhagen': 'Kopenhagen',
  'Lisbon': 'Lissabon',
  'Athens': 'Athen',
  'Brussels': 'Brüssel',
  'Bucharest': 'Bukarest',
  'Moscow': 'Moskau',
  'Beijing': 'Peking',
  'New Delhi': 'Neu-Delhi',
  'Cairo': 'Kairo',
  'Nicosia': 'Nikosia',
  'Belgrade': 'Belgrad',
  'Kyiv': 'Kiew',
  'Reykjavik': 'Reykjavík',
  'Mexico City': 'Mexiko-Stadt',
  'Panama City': 'Panama-Stadt',
  'Guatemala City': 'Guatemala-Stadt',
  'Vatican City': 'Vatikanstadt',
  'Luxembourg': 'Luxemburg',
  'Tehran': 'Teheran',
  'Baghdad': 'Bagdad',
  'Riyadh': 'Riad',
  'Kuwait City': 'Kuwait-Stadt',
  'Damascus': 'Damaskus',
  'Yerevan': 'Jerewan',
  'Tbilisi': 'Tiflis',
  'Ulan Bator': 'Ulan-Bator',
  'Tripoli': 'Tripolis',
  'Algiers': 'Algier',
  'Addis Ababa': 'Addis Abeba',
  'Khartoum': 'Khartum',
  'Prishtina': 'Pristina',
  'Havana': 'Havanna',
  'Cape Town': 'Kapstadt',
  'Djibouti': 'Dschibuti',
  'Singapore': 'Singapur',
  'Yaren': 'Yaren',
  'Palikir': 'Palikir',
  'Ngerulmud': 'Ngerulmud',
  'Saint John\'s': 'St. John’s',
  'Saint George\'s': 'St. George’s',
  'Santo Domingo': 'Santo Domingo',
  'Port-au-Prince': 'Port-au-Prince',
  'Kingstown': 'Kingstown',
  'Port of Spain': 'Port-of-Spain'
};

function getCountryIso2(props) {
  let iso2 = (props.iso_a2 || '').toUpperCase().trim();
  if (iso2 && iso2 !== '-99' && iso2.length === 2) {
    return iso2;
  }
  const adm3 = (props.adm0_a3 || '').toUpperCase().trim();
  if (ISO3_TO_ISO2[adm3]) {
    return ISO3_TO_ISO2[adm3];
  }
  if (props.iso_3166_2 && props.iso_3166_2.includes('-')) {
    const parts = props.iso_3166_2.split('-');
    if (parts[0].length === 2) {
      return parts[0].toUpperCase();
    }
  }
  return null;
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '_');
}

// Ensure output directories exist
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Helper to make HTTPS requests with User-Agent and a 20-second timeout
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'GeoAtlasQuiz/1.0 (info@dm0.de)',
        ...headers
      },
      timeout: 20000 // 20 seconds timeout
    };
    
    const req = http.get(url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode} ${res.statusMessage}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed-out for: ${url}`));
    });
    
    req.on('error', reject);
  });
}

// Wikidata SPARQL execution
async function fetchWikidata(query) {
  const url = `${WIKIDATA_SPARQL_URL}?format=json&query=${encodeURIComponent(query)}`;
  return fetchJSON(url, { 'Accept': 'application/sparql-results+json' });
}

async function run() {
  console.log('--- STARTING DATA PIPELINE v1.0.0 ---');

  try {
    // 1. Download/Load Country boundaries
    console.log('1/5. Loading country boundaries...');
    let simplifiedCountries = [];
    if (fs.existsSync(COUNTRIES_OUTPUT)) {
      console.log('Using local cached country boundaries.');
      const data = JSON.parse(fs.readFileSync(COUNTRIES_OUTPUT));
      simplifiedCountries = data.features;
    } else {
      console.log('Downloading country boundaries...');
      const countriesGeoJSON = await fetchJSON(COUNTRIES_GEOJSON_URL);
      simplifiedCountries = countriesGeoJSON.features.map(f => {
        const props = f.properties || {};
        const isoA2 = (props.ISO_A2_EH || props.ISO_A2 || props.postal || props.iso_a2 || '').trim();
        const isoA3 = (props.ISO_A3_EH || props.ISO_A3 || props.iso_a3 || '').trim();
        const name = props.NAME || props.name || props.NAME_LONG || '';
        const id = isoA2 && isoA2 !== '-99' ? isoA2 : (isoA3 && isoA3 !== '-99' ? isoA3 : name);
        
        return {
          type: 'Feature',
          id: id,
          properties: {
            id: id,
            iso_a2: isoA2 !== '-99' ? isoA2 : null,
            iso_a3: isoA3 !== '-99' ? isoA3 : null,
            name: name,
            continent: props.CONTINENT || ''
          },
          geometry: f.geometry
        };
      });
      fs.writeFileSync(COUNTRIES_OUTPUT, JSON.stringify({ type: 'FeatureCollection', features: simplifiedCountries }));
      console.log(`Saved country boundaries to: ${COUNTRIES_OUTPUT}`);
    }

    // 2. Download/Load Subnational states (DE, US, GB, FR, IT, ES, CA, AU, BR, JP, CN, IN, RU, AT, CH)
    console.log('2/5. Loading subnational boundaries (Admin-1)...');
    let filteredSubdivisions = [];
    let needsSubdivisionsRegen = true;
    if (fs.existsSync(SUBDIVISIONS_OUTPUT)) {
      try {
        const data = JSON.parse(fs.readFileSync(SUBDIVISIONS_OUTPUT));
        filteredSubdivisions = data.features;
        // Verify that it contains states for a new country, e.g. FR or CH
        const countriesInCache = new Set(filteredSubdivisions.map(s => s.properties.country_id));
        if (countriesInCache.has('FR') && countriesInCache.has('CH')) {
          console.log('Using local cached subdivisions boundaries.');
          needsSubdivisionsRegen = false;
        }
      } catch (e) {
        console.warn('Failed to parse cached subdivisions, will regenerate.', e.message);
      }
    }

    if (needsSubdivisionsRegen) {
      console.log('Regenerating subdivisions boundaries...');
      let subdivisionsGeoJSON;
      const RAW_SUBDIVISIONS_CACHE = path.join(PUBLIC_DIR, 'ne_50m_admin_1_states_provinces.geojson');
      
      if (fs.existsSync(RAW_SUBDIVISIONS_CACHE)) {
        console.log('Using local cached raw subdivisions GeoJSON.');
        subdivisionsGeoJSON = JSON.parse(fs.readFileSync(RAW_SUBDIVISIONS_CACHE, 'utf8'));
      } else {
        console.log('Downloading subnational boundaries...');
        subdivisionsGeoJSON = await fetchJSON(SUBDIVISIONS_GEOJSON_URL);
        fs.writeFileSync(RAW_SUBDIVISIONS_CACHE, JSON.stringify(subdivisionsGeoJSON));
        console.log(`Saved raw subdivisions to: ${RAW_SUBDIVISIONS_CACHE}`);
      }

      filteredSubdivisions = subdivisionsGeoJSON.features
        .filter(f => {
          const props = f.properties || {};
          const countryId = getCountryIso2(props);
          return countryId && targetIso2.has(countryId);
        })
        .map(f => {
          const props = f.properties || {};
          const countryId = getCountryIso2(props);
          const id = props.iso_3166_2 || props.code_local || props.name;
          return {
            type: 'Feature',
            id: id,
            properties: {
              id: id,
              name: props.name_de || props.name || props.name_local || '',
              englishName: props.name || '',
              iso_3166_2: props.iso_3166_2 || null,
              country_id: countryId
            },
            geometry: f.geometry
          };
        });
      fs.writeFileSync(SUBDIVISIONS_OUTPUT, JSON.stringify({ type: 'FeatureCollection', features: filteredSubdivisions }));
      console.log(`Saved subdivisions boundaries to: ${SUBDIVISIONS_OUTPUT} (${filteredSubdivisions.length} states)`);
    }

    // 2b/5. Loading river line geometries (10m scale)
    console.log('2b/5. Loading river line geometries...');
    let riverFeatures = [];
    if (fs.existsSync(RIVERS_OUTPUT)) {
      console.log('Using local cached river geometries.');
      try {
        const data = JSON.parse(fs.readFileSync(RIVERS_OUTPUT));
        riverFeatures = data.features;
      } catch (err) {
        console.warn('Failed to parse cached rivers.json, will regenerate.', err.message);
      }
    }

    if (riverFeatures.length === 0) {
      console.log('Generating river geometries from Natural Earth...');
      const GLOBAL_RIVERS_CACHE = path.join(PUBLIC_DIR, 'ne_10m_rivers_global_raw.json');
      const EUROPE_RIVERS_CACHE = path.join(PUBLIC_DIR, 'ne_10m_rivers_europe_raw.json');
      
      let globalRivers;
      if (fs.existsSync(GLOBAL_RIVERS_CACHE)) {
        console.log('Using local cached global raw rivers.');
        globalRivers = JSON.parse(fs.readFileSync(GLOBAL_RIVERS_CACHE, 'utf8'));
      } else {
        console.log('Downloading global 10m rivers...');
        globalRivers = await fetchJSON(RIVERS_GLOBAL_URL);
        fs.writeFileSync(GLOBAL_RIVERS_CACHE, JSON.stringify(globalRivers));
      }
      
      let europeRivers;
      if (fs.existsSync(EUROPE_RIVERS_CACHE)) {
        console.log('Using local cached Europe raw rivers.');
        europeRivers = JSON.parse(fs.readFileSync(EUROPE_RIVERS_CACHE, 'utf8'));
      } else {
        console.log('Downloading Europe 10m rivers...');
        europeRivers = await fetchJSON(RIVERS_EUROPE_URL);
        fs.writeFileSync(EUROPE_RIVERS_CACHE, JSON.stringify(europeRivers));
      }
      
      const allRawFeatures = [...globalRivers.features, ...europeRivers.features];
      
      RIVERS_DATA.forEach(river => {
        const keys = NAME_MAP[river.name.toLowerCase()] || [river.name.toLowerCase()];
        const matchedRaw = allRawFeatures.filter(f => {
          const p = f.properties || {};
          const name = (p.name || '').toLowerCase();
          const nameAlt = (p.name_alt || '').toLowerCase();
          const nameEn = (p.name_en || '').toLowerCase();
          return keys.some(k => name === k || nameAlt === k || nameEn === k || name.startsWith(k + ' ') || name.endsWith(' ' + k));
        });
        
        matchedRaw.forEach(rawFeat => {
          riverFeatures.push({
            type: 'Feature',
            id: river.id,
            properties: {
              id: river.id,
              name: river.name,
              englishName: river.englishName
            },
            geometry: rawFeat.geometry
          });
        });
      });
      
      fs.writeFileSync(RIVERS_OUTPUT, JSON.stringify({ type: 'FeatureCollection', features: riverFeatures }));
      console.log(`Saved compiled river geometries to: ${RIVERS_OUTPUT} (${riverFeatures.length} segments)`);
    }

    // 3. Get rich metadata from REST Countries API
    console.log('3/5. Querying REST Countries API...');
    const restCountries = await fetchJSON(REST_COUNTRIES_URL);
    const countryMetadata = {};
    restCountries.forEach(c => {
      const iso2 = c.cca2;
      if (!iso2) return;
      
      const currencyCode = Object.keys(c.currencies || {})[0] || '';
      const currencyName = c.currencies?.[currencyCode]?.name || '';
      const currencySymbol = c.currencies?.[currencyCode]?.symbol || '';

      const rawCapital = c.capital?.[0] || 'N/A';
      const translatedCapital = CAPITAL_TRANSLATIONS[rawCapital] || rawCapital;

      countryMetadata[iso2] = {
        capital: translatedCapital,
        population: c.population || 0,
        area: c.area || 0,
        tld: c.tld?.[0] || 'N/A',
        callingCode: c.idd?.root ? `${c.idd.root}${c.idd.suffixes?.[0] || ''}` : 'N/A',
        timezones: c.timezones || [],
        flag: c.flag || '',
        currency: currencyName ? `${currencyName} (${currencySymbol || currencyCode})` : 'N/A',
        germanName: c.translations?.deu?.common || c.name.common
      };
    });

    // 4. Query Wikidata SPARQL for Heads of State, Government and Highest Peaks
    console.log('4/5. Querying Wikidata SPARQL endpoint...');
    const wikidataCountryQuery = `
      SELECT ?iso2 ?headOfStateLabel ?headOfGovLabel ?highestPointLabel ?highestPointElevation
      WHERE {
        ?country wdt:P31/wdt:P279* wd:Q3624078.
        ?country wdt:P297 ?iso2.
        OPTIONAL { ?country wdt:P35 ?headOfState. }
        OPTIONAL { ?country wdt:P6 ?headOfGov. }
        OPTIONAL { 
          ?country wdt:P610 ?highestPoint. 
          OPTIONAL { ?highestPoint wdt:P2044 ?highestPointElevation. }
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
      }
    `;

    const wikidataResults = {};
    try {
      const data = await fetchWikidata(wikidataCountryQuery);
      const bindings = data.results?.bindings || [];
      bindings.forEach(b => {
        const iso = b.iso2?.value;
        if (!iso) return;
        
        wikidataResults[iso] = {
          headOfState: b.headOfStateLabel?.value || null,
          headOfGov: b.headOfGovLabel?.value || null,
          highestPoint: b.highestPointLabel?.value || null,
          highestPointElevation: b.highestPointElevation?.value ? Math.round(parseFloat(b.highestPointElevation.value)) : null
        };
      });
      console.log(`Wikidata fetch complete! Found details for ${Object.keys(wikidataResults).length} countries.`);
    } catch (wikiErr) {
      console.warn('Wikidata SPARQL failed (timeout or offline). Using empty defaults for Wikidata fields.', wikiErr.message);
    }

    // 5. Load pre-fetched cities from wikidata_cities_raw.json or fallback
    console.log('5/5. Loading cities from wikidata_cities_raw.json...');
    const WIKIDATA_CITIES_RAW_PATH = path.join(DATA_DIR, 'wikidata_cities_raw.json');
    let countryCities = {};
    if (fs.existsSync(WIKIDATA_CITIES_RAW_PATH)) {
      try {
        countryCities = JSON.parse(fs.readFileSync(WIKIDATA_CITIES_RAW_PATH));
        console.log(`Loaded cities for ${Object.keys(countryCities).length} countries from cache.`);
      } catch (err) {
        console.warn('Failed to parse wikidata_cities_raw.json, will use static fallbacks.', err.message);
      }
    } else {
      console.warn('wikidata_cities_raw.json not found, using static fallbacks.');
    }

    // Static fallback list of largest cities for major countries in case SPARQL failed or timed out
    const staticCitiesFallback = {
      DE: [
        { name: "Berlin", population: 3750000 },
        { name: "Hamburg", population: 1900000 },
        { name: "München", population: 1500000 },
        { name: "Köln", population: 1100000 },
        { name: "Frankfurt am Main", population: 760000 },
        { name: "Stuttgart", population: 630000 },
        { name: "Düsseldorf", population: 620000 },
        { name: "Leipzig", population: 600000 },
        { name: "Dortmund", population: 590000 },
        { name: "Essen", population: 580000 }
      ],
      US: [
        { name: "New York City", population: 8330000 },
        { name: "Los Angeles", population: 3820000 },
        { name: "Chicago", population: 2660000 },
        { name: "Houston", population: 2300000 },
        { name: "Phoenix", population: 1640000 },
        { name: "Philadelphia", population: 1560000 },
        { name: "San Antonio", population: 1470000 },
        { name: "San Diego", population: 1380000 },
        { name: "Dallas", population: 1300000 },
        { name: "Jacksonville", population: 950000 }
      ],
      GB: [
        { name: "London", population: 8980000 },
        { name: "Birmingham", population: 1140000 },
        { name: "Glasgow", population: 630000 },
        { name: "Bristol", population: 460000 },
        { name: "Liverpool", population: 500000 },
        { name: "Sheffield", population: 580000 },
        { name: "Leeds", population: 790000 },
        { name: "Edinburgh", population: 520000 },
        { name: "Manchester", population: 550000 },
        { name: "Leicester", population: 350000 }
      ],
      FR: [
        { name: "Paris", population: 2160000 },
        { name: "Marseille", population: 860000 },
        { name: "Lyon", population: 520000 },
        { name: "Toulouse", population: 490000 },
        { name: "Nizza", population: 340000 },
        { name: "Nantes", population: 310000 },
        { name: "Straßburg", population: 280000 },
        { name: "Montpellier", population: 290000 },
        { name: "Bordeaux", population: 260000 },
        { name: "Lille", population: 230000 }
      ],
      IT: [
        { name: "Rom", population: 2870000 },
        { name: "Mailand", population: 1380000 },
        { name: "Neapel", population: 960000 },
        { name: "Turin", population: 870000 },
        { name: "Palermo", population: 660000 },
        { name: "Genua", population: 580000 },
        { name: "Bologna", population: 390000 },
        { name: "Florenz", population: 380000 },
        { name: "Bari", population: 320000 },
        { name: "Catania", population: 310000 }
      ],
      JP: [
        { name: "Tokio", population: 14000000 },
        { name: "Yokohama", population: 3770000 },
        { name: "Osaka", population: 2750000 },
        { name: "Nagoya", population: 2300000 },
        { name: "Sapporo", population: 1950000 },
        { name: "Kobe", population: 1520000 },
        { name: "Fukuoka", population: 1600000 },
        { name: "Kyoto", population: 1460000 },
        { name: "Kawasaki", population: 1540000 },
        { name: "Saitama", population: 1320000 }
      ],
      CN: [
        { name: "Shanghai", population: 26300000 },
        { name: "Peking", population: 21500000 },
        { name: "Chongqing", population: 16300000 },
        { name: "Tianjin", population: 13800000 },
        { name: "Guangzhou", population: 13200000 },
        { name: "Shenzhen", population: 12500000 },
        { name: "Chengdu", population: 11000000 },
        { name: "Nanjing", population: 8500000 },
        { name: "Wuhan", population: 8400000 },
        { name: "Xi'an", population: 8100000 }
      ],
      IN: [
        { name: "Mumbai", population: 12500000 },
        { name: "Delhi", population: 11000000 },
        { name: "Bangalore", population: 8400000 },
        { name: "Hyderabad", population: 6800000 },
        { name: "Ahmedabad", population: 5600000 },
        { name: "Chennai", population: 4600000 },
        { name: "Kolkata", population: 4500000 },
        { name: "Surat", population: 4500000 },
        { name: "Pune", population: 3100000 },
        { name: "Jaipur", population: 3000000 }
      ],
      EG: [
        { name: "Kairo", population: 9600000 },
        { name: "Alexandria", population: 5200000 },
        { name: "Gizeh", population: 4200000 },
        { name: "Shubra El-Kheima", population: 1100000 },
        { name: "Port Said", population: 750000 },
        { name: "Sues", population: 700000 },
        { name: "Luxor", population: 500000 },
        { name: "al-Mansura", population: 480000 },
        { name: "El-Mahalla El-Kubra", population: 460000 },
        { name: "Tanta", population: 420000 }
      ],
      PL: [
        { name: "Warschau", population: 1860000 },
        { name: "Krakau", population: 800000 },
        { name: "Breslau", population: 640000 },
        { name: "Lodz", population: 670000 },
        { name: "Posen", population: 530000 },
        { name: "Danzig", population: 470000 },
        { name: "Stettin", population: 400000 },
        { name: "Katowitz", population: 290000 }
      ],
      CH: [
        { name: "Zürich", population: 430000 },
        { name: "Genf", population: 200000 },
        { name: "Basel", population: 170000 },
        { name: "Bern", population: 130000 },
        { name: "Lausanne", population: 140000 },
        { name: "Winterthur", population: 110000 }
      ],
      AT: [
        { name: "Wien", population: 1900000 },
        { name: "Graz", population: 290000 },
        { name: "Linz", population: 200000 },
        { name: "Salzburg", population: 150000 },
        { name: "Innsbruck", population: 130000 }
      ],
      NL: [
        { name: "Amsterdam", population: 900000 },
        { name: "Rotterdam", population: 650000 },
        { name: "Den Haag", population: 540000 },
        { name: "Utrecht", population: 360000 },
        { name: "Eindhoven", population: 230000 }
      ],
      ES: [
        { name: "Madrid", population: 3300000 },
        { name: "Barcelona", population: 1600000 },
        { name: "Valencia", population: 790000 },
        { name: "Sevilla", population: 680000 },
        { name: "Saragossa", population: 670000 },
        { name: "Málaga", population: 570000 }
      ],
      RU: [
        { name: "Moskau", population: 13000000 },
        { name: "Sankt Petersburg", population: 5600000 },
        { name: "Nowosibirsk", population: 1600000 },
        { name: "Jekaterinburg", population: 1500000 },
        { name: "Nischni Nowgorod", population: 1200000 },
        { name: "Kasan", population: 1300000 }
      ],
      CA: [
        { name: "Toronto", population: 2790000 },
        { name: "Montreal", population: 1760000 },
        { name: "Vancouver", population: 662000 },
        { name: "Calgary", population: 1300000 },
        { name: "Ottawa", population: 1010000 },
        { name: "Edmonton", population: 1010000 }
      ],
      AU: [
        { name: "Sydney", population: 5300000 },
        { name: "Melbourne", population: 5000000 },
        { name: "Brisbane", population: 2600000 },
        { name: "Perth", population: 2100000 },
        { name: "Adelaide", population: 1400000 },
        { name: "Canberra", population: 430000 }
      ],
      BR: [
        { name: "São Paulo", population: 12300000 },
        { name: "Rio de Janeiro", population: 6700000 },
        { name: "Brasília", population: 3000000 },
        { name: "Salvador", population: 2900000 },
        { name: "Fortaleza", population: 2700000 },
        { name: "Belo Horizonte", population: 2500000 }
      ],
      MX: [
        { name: "Mexiko-Stadt", population: 9200000 },
        { name: "Guadalajara", population: 1400000 },
        { name: "Monterrey", population: 1100000 },
        { name: "Puebla", population: 1700000 },
        { name: "Tijuana", population: 1800000 }
      ]
    };

    // Merge all cities into citiesToProcess
    const citiesToProcess = {};
    
    // Start with raw cities from wikidata_cities_raw.json
    if (fs.existsSync(WIKIDATA_CITIES_RAW_PATH)) {
      try {
        const rawCitiesData = JSON.parse(fs.readFileSync(WIKIDATA_CITIES_RAW_PATH, 'utf8'));
        Object.keys(rawCitiesData).forEach(iso => {
          citiesToProcess[iso] = [...rawCitiesData[iso]];
        });
      } catch (err) {
        console.warn('Failed to parse wikidata_cities_raw.json', err.message);
      }
    }
    
    // Add static fallback cities if missing or sparse
    Object.keys(staticCitiesFallback).forEach(iso => {
      if (!citiesToProcess[iso] || citiesToProcess[iso].length < 5) {
        citiesToProcess[iso] = staticCitiesFallback[iso];
      }
    });
    
    // Ensure capitals are added for all countries
    simplifiedCountries.forEach(c => {
      const iso = c.properties.iso_a2;
      if (!iso) return;
      
      const meta = countryMetadata[iso] || {};
      const capital = meta.capital;
      
      if (!citiesToProcess[iso]) {
        citiesToProcess[iso] = [];
      }
      
      if (capital && capital !== 'N/A') {
        const hasCapital = citiesToProcess[iso].some(
          city => city.name.toLowerCase() === capital.toLowerCase()
        );
        if (!hasCapital) {
          citiesToProcess[iso].unshift({ name: capital, population: 0, isCapital: true });
        }
      }
      
      // Limit `countryCities` to 10 cities for country metadata
      countryCities[iso] = citiesToProcess[iso].slice(0, 10);
    });

    // Assemble final unified geodb.json
    console.log('Assembling expanded geodb.json...');
    
    const entities = {};
    
    // Process all country records
    simplifiedCountries.forEach(c => {
      const iso = c.properties.iso_a2;
      if (!iso) return;
      
      const meta = countryMetadata[iso] || {};
      const wiki = wikidataResults[iso] || {};
      const cities = countryCities[iso] || [];

      // Generate a dynamic description/facts about the country
      const facts = [
        `${meta.germanName || c.properties.name} hat eine Bevölkerung von ca. ${(meta.population / 1000000).toFixed(1)} Millionen Einwohnern auf einer Fläche von ${(meta.area || 0).toLocaleString('de-DE')} km².`,
        wiki.highestPoint ? `Der höchste Punkt des Landes ist der ${wiki.highestPoint}${wiki.highestPointElevation ? ` (${wiki.highestPointElevation} Meter über dem Meeresspiegel)` : ''}.` : null,
        wiki.headOfState ? `Das offizielle Staatsoberhaupt ist ${wiki.headOfState}${wiki.headOfGov ? ` und die Regierungsgeschäfte werden von ${wiki.headOfGov} geführt` : ''}.` : null,
        meta.currency ? `Die offizielle Währung ist ${meta.currency}.` : null
      ].filter(Boolean);

      entities[iso] = {
        id: iso,
        type: 'country',
        name: meta.germanName || c.properties.name,
        englishName: c.properties.name,
        coordinates: c.properties.coordinates || [0,0],
        metadata: {
          continent: c.properties.continent || 'N/A',
          capital: meta.capital || 'N/A',
          population: meta.population || 0,
          area: meta.area || 0,
          tld: meta.tld || 'N/A',
          callingCode: meta.callingCode || 'N/A',
          timezones: meta.timezones?.join(', ') || 'N/A',
          flag: meta.flag || '🏳️',
          currency: meta.currency || 'N/A',
          headOfState: wiki.headOfState || 'N/A',
          headOfGov: wiki.headOfGov || 'N/A',
          highestPoint: wiki.highestPoint || 'N/A',
          highestPointElevation: wiki.highestPointElevation || null,
          largestCities: cities
        },
        facts: facts.slice(0, 4) // Store up to 4 rich facts
      };
    });

    // Process all subnational state records
    filteredSubdivisions.forEach(s => {
      const id = s.properties.id;
      const countryId = s.properties.country_id;
      const countryEntity = entities[countryId];
      const countryName = countryEntity ? countryEntity.name : countryId;
      
      entities[id] = {
        id: id,
        type: 'state',
        name: s.properties.name,
        englishName: s.properties.englishName,
        metadata: {
          countryId: countryId,
          iso_3166_2: s.properties.iso_3166_2
        },
        facts: [
          `${s.properties.name} ist ein subnationales Gebiet (Bundesland/Bundesstaat/Region) in ${countryName}.`,
          `Im Quiz wird dieser Umriss unbeschriftet gezeigt, um deine regionalen Geografie-Kenntnisse zu testen.`
        ]
      };
    });

    // Process all city records
    Object.keys(citiesToProcess).forEach(countryId => {
      const cities = citiesToProcess[countryId] || [];
      const countryEntity = entities[countryId];
      const countryName = countryEntity ? countryEntity.name : countryId;
      const meta = countryMetadata[countryId] || {};
      const capital = meta.capital;

      cities.forEach(city => {
        const cityName = city.name;
        const cityPopulation = city.population || 0;
        const cityCoordinates = city.coordinates || [0,0];
        
        const isCapital = !!(capital && capital !== 'N/A' && (
          cityName.toLowerCase() === capital.toLowerCase() ||
          (cityName === 'Rom' && capital === 'Rome') ||
          (cityName === 'Wien' && capital === 'Vienna') ||
          (cityName === 'Warschau' && capital === 'Warsaw') ||
          (cityName === 'Prag' && capital === 'Prague') ||
          (cityName === 'Kopenhagen' && capital === 'Copenhagen') ||
          (cityName === 'Lissabon' && capital === 'Lisbon') ||
          (cityName === 'Athen' && capital === 'Athens') ||
          (cityName === 'Brüssel' && capital === 'Brussels') ||
          (cityName === 'Bukarest' && capital === 'Bucharest') ||
          (cityName === 'Moskau' && capital === 'Moscow') ||
          (cityName === 'Peking' && capital === 'Beijing') ||
          (cityName === 'Neu-Delhi' && capital === 'New Delhi') ||
          (cityName === 'Kairo' && capital === 'Cairo') ||
          (cityName === 'Bern' && capital === 'Bern')
        )) || city.isCapital === true;

        const cityId = `city_${countryId}_${slugify(cityName)}`;
        
        // Skip duplicate or smaller population duplicate cities to prevent ID collisions
        if (entities[cityId]) {
          if (cityPopulation <= entities[cityId].population) {
            return;
          }
        }

        const facts = [
          `${cityName} ist eine Stadt in ${countryName}${isCapital ? ' und die Hauptstadt des Landes' : ''}.`,
          cityPopulation > 0 ? `Sie hat eine Bevölkerung von ca. ${cityPopulation.toLocaleString('de-DE')} Einwohnern.` : `Sie gehört zu den bedeutenden Orten in diesem Land.`
        ];

        entities[cityId] = {
          id: cityId,
          type: 'city',
          name: cityName,
          population: cityPopulation,
          coordinates: cityCoordinates,
          metadata: {
            countryId: countryId,
            isCapital: isCapital
          },
          facts: facts
        };
      });
    });

    // Process all river records
    console.log('Injecting river entities into database...');
    RIVERS_DATA.forEach(r => {
      // Find coordinates of first country as fallback
      const countryId = r.countries[0];
      const coords = entities[countryId] ? entities[countryId].coordinates : [0, 0];
      
      entities[r.id] = {
        id: r.id,
        type: 'river',
        name: r.name,
        englishName: r.englishName,
        coordinates: coords,
        metadata: {
          countries: r.countries,
          mouth: r.mouth,
          lengthKm: r.lengthKm
        },
        facts: r.facts
      };
    });

    fs.writeFileSync(GEODB_OUTPUT, JSON.stringify({ entities }, null, 2));
    console.log(`Saved expanded encyclopedic geodb.json to: ${GEODB_OUTPUT}`);
    console.log('--- DATA PIPELINE COMPLETE ---');

  } catch (err) {
    console.error('Error running ETL compiler:', err);
    process.exit(1);
  }
}

run();
