function commitCompletedAttributionBackfill({
  domainData, changedDomains, unresolved, write, writeJsonAtomic,
}) {
  if (!write || unresolved.length > 0) return 0;
  let written = 0;
  for (const domain of changedDomains) {
    const { file, records } = domainData.get(domain);
    writeJsonAtomic(file, records);
    written += 1;
  }
  return written;
}

module.exports = { commitCompletedAttributionBackfill };
