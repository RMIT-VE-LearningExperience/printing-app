const test = require("node:test");
const assert = require("node:assert/strict");
const { storagePathForBucket, auditLegacyImageReferences, reportDisabledCleanup } = require("../lib/imageReferenceAudit");

const bucketName = "shared.firebasestorage.app";
const imageUrl = (path, bucket = bucketName) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=example`;

test("matches the exact bucket and complete object path", () => {
  assert.equal(storagePathForBucket(imageUrl("papers/p/thumbnail"), bucketName), "papers/p/thumbnail");
  assert.equal(storagePathForBucket(imageUrl("papers/p/thumbnail-extra"), bucketName), "papers/p/thumbnail-extra");
  assert.equal(storagePathForBucket(imageUrl("papers/p/thumbnail", "foreign-bucket"), bucketName), null);
  assert.equal(storagePathForBucket("https://firebasestorage.googleapis.com.evil.example/v0/b/shared.firebasestorage.app/o/a", bucketName), null);
  assert.equal(storagePathForBucket("https://firebasestorage.googleapis.com/v0/b/shared.firebasestorage.app/o/%invalid", bucketName), null);
  assert.equal(storagePathForBucket("data:image/png;base64,abc", bucketName), null);
});

const quietLogger = { log() {}, warn() {} };
function databaseFixture(data) {
  const reads = [];
  const collection = (path) => ({
    async get() {
      reads.push(path);
      return {
        docs: (data[path] || []).map(([id, value]) => ({
          data: () => value,
          ref: { collection: (name) => collection(`${path}/${id}/${name}`) },
        })),
      };
    },
  });
  return { db: { collection }, reads };
}

test("audit reads global and legacy nested references without listing storage or accessing the orphan queue", async () => {
  const { db, reads } = databaseFixture({
    printers: [["printer", { thumbnailDataUrl: imageUrl("printers/printer/thumbnail") }]],
    "printers/printer/papers": [["paper", { thumbnailDataUrl: imageUrl("papers/paper/thumbnail") }]],
    "printers/printer/papers/paper/colours": [["colour", {}]],
    "printers/printer/papers/paper/colours/colour/steps": [["step", { imageDataUrl: imageUrl("legacy/step/image") }]],
    papers: [["paper", { thumbnailDataUrl: imageUrl("papers/paper/thumbnail") }]],
    "papers/paper/colours": [["colour", { thumbnailDataUrl: imageUrl("foreign/image", "other") }]],
    "papers/paper/colours/colour/steps": [["step", { imageDataUrl: imageUrl("papers/paper/colours/colour/steps/step/image") }]],
  });
  const checked = [];
  const bucket = {
    name: bucketName,
    file(path) {
      checked.push(path);
      return { async exists() { return [path !== "legacy/step/image"]; } };
    },
  };
  const report = await auditLegacyImageReferences(db, bucket, quietLogger);
  assert.deepEqual(report, { referenced: 4, existing: 3, missing: ["legacy/step/image"] });
  assert.deepEqual(checked, ["printers/printer/thumbnail", "papers/paper/thumbnail", "legacy/step/image", "papers/paper/colours/colour/steps/step/image"]);
  assert.equal(reads.some((path) => path.includes("orphanedStorageFiles")), false);
});

test("audit fails on storage errors instead of declaring missing images", async () => {
  const { db } = databaseFixture({ papers: [["p", { thumbnailDataUrl: imageUrl("papers/p/thumbnail") }]] });
  const bucket = { name: bucketName, file() { return { async exists() { throw new Error("permission denied"); } }; } };
  await assert.rejects(auditLegacyImageReferences(db, bucket, quietLogger), /permission denied/);
});

test("disabled cleanup only logs and needs no database or storage access", () => {
  const warnings = [];
  reportDisabledCleanup({ log() {}, warn(message) { warnings.push(message); } });
  assert.match(warnings[0], /deletion is disabled/);
});
