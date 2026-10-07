/**
 * MRJ auth progress helpers (browser + Node tests).
 * Program: firefighter-spelling
 */

export const PROGRAM = "firefighter-spelling";

export function idKey(id) {
  return String(id == null ? "" : id)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function recordsStorageKey(studentId) {
  const key = idKey(studentId);
  return key ? `mrj.firefighter_spelling.records.${key}` : "mrj.firefighter_spelling.records";
}

export const LEGACY_RECORDS_KEY = "mrj.firefighter_spelling.records";

export function recordsMigrationMarkerKey(studentId) {
  const key = idKey(studentId);
  return key
    ? `mrj.firefighter_spelling.records_legacy_migrated.${key}`
    : "mrj.firefighter_spelling.records_legacy_migrated";
}

export function customWordsStorageKey(studentId) {
  const key = idKey(studentId);
  return key
    ? `mrj.firefighter_spelling.custom_words.${key}`
    : "mrj.firefighter_spelling.custom_words";
}

export const LEGACY_CUSTOM_KEY = "mrj.firefighter_spelling.custom_words";

export function itemPassed(row) {
  const raw =
    row.scoreValue != null ? row.scoreValue : row.score != null ? row.score : row.scorePct;
  const num =
    typeof raw === "number" ? raw : parseFloat(String(raw == null ? "" : raw).split("/")[0]);
  const max = row.scoreMax != null ? Number(row.scoreMax) : NaN;
  const pct = row.scorePct != null ? Number(row.scorePct) : NaN;
  if (Number.isFinite(pct)) return pct >= 100;
  if (Number.isFinite(max) && max > 0 && Number.isFinite(num)) return num >= max;
  return Number.isFinite(num) && num > 0;
}

export function rowProgram(row) {
  return String(row.program || row.curriculum_program || "").trim();
}

export function rowItemId(row) {
  return String(row.itemId || row.item_id || row.item || "").trim();
}

export function numericScore(row) {
  const pct = row.scorePct != null ? Number(row.scorePct) : NaN;
  if (Number.isFinite(pct)) return pct;
  const raw =
    row.scoreValue != null ? row.scoreValue : row.score != null ? row.score : NaN;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw == null ? "" : raw));
  const max = row.scoreMax != null ? Number(row.scoreMax) : NaN;
  if (Number.isFinite(max) && max > 0 && Number.isFinite(num)) return (num / max) * 100;
  return Number.isFinite(num) ? num : 0;
}

/** Keep the better row per item (pass beats fail; then higher score). */
export function betterProgressRow(a, b) {
  const pa = itemPassed(a);
  const pb = itemPassed(b);
  if (pa && !pb) return true;
  if (!pa && pb) return false;
  return numericScore(a) >= numericScore(b);
}

/** Union incoming with existing; filters to program; never drops a passing item. */
export function mergeProgressRows(existing, incoming, program = PROGRAM) {
  const map = new Map();
  function absorb(rows) {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (!row) continue;
      if (rowProgram(row) !== program) continue;
      const item = rowItemId(row);
      if (!item) continue;
      const prev = map.get(item);
      if (!prev || betterProgressRow(row, prev)) map.set(item, row);
    }
  }
  absorb(existing);
  absorb(incoming);
  return Array.from(map.values());
}

export function passedIdsFromProgress(rows, program = PROGRAM) {
  const ids = new Set();
  const merged = mergeProgressRows([], rows, program);
  for (const row of merged) {
    if (itemPassed(row)) ids.add(rowItemId(row));
  }
  return ids;
}

