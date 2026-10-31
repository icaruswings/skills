function uniqueKeys(rows) {
  if (!Array.isArray(rows)) return null;
  const keys = rows.map(row => row?.key);
  if (keys.some(key => typeof key !== 'string' || !key.trim())) return null;
  const unique = new Set(keys);
  return unique.size === rows.length ? unique : null;
}

export function canGrade(plannedRows, observedRows, { watch, sealed }) {
  const planned = uniqueKeys(plannedRows), observed = uniqueKeys(observedRows);
  if (!planned?.size || !observed) return false;
  if ([...observed].some(key => !planned.has(key))) return false;
  if (!watch && sealed) return true;
  return observed.size === planned.size
    && observedRows.every(row => row.status === 'complete' && row.modelVerified === true);
}
