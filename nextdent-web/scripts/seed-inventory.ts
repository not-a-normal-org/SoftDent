/**
 * Seed the chamber inventory catalogue: the clinic's own "chamber inventory" list,
 * ~345 lines under eight headings, typed up in Word by the Barishal staff, which come
 * out as 340 distinct items once the handful listed twice are folded together.
 *
 * Why the list is embedded below instead of read from the .docx: the document is a
 * one-off handover, the repository has no Word parser, and a seed that silently does
 * nothing when a file is missing is worse than one that always seeds the same thing.
 * Set INVENTORY_TXT to re-run against a fresh plain-text extraction instead.
 *
 * SAFE TO RE-RUN. The Product table already holds 134 rows imported from the legacy
 * Access database, and some of those are the same items under slightly different
 * spellings, so matching is by name — trimmed, whitespace-collapsed, case-insensitive
 * — and an existing row is never duplicated. Quantities and prices are the clinic's
 * real counts and are never written: a new product starts at quantity 0, and an
 * existing one keeps whatever it has. The only thing an existing row can gain is a
 * category, and only when it has none.
 *
 * Medicine's six sub-headings have no column to live in — Product.category is a
 * single string — so they are composed into it as "Medicine / Antibiotics". The
 * category Combo on /inventory sorts and searches them as ordinary categories, and
 * the prefix groups them.
 *
 * Run: node --env-file=.env ./node_modules/.bin/tsx scripts/seed-inventory.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

/** The eight top-level headings. Anything else ending in ":" is a sub-heading. */
const TOP_LEVEL = [
  "Accessories",
  "Oral maxillofacial surgery",
  "Implant instruments",
  "Orthodontics",
  "Prosthodontics",
  "Conservative and endodontic",
  "Periodontology",
  "Medicine",
];

