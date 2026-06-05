// Usage: npm run seed-items:staging
// Seeds all Type, Content, and Team items + relationships to Firestore staging.
// Run AFTER seed-content:staging (hierarchy config must exist first).

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");

function loadCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      const sa = JSON.parse(readFileSync(credPath, "utf-8"));
      return cert(sa);
    } catch (err) {
      console.error("Failed to load service account:", err.message);
      process.exit(1);
    }
  }

  console.error("No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS in .env.staging.local.");
  process.exit(1);
}

const app = initializeApp({ credential: loadCredential() });
const databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";
const db = getFirestore(app, databaseId);

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

function itemData(name, description = "") {
  return {
    name,
    description,
    thumbnailUrl: "",
    slug: slug(name),
    published: true,
    createdAt: FieldValue.serverTimestamp(),
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: "seed",
  };
}

function relData(childLevelId, order) {
  return { childLevelId, published: true, order };
}

async function seedItems() {
  console.log(`\nSeeding items to "${databaseId}" database...\n`);

  const typesCol    = db.collection("items").doc("level_1").collection("items");
  const contentsCol = db.collection("items").doc("level_2").collection("items");
  const teamsCol    = db.collection("items").doc("level_3").collection("items");
  const links       = (key) => db.collection("links").doc(key).collection("children");

  // ── Level 1: Types ──────────────────────────────────────────────────────────
  const typeCC  = typesCol.doc();
  const typeLE  = typesCol.doc();

  await typeCC.set(itemData("Competency, Currency & PD"));
  console.log(`  ✓ Type: Competency, Currency & PD  (${typeCC.id})`);

  await typeLE.set(itemData("Learning Experience"));
  console.log(`  ✓ Type: Learning Experience  (${typeLE.id})`);

  // ── Level 2: Contents ───────────────────────────────────────────────────────
  const contentTSS  = contentsCol.doc();
  const contentPD   = contentsCol.doc();
  const contentPATH = contentsCol.doc();

  await contentTSS.set(itemData("TSS"));
  console.log(`  ✓ Content: TSS  (${contentTSS.id})`);

  await contentPD.set(itemData("PD"));
  console.log(`  ✓ Content: PD  (${contentPD.id})`);

  await contentPATH.set(itemData("PATH"));
  console.log(`  ✓ Content: PATH  (${contentPATH.id})`);

  // ── Level 1 → Level 2 relationships ─────────────────────────────────────────
  await links(typeCC.id).doc(contentTSS.id).set(relData("level_2", 0));
  await links(typeCC.id).doc(contentPD.id).set(relData("level_2", 1));
  console.log("  ✓ Linked: Competency, Currency & PD → TSS, PD");

  await links(typeLE.id).doc(contentPATH.id).set(relData("level_2", 0));
  console.log("  ✓ Linked: Learning Experience → PATH");

  // ── Level 3: Teams ──────────────────────────────────────────────────────────

  // Under TSS
  const teamTSS_TC    = teamsCol.doc();
  const teamTSS_DMD   = teamsCol.doc();
  const teamTSS_Other = teamsCol.doc();

  await teamTSS_TC.set(itemData("Teacher Capability"));
  await teamTSS_DMD.set(itemData("Digital Media Designers"));
  await teamTSS_Other.set(itemData("Other"));
  console.log("  ✓ Teams: Teacher Capability, Digital Media Designers, Other  [under TSS]");

  // Under PD
  const teamPD_PARF = teamsCol.doc();
  await teamPD_PARF.set(itemData("PD Application Request Flow"));
  console.log("  ✓ Team: PD Application Request Flow  [under PD]");

  // Under PATH
  const teamPATH_Staff  = teamsCol.doc();
  const teamPATH_DMD    = teamsCol.doc();
  const teamPATH_Other  = teamsCol.doc();

  await teamPATH_Staff.set(itemData("Staff"));
  await teamPATH_DMD.set(itemData("Digital Media Designers"));
  await teamPATH_Other.set(itemData("Other"));
  console.log("  ✓ Teams: Staff, Digital Media Designers, Other  [under PATH]");

  // ── Level 2 → Level 3 relationships (composite keys: typeId:contentId) ──────

  // Competency, Currency & PD → TSS → teams
  const keyCC_TSS = `${typeCC.id}:${contentTSS.id}`;
  await links(keyCC_TSS).doc(teamTSS_TC.id).set(relData("level_3", 0));
  await links(keyCC_TSS).doc(teamTSS_DMD.id).set(relData("level_3", 1));
  await links(keyCC_TSS).doc(teamTSS_Other.id).set(relData("level_3", 2));
  console.log("  ✓ Linked TSS teams");

  // Competency, Currency & PD → PD → teams
  const keyCC_PD = `${typeCC.id}:${contentPD.id}`;
  await links(keyCC_PD).doc(teamPD_PARF.id).set(relData("level_3", 0));
  console.log("  ✓ Linked PD teams");

  // Learning Experience → PATH → teams
  const keyLE_PATH = `${typeLE.id}:${contentPATH.id}`;
  await links(keyLE_PATH).doc(teamPATH_Staff.id).set(relData("level_3", 0));
  await links(keyLE_PATH).doc(teamPATH_DMD.id).set(relData("level_3", 1));
  await links(keyLE_PATH).doc(teamPATH_Other.id).set(relData("level_3", 2));
  console.log("  ✓ Linked PATH teams");

  console.log("\nAll items seeded. Steps can now be added via the CMS admin.\n");
  process.exit(0);
}

seedItems().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