export function readJsonArray(storage, key) {
  if (!storage || typeof storage.getItem !== "function") return [];
  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordFingerprint(rec) {
  if (!rec || typeof rec !== "object") return "";
  return JSON.stringify([
    rec.item_id,
    rec.ended_at,
    rec.started_at,
    rec.session_id,
    rec.student_id,
    rec.response,
  ]);
}

/** Drop exact duplicate record objects (same fingerprint). */
export function dedupeRecords(records) {
  const seen = new Set();
  const out = [];
  if (!Array.isArray(records)) return out;
  for (const rec of records) {
    const fp = recordFingerprint(rec);
    if (!fp) {
      out.push(rec);
      continue;
    }
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(rec);
  }
  return out;
}

/** Read-only merge from legacy key into per-student key (never deletes legacy). */
export function migrateRecordsStorage(storage, studentId) {
  const targetKey = recordsStorageKey(studentId);
  const markerKey = recordsMigrationMarkerKey(studentId);
  const current = dedupeRecords(readJsonArray(storage, targetKey));
  if (!storage || typeof storage.getItem !== "function") return current;
  if (storage.getItem(markerKey) === "1") return current;
  const legacy = readJsonArray(storage, LEGACY_RECORDS_KEY);
  const merged = legacy.length ? dedupeRecords(current.concat(legacy)) : current;
  try {
    if (typeof storage.setItem === "function") {
      if (legacy.length) storage.setItem(targetKey, JSON.stringify(merged));
      storage.setItem(markerKey, "1");
    }
  } catch {
    /* quota */
  }
  return legacy.length ? merged : current;
}

export function migrateCustomWordsStorage(storage, studentId) {
  const targetKey = customWordsStorageKey(studentId);
  if (!storage || typeof storage.getItem !== "function") return "";
  const current = storage.getItem(targetKey);
  if (current) return current;
  const legacy = storage.getItem(LEGACY_CUSTOM_KEY);
  if (!legacy) return "";
  try {
    if (typeof storage.setItem === "function") storage.setItem(targetKey, legacy);
  } catch {
    /* quota */
  }
  return legacy;
}

const PROGRESS_RETRY_MS = 20000;

/**
 * Wire mrj-auth-ready + optional loadProgressForApp (feature-detected).
 * @param {object} opts
 * @param {(id: string) => void} opts.onStudentReady - boot when student id changes (or first sign-in)
 * @param {(rows: object[]) => void} opts.onProgressApplied - merged rows applied
 * @param {() => object} [opts.getAuth] - default window.MRJ_AUTH
 */
export function bindAuthProgress(opts) {
  const onStudentReady = opts.onStudentReady;
  const onProgressApplied = opts.onProgressApplied;
  const getAuth =
    opts.getAuth ||
    (() => (typeof globalThis !== "undefined" ? globalThis.MRJ_AUTH : undefined));

  let currentStudentKey = "";
  let progressRetried = false;
  let progressRetryTimer = null;

  function isCurrentStudent(forStudentKey) {
    return !!forStudentKey && forStudentKey === currentStudentKey;
  }

  function applyRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    onProgressApplied(rows);
  }

  async function loadPagedProgress(forStudentKey) {
    const loadKey = forStudentKey || currentStudentKey;
    if (!loadKey) return;
    const auth = getAuth();
    if (!auth || typeof auth.loadProgressForApp !== "function") return;
    try {
      const res = await auth.loadProgressForApp(PROGRAM);
      if (!isCurrentStudent(loadKey)) return;
      if (res && res.ok && Array.isArray(res.progress)) applyRows(res.progress);
    } catch {
      /* keep local */
    }
  }

  function scheduleProgressRetry(forStudentKey) {
    const retryKey = forStudentKey || currentStudentKey;
    if (!retryKey || progressRetried || progressRetryTimer) return;
    progressRetried = true;
    progressRetryTimer = setTimeout(() => {
      progressRetryTimer = null;
      if (!isCurrentStudent(retryKey)) return;
      void loadPagedProgress(retryKey);
    }, PROGRESS_RETRY_MS);
  }

  function onAuthReady(event) {
    const detail = event && event.detail ? event.detail : {};
    const id = detail.id != null ? String(detail.id).trim() : "";
    if (!id) return;

    const studentKey = idKey(id);
    const studentChanged = currentStudentKey !== studentKey;
    if (studentChanged) currentStudentKey = studentKey;

    progressRetried = false;
    if (progressRetryTimer) {
      clearTimeout(progressRetryTimer);
      progressRetryTimer = null;
    }

    if (studentChanged) onStudentReady(id);

    const initial = Array.isArray(detail.progress) ? detail.progress : [];
    applyRows(initial);

    const auth = getAuth();
    let progErr = "";
    try {
      if (auth && typeof auth.progressError === "function") progErr = String(auth.progressError() || "");
    } catch {
      progErr = "";
    }

    if (auth && typeof auth.loadProgressForApp === "function") {
      const loadKey = studentKey;
      auth
        .loadProgressForApp(PROGRAM)
        .then((res) => {
          if (!isCurrentStudent(loadKey)) return;
          if (res && res.ok && Array.isArray(res.progress)) {
            applyRows(res.progress);
            return;
          }
          if (progErr || !res || !res.ok) scheduleProgressRetry(loadKey);
        })
        .catch(() => {
          if (!isCurrentStudent(loadKey)) return;
          scheduleProgressRetry(loadKey);
        });
    }
  }

  return { onAuthReady, scheduleProgressRetry, loadPagedProgress };
}