// Plain-text extraction of "chamber inventory.docx", trailing spaces stripped. Data,
// not code — the spellings, the double spaces inside a name and the stray numbering
// are the staff's, and the parser below is what has to cope with them.
const DOCUMENT = String.raw`

Accessories:
Prescription pad
Battery
Visiting card
Pen
Patient file
Pocket file
Tissue box
Diary
Paper
Patient card
Chocolate
Bucke
Ligh
Calling bell
  Multi plug
Stapler
Stapler pin
Note book
Glass
Polyethylene
Battery water
cyDex
filter
shoe
savlon
hand wash
vim
harpic
brush
air freshener
white Kham
evening snakes
cup prices spoon and others
soap
bed shee
doctors dress
apron
head cap
gloves
wheel powder
aerosol
glass cleaner
towel
jharu
electric jar
mura
tree
watch
board
scissor
cleaning foam
box
slip pad
hand file
Oral maxillofacial surgery:
curette
cautery  tips (no 7)
surgical sponge
absorbable gel
silk 3-0
silk 4-0
prolin 4-0
prolin  5-0
vikryl 3-0
vikryl 5-0
bone wax
metallic suction 6
metallic suction  8
metallic suction  10
metallic suction 12
Periosteal elevator
Needle holder
Angular  elevators
Cryer elevator
Needle long
Needle shor
 baby needle
Surgical fissure burs HP 702
Surgical fissure burs HP 703
Surgical fissure burs SSW HP 701
Surgical fissure TC HTP
TC round bur FG4
Carbide fissure bur HP 702 MICRO motor
Carbide bur FG 4 for micro motor
Carbide bur HP-8 for micro motor
Piezo surgical device
Peso surgical tips SG5
Peso surgical tips SG11
Peso surgical tips HSG1
Peso surgical tips SG 3
Peso surgical tipsSD7D
Peso surgical tips SG18L
Peso surgical tips SGF SG6D
Peso surgical tips HSG1
Peso surgical tipsE30LD
Peso surgical tips E30RD
Surgical bur 28 mm
Surgical long round TC
BP blade 12
BP blade 13
BP blade 15
BP handle 3
BP handle  7
BP handle 10
BP handle 13
Butterfly needle
Micro mirror
Rectangular mirror
PRF tray
Vaccutainer
Centrifugal  machine
Tooth forceps
Plain forceps
Alis tissue forceps
Artery forceps long
Artery forceps medium
 Artery forceps shor
Aristocrat forceps
Tongue depressor
Bone file
Upper anterior forceps
Upper molar forceps
Upper 3rd molar forceps
Root forceps
Lower anterior forceps
Lower molar forceps
lower 3rd molar forceps
baby upper anterior forceps
baby lower anterior forceps
baby molar forceps
gully po
angular elevator
straight elevators
straight root elevators



Implant instruments:
Fixure
Healing abutmen
Cover screw
Hex
Impression coping
Lab analos
Surgical implant drill kits (    )



Orthodontics:
cheek retractor
distal end cutter TC
bracket GAUGE
Ni Ti open spring
Lingual button
Roth metal brackets
Torque roth brackets
Straight shooter
Distal end cutter 200
Molar band
TMI 1023( rectangular Arch bending)
Sure endo (disposable tips)
Band pusher
dDistal end cutter
Hard wire cutter
Bracket height gauge
Band seater pliers
Three jaw plier
Separating plier
Wire cutter
Loop forming plier
Bite paper holder
Wire twister
Orthodontic relief wax
Bondable buccal tube
Turre
Band removing plier
Bracket removing plier
Tweed plier 1set (2pcs)
Hows plier
0.16 ss lower
0.16 ss upper
0.17 x 0.025 ss upper
0.17 x 0.025 ss lower
0.14 ss lower
0.14 ss upper
0.17 x 0.025 NiTi lower
0.17 x 0.025 NiTi upper
0.14 NiTi lower
0.14 NiTi upper
0.012 NiTi upper
0,012 NiTi lower
0.016 NiTi upper
0.016 NiTi lower
 Elastics
Moose elastic
Penguin elastic
Rabbit elastic
Impala elastic
ligature wire
light cure adhesive primer
light cure adhesive paste
priming brush
power chain shor
power chain continuous
elastomer
LA cartridge
etching gel
ultra chain filament 15 FT (Short and Continuous)
power chain short and continuous



Prosthodontics:

Rubber bowel
Plastic Spatula
Metallic spatula
Alginate
Elastomer
Gun
Impression tray plastic
Perforated tray
Wax curver
Hard plaster
Ordinary plaster


          Conservative and endodontic:
Hand file
K file (21 mm)
K file (25 mm)
H-file (21 mm)
H-file (25 mm)
D-Finder File (21 mm)
D-Finder File (25 mm)
Endo file
Orifice opener
Glyde path file
4% Tapering File
6% Tapering File
XP File
Micro motor
Protaper file
Other files
Endo activator
Sonic activator
Ultra sonic activator
GP gun
GP pen
LIGHT
Floss
Articulating paper
Temporary filling
Composite filing
Bonding
Priming
Bonding brush
Cotton bud
Cotton roll
Crown cutting instrumen
VISCOS
Apex locater
Polishing material
Polishing disk
Polishing burs
Polishing brush
Polishing paste
Acrylic contouring and polishing kits
Bite paper holder
Caries probe
Periodontal probe
Excavator
Plastic mirror
Tweezers
Metallic syringe
Cartage
Local vial
Coe pack
Glycoside gel
MTA
MTA gun spatula
Glass slab
MTA plugger
Scalar tips
Scalar machine
Plastic suction tips for rubber dam
 Rubber dam
Liquid dam
Rubber dam accessories
Vaseline
Different burs
Covers
Plastic rapper
Micro pore
Teflon
Hypo
H2O2
EDTA
EDTA gel
Hexisol
Saline
DA 5%
Chx
Chx gel
Viodin
Disposable Syringe
Depluming
Clove oil
Ressasinol
I oil
I clean
Eugenol
GP solven
Scale
Gutta purcha
Paper poin
I root sealer
MC sealer
Mixing pad
MTA gun carrier
MTA powder
Plugger
  New scalar and polishing machine
Metallic pos
Plastic pos
Post and core instruments

Periodontology:
Perioprobe
Coe pack
Gingival gel
Resasinol


Medicine:
Antibiotics:
Filmet 400mg
Moxaclav 650mg
Moxaclav 1gm
Zox 500zimax 500 mg
Adora 1000mg
Amodis 400 mg
Clindacyn 300mg
Cef-3 200mg
Amoxicillin BP 500mg

Pain killers:
1. Tory 60 mg
2. Mervan
3.flamex 400mg
4. napro-A 500mg
5.Flexi 100mg
6. zolfin
7. Napa 500mg
8.Clofenac SR
9. reservix
10.xidolac 10mg
11.etorac 10mg
12. voltalin 50 mg supp
Injectable medicine:
Rolac 30mg
Gentin 80mg
Torax 30mg
Promethazine
Roxadex
Traxyl 500mg
Cannula 20 G
Winop 30mg


Antiulcerant:
Rabe 20 mg
Steroid:
Dexamethasone 0.5 mg

Others:
1. colazipum 0.5 mg






`;

