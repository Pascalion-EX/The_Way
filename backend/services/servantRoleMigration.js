// Legacy names belong only in this migration; application code uses servant.
const legacyRole = /^leader$/i;
const legacyApplicantFields = { leaderName: "servantName", leaderRole: "servantRole" };

export class ServantRoleMigrationError extends Error {}

function renameRoles(roles) {
  const values = Array.isArray(roles) ? roles : [roles];
  if (values.some((role) => typeof role !== "string")) {
    throw new ServantRoleMigrationError("A legacy role record contains non-text roles. Resolve it before applying the migration.");
  }
  return [...new Set(values.map((role) => legacyRole.test(role) ? "servant" : role))];
}

function renameApplicants(applicants) {
  if (!Array.isArray(applicants)) {
    throw new ServantRoleMigrationError("A legacy camp has an invalid applicants field. Resolve it before applying the migration.");
  }
  return applicants.map((applicant) => {
    const updated = { ...applicant };
    if (legacyRole.test(updated.applicationType)) updated.applicationType = "servant";
    for (const [oldField, newField] of Object.entries(legacyApplicantFields)) {
      if (!Object.hasOwn(updated, oldField)) continue;
      const oldValue = updated[oldField];
      const newValue = updated[newField];
      const hasValue = (value) => value !== undefined && value !== null && value !== "";
      if (hasValue(oldValue) && hasValue(newValue) && oldValue !== newValue) {
        throw new ServantRoleMigrationError("A camp applicant has conflicting legacy and servant details. Resolve the conflict before applying the migration.");
      }
      if (!hasValue(newValue)) updated[newField] = oldValue;
      delete updated[oldField];
    }
    return updated;
  });
}

function migrationGroups(collections) {
  return [
    { name: "users", collection: collections.users, field: "role", filter: { role: legacyRole }, rename: renameRoles },
    { name: "notifications", collection: collections.notifications, field: "targetRoles", filter: { targetRoles: legacyRole }, rename: renameRoles },
    { name: "camps", collection: collections.camps, field: "applicants", filter: { $or: [
      { "applicants.applicationType": legacyRole },
      ...Object.keys(legacyApplicantFields).map((field) => ({ [`applicants.${field}`]: { $exists: true } })),
    ] }, rename: renameApplicants },
  ];
}

export async function migrateServantRole(collections, { apply = false } = {}) {
  const groups = migrationGroups(collections);
  const planned = {};
  const modified = {};

  // Check every affected record for conflicts before the first write. Only
  // counts leave this function; names, contact details, and secrets stay private.
  for (const group of groups) {
    planned[group.name] = 0;
    modified[group.name] = 0;
    for await (const document of group.collection.find(group.filter, { projection: { [group.field]: 1 } })) {
      group.rename(document[group.field]);
      planned[group.name]++;
    }
  }
  if (!apply) return { mode: "dry-run", planned, modified };

  // Use raw collections so the new schema cannot hide the old applicant keys.
  // Compare the original field to avoid overwriting a concurrent modification.
  // Each document is atomic; an interrupted run can safely be run again.
  for (const group of groups) {
    for await (const document of group.collection.find(group.filter, { projection: { [group.field]: 1 } })) {
      const result = await group.collection.updateOne(
        { _id: document._id, [group.field]: document[group.field] },
        { $set: { [group.field]: group.rename(document[group.field]) } },
      );
      if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
        throw new ServantRoleMigrationError("A record changed during migration. Keep application writes stopped, then rerun the dry run and apply steps.");
      }
      modified[group.name]++;
    }
  }
  const remaining = {};
  for (const group of groups) remaining[group.name] = await group.collection.countDocuments(group.filter);
  if (Object.values(remaining).some((count) => count !== 0)) {
    throw new ServantRoleMigrationError("Legacy records remain. Keep application writes stopped, then rerun the dry run and apply steps.");
  }
  return { mode: "apply", planned, modified, remaining };
}
