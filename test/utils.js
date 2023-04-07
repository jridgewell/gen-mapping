/**
 *
 * @param {*} assert
 * @param {import('..').EncodedSourceMap} actualMap
 * @param {import('..').EncodedSourceMap} expectedMap
 */
function assertEqualMaps(assert, actualMap, expectedMap) {
  assert.equal(actualMap.version, expectedMap.version, 'version mismatch');
  assert.equal(actualMap.file, expectedMap.file, 'file mismatch');
  assert.deepEqual(actualMap.names, expectedMap.names, 'names mismatch');
  assert.deepEqual(actualMap.sources, expectedMap.sources, 'sources mismatch');

  const aSourceRoot = actualMap.sourceRoot;
  const eSourceRoot = expectedMap.sourceRoot;
  assert.equal(
    aSourceRoot,
    eSourceRoot,
    `sourceRoot mismatch: '${aSourceRoot}' != '${eSourceRoot}'`
  );

  assert.equal(actualMap.mappings, expectedMap.mappings, `mappings mismatch`);

  if (actualMap.sourcesContent) {
    // The actualMap.sourcesContent could be an array of null,
    // Which is actually equivalent to not having the key at all
    const hasValues = actualMap.sourcesContent.filter((c) => c != null).length > 0;

    if (hasValues || expectedMap.sourcesContent) {
      assert.deepEqual(
        actualMap.sourcesContent,
        expectedMap.sourcesContent,
        'sourcesContent mismatch'
      );
    }
  }
}

exports.assertEqualMaps = assertEqualMaps;