export type SeedItem = { category: string; subcategory?: string; name: string };

/** Trimmed, whitespace-collapsed, lower-cased — the key two spellings must share. */
const key = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Drop a leading list number. The lookahead is the whole point: the pain-killer list
 * is numbered "1." … "12.", but the orthodontic wires are named "0.16 ss lower" and
 * "0.012 NiTi upper", so the dot may only be stripped when a non-digit follows it.
 */
const stripNumbering = (line: string) => line.replace(/^\d{1,2}\s*[.)]\s*(?=\D)/, "");

export function parseInventory(text: string): SeedItem[] {
  const top = new Set(TOP_LEVEL.map((t) => t.toLowerCase()));
  const out: SeedItem[] = [];
  const seen = new Set<string>();
  let category: string | null = null;
  let subcategory: string | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.endsWith(":")) {
      const heading = line.slice(0, -1).trim().replace(/\s+/g, " ");
      if (top.has(heading.toLowerCase())) { category = heading; subcategory = undefined; }
      else subcategory = heading; // Medicine's Antibiotics / Pain killers / …
      continue;
    }

    if (!category) continue; // nothing before the first heading
    const name = stripNumbering(line).replace(/\s+/g, " ").trim();
    if (!name) continue;
    // The same item is listed under two headings a few times ("Coe pack" sits under
    // both Conservative and Periodontology). First heading wins — one product row.
    if (seen.has(key(name))) continue;
    seen.add(key(name));
    out.push({ category, subcategory, name });
  }
  return out;
}

/** Product.category has no room for a second level, so the two are composed. */
export const categoryOf = (it: SeedItem) =>
  it.subcategory ? `${it.category} / ${it.subcategory}` : it.category;

async function main() {
  const text = process.env.INVENTORY_TXT ? readFileSync(process.env.INVENTORY_TXT, "utf8") : DOCUMENT;
  const items = parseInventory(text);
  console.log(`Parsed ${items.length} items in ${new Set(items.map(categoryOf)).size} categories.`);

  // DRY=1 prints the parse and touches nothing — worth having, because a parser that
  // mangles a name creates a near-duplicate product no later run can tidy up.
  if (process.env.DRY === "1") {
    for (const it of items) console.log(`  ${categoryOf(it)}\t${it.name}`);
    return;
  }

  // Keep the category Combo on /inventory offering every heading, even one whose
  // items all turned out to exist already.
  for (const name of [...new Set(items.map(categoryOf))].sort())
    await prisma.productCategory.upsert({ where: { name }, update: {}, create: { name } });

  const existing = await prisma.product.findMany({ select: { id: true, name: true, category: true } });
  const byName = new Map(existing.map((p) => [key(p.name), p]));
  console.log(`${existing.length} products already in the database.`);

  let created = 0, updated = 0, skipped = 0;
  for (const it of items) {
    const category = categoryOf(it);
    const hit = byName.get(key(it.name));
    if (!hit) {
      // No quantity and no price: the document lists what the chamber stocks, not how
      // much of it is on the shelf. Staff count it in through Receive on /inventory.
      const p = await prisma.product.create({ data: { name: it.name, category, quantity: 0, reorderLevel: 0, unitPrice: 0 } });
      byName.set(key(it.name), { id: p.id, name: p.name, category: p.category });
      created++;
    } else if (!hit.category?.trim()) {
      await prisma.product.update({ where: { id: hit.id }, data: { category } });
      updated++;
    } else {
      // Already filed, possibly under a category the clinic chose itself — leave it.
      skipped++;
    }
  }

  console.log(`created=${created} updated=${updated} skipped=${skipped}`);
  console.log(`Product table now holds ${await prisma.product.count()} rows.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
