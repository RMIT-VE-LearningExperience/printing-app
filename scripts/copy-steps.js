// Usage: npm run copy-steps:staging
// Copies all steps from CC&PD > TSS > Full Process
// into CC&PD > TSS > Teacher Capability AND CC&PD > TSS > Digital Media Designers.

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");

function loadCredential() {
  const projectId  = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return cert({ projectId, clientEmail, privateKey });

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try { return cert(JSON.parse(readFileSync(credPath, "utf-8"))); }
    catch (err) { console.error("Failed to load service account:", err.message); process.exit(1); }
  }
  console.error("No credentials found."); process.exit(1);
}

const app = initializeApp({ credential: loadCredential() });
const databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";
const db = getFirestore(app, databaseId);

const itemsCol = (levelId) => db.collection("items").doc(levelId).collection("items");
const linksCol = (key)     => db.collection("links").doc(key).collection("children");
const stepsCol = (itemId)  => db.collection("steps").doc(itemId).collection("items");

async function findItemByName(levelId, name) {
  const snap = await itemsCol(levelId).where("name", "==", name).limit(1).get();
  if (snap.empty) throw new Error(`Item "${name}" not found in level ${levelId}`);
  return snap.docs[0].id;
}

async function findLinkedItemByName(compositeKey, levelId, name) {
  const snap = await linksCol(compositeKey).get();
  for (const doc of snap.docs) {
    const itemSnap = await itemsCol(levelId).doc(doc.id).get();
    if ((itemSnap.data()?.name) === name) return doc.id;
  }
  throw new Error(`Linked item "${name}" not found under key "${compositeKey}"`);
}

async function copySteps(sourceId, targetId, label) {
  const snap = await stepsCol(sourceId).orderBy("order").get();
  if (snap.empty) { console.log(`  ⚠  No steps found on source "${label}" — nothing copied.`); return; }

  let copied = 0;
  for (const doc of snap.docs) {
    const step = doc.data();
    const ref  = stepsCol(targetId).doc();
    await ref.set({
      title:       step.title       ?? "",
      contentHtml: step.contentHtml ?? "",
      imageUrl:    step.imageUrl    ?? "",
      videoUrl:    step.videoUrl    ?? "",
      order:       step.order       ?? copied,
      createdAt:   FieldValue.serverTimestamp(),
      lastModified: FieldValue.serverTimestamp(),
      modifiedBy:  "copy-steps-script",
    });
    copied++;
  }
  console.log(`  ✓ Copied ${copied} step(s) → ${label}`);
}

async function main() {
  console.log(`\nRunning on "${databaseId}" database...\n`);

  // 1. Locate Competency, Currency & PD (level_1)
  const typeCCId = await findItemByName("level_1", "Competency, Currency & PD");
  console.log(`  Found Type: Competency, Currency & PD  (${typeCCId})`);

  // 2. Locate TSS (level_2) linked from that Type
  const tssId = await findLinkedItemByName(typeCCId, "level_2", "TSS");
  console.log(`  Found Content: TSS  (${tssId})`);

  // 3. Composite key for the TSS branch
  const compositeKey = `${typeCCId}:${tssId}`;

  // 4. Locate the three Team items under TSS
  const sourceId = await findLinkedItemByName(compositeKey, "level_3", "Full Process");
  const tcId     = await findLinkedItemByName(compositeKey, "level_3", "Teacher Capability");
  const dmdId    = await findLinkedItemByName(compositeKey, "level_3", "Digital Media Designers");

  console.log(`  Found Team (source):  Full Process           (${sourceId})`);
  console.log(`  Found Team (target 1): Teacher Capability    (${tcId})`);
  console.log(`  Found Team (target 2): Digital Media Designers (${dmdId})\n`);

  // 5. Copy steps
  await copySteps(sourceId, tcId,  "Teacher Capability");
  await copySteps(sourceId, dmdId, "Digital Media Designers");

  console.log("\nDone.\n");
  process.exit(0);
}

main().catch((err) => { console.error("Script failed:", err.message); process.exit(1); });
