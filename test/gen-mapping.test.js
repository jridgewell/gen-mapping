const { assertEqualMaps } = require('./utils');

const {
  GenMapping,
  addSegment,
  addMapping,
  setSourceContent,
  toDecodedMap,
  toEncodedMap,
  allMappings,
  fromMap,
  maybeAddSegment,
  maybeAddMapping,
  applySourceMap,
} = require('..');

const { TraceMap } = require('@jridgewell/trace-mapping');

const assert = require('assert');

describe('GenMapping', () => {
  describe('toDecodedMap', () => {
    it('has version', () => {
      const map = new GenMapping({ file: 'output.js' });

      assert.strictEqual(toDecodedMap(map).version, 3);
    });

    it('has file name', () => {
      const map = new GenMapping({ file: 'output.js' });

      assert.strictEqual(toDecodedMap(map).file, 'output.js');
    });

    it('has sourceRoot', () => {
      const map = new GenMapping({ sourceRoot: 'foo/' });

      assert.strictEqual(toDecodedMap(map).sourceRoot, 'foo/');
    });

    it('has sources', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(toDecodedMap(map).sources, ['input.js']);
    });

    it('has sourcesContent', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
      setSourceContent(map, 'input.js', 'input');

      assert.deepEqual(toDecodedMap(map).sourcesContent, ['input']);
    });

    it('has names', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(toDecodedMap(map).names, ['foo']);
    });

    it('has mappings', () => {
      const map = new GenMapping();
      addSegment(map, 0, 1, 'input.js', 2, 3, 'foo');

      assert.deepEqual(toDecodedMap(map).mappings, [[[1, 0, 2, 3, 0]]]);
    });
  });

  describe('toEncodedMap', () => {
    it('has version', () => {
      const map = new GenMapping({ file: 'output.js' });

      assert.strictEqual(toEncodedMap(map).version, 3);
    });

    it('has file name', () => {
      const map = new GenMapping({ file: 'output.js' });

      assert.strictEqual(toEncodedMap(map).file, 'output.js');
    });

    it('has sourceRoot', () => {
      const map = new GenMapping({ sourceRoot: 'foo/' });

      assert.strictEqual(toEncodedMap(map).sourceRoot, 'foo/');
    });

    it('has sources', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(toEncodedMap(map).sources, ['input.js']);
    });

    it('has sourcesContent', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
      setSourceContent(map, 'input.js', 'input');

      assert.deepEqual(toEncodedMap(map).sourcesContent, ['input']);
    });

    it('has names', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(toEncodedMap(map).names, ['foo']);
    });

    it('has mappings', () => {
      const map = new GenMapping();
      addSegment(map, 0, 1, 'input.js', 2, 3, 'foo');

      assert.deepEqual(toEncodedMap(map).mappings, 'CAEGA');
    });
  });

  describe('addSegment', () => {
    it('requires generated line/column', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [[[0]]]);
    });

    it('records nameless source segment', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0]]]);
    });

    it('records named source segment', () => {
      const map = new GenMapping();
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0, 0]]]);
    });

    it('uses 0-based line', () => {
      const map = new GenMapping();
      addSegment(map, 1, 0, 'input.js', 1, 0, 'foo');

      assert.deepEqual(toDecodedMap(map).mappings, [[], [[0, 0, 1, 0, 0]]]);
    });

    it('can skip back and forth in generated lines', () => {
      const map = new GenMapping();
      addSegment(map, 1, 0, 'input.js', 1, 0);
      addSegment(map, 2, 0, 'input.js', 2, 0);
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [
        [[0, 0, 0, 0]],
        [[0, 0, 1, 0]],
        [[0, 0, 2, 0]],
      ]);
    });

    it('sorts generated column', () => {
      const map = new GenMapping();
      addSegment(map, 0, 1, 'input.js', 0, 0);
      addSegment(map, 0, 2, 'input.js', 0, 0);
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 0, 0, 0],
          [1, 0, 0, 0],
          [2, 0, 0, 0],
        ],
      ]);
    });

    it('postfix sorts source index', () => {
      const map = new GenMapping();

      addSegment(map, 1, 0, 'foo.js', 0, 0);
      addSegment(map, 0, 0, 'input.js', 0, 0);
      addSegment(map, 0, 0, 'foo.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 1, 0, 0],
          [0, 0, 0, 0],
        ],
        [[0, 0, 0, 0]],
      ]);
    });

    it('postfix sorts source line', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 1, 0);
      addSegment(map, 0, 0, 'input.js', 2, 0);
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 0, 1, 0],
          [0, 0, 2, 0],
          [0, 0, 0, 0],
        ],
      ]);
    });

    it('postfix sorts source column', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 1);
      addSegment(map, 0, 0, 'input.js', 0, 2);
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 0, 0, 1],
          [0, 0, 0, 2],
          [0, 0, 0, 0],
        ],
      ]);
    });

    it('postfix sorts name index', () => {
      const map = new GenMapping();

      addSegment(map, 1, 0, 'input.js', 0, 0, 'foo');
      addSegment(map, 0, 0, 'input.js', 0, 0, 'bar');
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 0, 0, 0, 1],
          [0, 0, 0, 0, 0],
        ],
        [[0, 0, 0, 0, 0]],
      ]);
    });

    it('postfix sorts sourceless segment after source segment', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0);
      addSegment(map, 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0], [0]]]);
    });

    it('postfix sorts sourceless segment after named segment', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
      addSegment(map, 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0, 0], [0]]]);
    });

    it('postfix sorts source segment after named segment', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      ]);
    });

    it('keeps equivalent sourceless segment', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0);
      addSegment(map, 1, 0);
      addSegment(map, 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [[[0], [0]], [[0]]]);
    });

    it('keeps equivalent source segment', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0);
      addSegment(map, 1, 0, 'input.js', 0, 0);
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        [[0, 0, 0, 0]],
      ]);
    });

    it('keeps equivalent named segment', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
      addSegment(map, 1, 0, 'input.js', 0, 0, 'foo');
      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(toDecodedMap(map).mappings, [
        [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
        ],
        [[0, 0, 0, 0, 0]],
      ]);
    });

    it('keeps sourcesContent in sync with sources', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0);
      addSegment(map, 1, 0, 'foo.js', 0, 0);
      addSegment(map, 2, 0, 'bar.js', 0, 0);

      setSourceContent(map, 'bar.js', 'bar');
      setSourceContent(map, 'input.js', 'input');

      assert.deepEqual(toDecodedMap(map).sourcesContent, ['input', null, 'bar']);
    });

    it('can set content when adding', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0, '', 'input');
      addSegment(map, 1, 0, 'foo.js', 0, 0, '', undefined);

      assert.deepEqual(toDecodedMap(map).sourcesContent, ['input', null]);
    });

    it('only sets content during initial source add', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0, '', 'first');
      addSegment(map, 1, 0, 'input.js', 0, 0, '', 'second');

      assert.deepEqual(toDecodedMap(map).sourcesContent, ['first']);
    });

    it('ignores content when sourceless', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0);
      addSegment(map, 0, 1, '', 0, 0, '', 'foo');

      assert.deepEqual(toDecodedMap(map).sourcesContent, [null]);
    });
  });

  describe('addMapping', () => {
    it('requires generated line/column', () => {
      const map = new GenMapping();
      addMapping(map, { generated: { line: 1, column: 0 } });

      assert.deepEqual(toDecodedMap(map).mappings, [[[0]]]);
    });

    it('records nameless source segment', () => {
      const map = new GenMapping();
      addMapping(map, {
        generated: { line: 1, column: 0 },
        source: 'input.js',
        original: { line: 1, column: 0 },
      });

      assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0]]]);
    });

    it('records named source segment', () => {
      const map = new GenMapping();
      addMapping(map, {
        generated: { line: 1, column: 0 },
        source: 'input.js',
        original: { line: 1, column: 0 },
        name: 'foo',
      });

      assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0, 0]]]);
    });

    it('uses 1-based line', () => {
      const map = new GenMapping();
      addMapping(map, {
        generated: { line: 2, column: 0 },
        source: 'input.js',
        original: { line: 2, column: 0 },
        name: 'foo',
      });

      assert.deepEqual(toDecodedMap(map).mappings, [[], [[0, 0, 1, 0, 0]]]);
    });
  });

  describe('allMappings', () => {
    it('returns sourceless mappings', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0);

      assert.deepEqual(allMappings(map), [
        {
          generated: { line: 1, column: 0 },
          source: undefined,
          original: undefined,
          name: undefined,
        },
      ]);
    });

    it('returns source mappings', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(allMappings(map), [
        {
          generated: { line: 1, column: 0 },
          source: 'input.js',
          original: { line: 1, column: 0 },
          name: undefined,
        },
      ]);
    });

    it('returns named mappings', () => {
      const map = new GenMapping();

      addSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

      assert.deepEqual(allMappings(map), [
        {
          generated: { line: 1, column: 0 },
          source: 'input.js',
          original: { line: 1, column: 0 },
          name: 'foo',
        },
      ]);
    });

    it('returns mappings in sorted order', () => {
      const map = new GenMapping();

      addSegment(map, 0, 1, 'input.js', 0, 0);
      addSegment(map, 0, 2, 'input.js', 0, 0);
      addSegment(map, 0, 0, 'input.js', 0, 0);

      assert.deepEqual(allMappings(map), [
        {
          generated: { line: 1, column: 0 },
          source: 'input.js',
          original: { line: 1, column: 0 },
          name: undefined,
        },
        {
          generated: { line: 1, column: 1 },
          source: 'input.js',
          original: { line: 1, column: 0 },
          name: undefined,
        },
        {
          generated: { line: 1, column: 2 },
          source: 'input.js',
          original: { line: 1, column: 0 },
          name: undefined,
        },
      ]);
    });
  });

  describe('fromMap', () => {
    it('copies version', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        names: [],
        sources: ['input.js'],
        sourcesContent: [],
        mappings: [],
      });
      const map = fromMap(input);

      assert.strictEqual(toDecodedMap(map).version, 3);
    });

    it('copies file name', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        file: 'output.js',
        names: [],
        sources: ['input.js'],
        sourcesContent: [],
        mappings: [],
      });
      const map = fromMap(input);

      assert.strictEqual(toDecodedMap(map).file, 'output.js');
    });

    it('copies sourceRoot', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        names: [],
        sourceRoot: 'foo/',
        sources: ['input.js'],
        sourcesContent: [],
        mappings: [],
      });
      const map = fromMap(input);

      assert.strictEqual(toDecodedMap(map).sourceRoot, 'foo/');
    });

    it('copies sources', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        names: [],
        sources: ['input.js'],
        sourcesContent: [],
        mappings: [],
      });
      const map = fromMap(input);

      assert.deepEqual(toDecodedMap(map).sources, ['input.js']);
    });

    it('copies sourcesContent', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        names: [],
        sources: ['input.js'],
        sourcesContent: ['input'],
        mappings: [],
      });
      const map = fromMap(input);

      assert.deepEqual(toDecodedMap(map).sourcesContent, ['input']);
    });

    it('creates sourcesContent', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        names: [],
        sources: ['input.js'],
        mappings: [],
      });
      const map = fromMap(input);

      assert.deepEqual(toDecodedMap(map).sourcesContent, [null]);
    });

    it('copies names', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        names: ['foo'],
        sources: ['input.js'],
        sourcesContent: [],
        mappings: [[[0, 0, 0, 0, 0]]],
      });
      const map = fromMap(input);

      assert.deepEqual(toDecodedMap(map).names, ['foo']);
    });

    it('copies decoded mappings', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').DecodedSourceMap} */ ({
        version: 3,
        names: [],
        sources: ['input.js'],
        sourcesContent: [],
        mappings: [[[1, 0, 2, 3, 0]]],
      });
      const map = fromMap(input);

      assert.deepEqual(toDecodedMap(map).mappings, [[[1, 0, 2, 3, 0]]]);
    });

    it('copies encoded mappings', () => {
      const input = /** @type {import('@jridgewell/trace-mapping').EncodedSourceMap} */ ({
        version: 3,
        names: [],
        sources: ['input.js'],
        sourcesContent: [],
        mappings: 'CAEGA',
      });
      const map = fromMap(input);

      assert.deepEqual(toDecodedMap(map).mappings, [[[1, 0, 2, 3, 0]]]);
    });
  });

  describe('maybeAddSegment', () => {
    describe('sourceless segment added afterwards', () => {
      it('skips sourceless segment first on line', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 1, 'input.js', 0, 0);
        maybeAddSegment(map, 1, 1);

        assert.deepEqual(toDecodedMap(map).mappings, [[[1, 0, 0, 0]]]);
      });

      it('skips sourceless segment sorted first in line', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 1, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [[[1, 0, 0, 0]]]);
      });

      it('skips equivalent sourceless segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 1);
        maybeAddSegment(map, 0, 1);

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0], [1]]]);
      });

      it('skips runs of sourceless segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 1);
        maybeAddSegment(map, 0, 2);

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0], [1]]]);
      });

      it('does not skip sourcless segment sorted before sourceless segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 2);
        maybeAddSegment(map, 0, 1);

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0], [1], [2]]]);
      });

      it('does not skip sourcless segment matching source segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0], [0]]]);
      });
    });

    describe('source segment added afterwards', () => {
      it('skips equivalent source segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0]]]);
      });

      it('keeps source segment after matching named segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [
          [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
        ]);
      });

      it('keeps runs of source segment after matching named segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
        maybeAddSegment(map, 0, 1, 'input.js', 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [
          [
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0],
          ],
        ]);
      });

      it('keeps named segment after matching source segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 0, 'input.js', 0, 0, 'foo');

        assert.deepEqual(toDecodedMap(map).mappings, [
          [
            [0, 0, 0, 0],
            [0, 0, 0, 0, 0],
          ],
        ]);
      });

      it('keeps runs of named segment after matching source segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 1, 'input.js', 0, 0, 'foo');

        assert.deepEqual(toDecodedMap(map).mappings, [
          [
            [0, 0, 0, 0],
            [1, 0, 0, 0, 0],
          ],
        ]);
      });

      it('skips runs of matching source segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 1, 'input.js', 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0]]]);
      });

      it('skips runs of matching named segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0, 'foo');
        maybeAddSegment(map, 0, 1, 'input.js', 0, 0, 'foo');

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0, 0]]]);
      });

      it('keeps source segment pointing to different source file', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 0, 'foo.js', 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [
          [
            [0, 0, 0, 0],
            [0, 1, 0, 0],
          ],
        ]);
      });

      it('keeps source segment pointing to different source line', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 0, 'input.js', 1, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [
          [
            [0, 0, 0, 0],
            [0, 0, 1, 0],
          ],
        ]);
      });

      it('keeps source segment pointing to different source column', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 0, 'input.js', 0, 1);

        assert.deepEqual(toDecodedMap(map).mappings, [
          [
            [0, 0, 0, 0],
            [0, 0, 0, 1],
          ],
        ]);
      });

      it('keeps source segment after matching sourceless segment', () => {
        const map = new GenMapping();

        maybeAddSegment(map, 0, 0, 'input.js', 0, 0);
        maybeAddSegment(map, 0, 1);
        maybeAddSegment(map, 0, 1, 'input.js', 0, 0);

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0], [1], [1, 0, 0, 0]]]);
      });
    });
  });

  describe('maybeAddMapping', () => {
    describe('sourceless segment added afterwards', () => {
      it('skips sourceless segment first on line', () => {
        const map = new GenMapping();

        maybeAddMapping(map, {
          generated: { line: 1, column: 1 },
          source: 'input.js',
          original: {
            line: 1,
            column: 0,
          },
        });
        maybeAddMapping(map, { generated: { line: 2, column: 1 } });

        assert.deepEqual(toDecodedMap(map).mappings, [[[1, 0, 0, 0]]]);
      });

      it('skips equivalent sourceless segment', () => {
        const map = new GenMapping();

        maybeAddMapping(map, {
          generated: { line: 1, column: 0 },
          source: 'input.js',
          original: {
            line: 1,
            column: 0,
          },
        });
        maybeAddMapping(map, { generated: { line: 1, column: 1 } });
        maybeAddMapping(map, { generated: { line: 1, column: 1 } });

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0], [1]]]);
      });
    });

    describe('source segment added afterwards', () => {
      it('skips equivalent source segment', () => {
        const map = new GenMapping();

        maybeAddMapping(map, {
          generated: { line: 1, column: 0 },
          source: 'input.js',
          original: {
            line: 1,
            column: 0,
          },
        });
        maybeAddMapping(map, {
          generated: { line: 1, column: 0 },
          source: 'input.js',
          original: {
            line: 1,
            column: 0,
          },
        });

        assert.deepEqual(toDecodedMap(map).mappings, [[[0, 0, 0, 0]]]);
      });
    });
  });
});

describe('applySourceMap', () => {
  it('test applySourceMap basic', () => {
    var mapStep1 = /** @type {import('@jridgewell/trace-mapping').EncodedSourceMap} */ {
      version: 3,
      sources: ['fileX', 'fileY'],
      names: [],
      mappings: 'AACA;;ACAA;;ADDA;;ACAA',
      file: 'fileA',
      sourcesContent: ['lineX1\nlineX2\n', null],
    };

    var mapStep2 = /** @type {import('@jridgewell/trace-mapping').EncodedSourceMap} */ {
      version: 3,
      sources: ['fileA', 'fileB'],
      names: [],
      mappings: ';AAAA;AACA;AACA;AACA;ACHA;AACA',
      file: 'fileGen',
      sourcesContent: [null, 'lineB1\nlineB2\n'],
    };

    var expectedMap = /** @type {import('@jridgewell/trace-mapping').EncodedSourceMap} */ {
      version: 3,
      sources: ['fileX', 'fileA', 'fileY', 'fileB'],
      names: [],
      mappings: ';AACA;ACAA;ACAA;ADEA;AEHA;AACA',
      file: 'fileGen',
      sourcesContent: ['lineX1\nlineX2\n', null, null, 'lineB1\nlineB2\n'],
    };

    // apply source map "mapStep1" to "mapStep2"
    var generator = fromMap(mapStep2);
    applySourceMap(generator, new TraceMap(mapStep1));
    var actualMap = toEncodedMap(generator);

    assertEqualMaps(assert, actualMap, expectedMap);
  });

  it('test applySourceMap throws when file is missing', () => {
    var map = new GenMapping({
      file: 'test.js',
    });
    var map2 = toEncodedMap(new GenMapping());
    assert.throws(function () {
      applySourceMap(map, new TraceMap(map2));
    });
  });

  const data = [
    [
      'relative',
      '../temp/temp_maps',
      ['coffee/foo.coffee', '/bar.coffee', 'http://www.example.com/baz.coffee'],
    ],
    [
      'absolute',
      '/app/temp/temp_maps',
      ['/app/coffee/foo.coffee', '/bar.coffee', 'http://www.example.com/baz.coffee'],
    ],
    [
      'url',
      'http://foo.org/app/temp/temp_maps',
      [
        'http://foo.org/app/coffee/foo.coffee',
        'http://foo.org/bar.coffee',
        'http://www.example.com/baz.coffee',
      ],
    ],
    // If the third parameter is omitted or set to the current working
    // directory we get incorrect source paths:
    [
      'undefined',
      undefined,
      ['../coffee/foo.coffee', '/bar.coffee', 'http://www.example.com/baz.coffee'],
    ],
    [
      'empty string',
      '',
      ['../coffee/foo.coffee', '/bar.coffee', 'http://www.example.com/baz.coffee'],
    ],
    ['dot', '.', ['../coffee/foo.coffee', '/bar.coffee', 'http://www.example.com/baz.coffee']],
    [
      'dot slash',
      './',
      ['../coffee/foo.coffee', '/bar.coffee', 'http://www.example.com/baz.coffee'],
    ],
  ];

  data.forEach(([title, actualPath, expected]) => {
    it(`test the two additional parameters of applySourceMap: ${title}`, () => {
      // Assume the following directory structure:
      //
      // http://foo.org/
      //   bar.coffee
      //   app/
      //     coffee/
      //       foo.coffee
      //     temp/
      //       bundle.js
      //       temp_maps/
      //         bundle.js.map
      //     public/
      //       bundle.min.js
      //       bundle.min.js.map
      //
      // http://www.example.com/
      //   baz.coffee

      const bundleMapSource = new GenMapping({
        file: 'bundle.js',
      });
      addMapping(bundleMapSource, {
        generated: { line: 3, column: 3 },
        original: { line: 2, column: 2 },
        source: '../../coffee/foo.coffee',
      });
      setSourceContent(bundleMapSource, '../../coffee/foo.coffee', 'foo coffee');
      addMapping(bundleMapSource, {
        generated: { line: 13, column: 13 },
        original: { line: 12, column: 12 },
        source: '/bar.coffee',
      });
      setSourceContent(bundleMapSource, '/bar.coffee', 'bar coffee');
      addMapping(bundleMapSource, {
        generated: { line: 23, column: 23 },
        original: { line: 22, column: 22 },
        source: 'http://www.example.com/baz.coffee',
      });
      setSourceContent(bundleMapSource, 'http://www.example.com/baz.coffee', 'baz coffee');

      const bundleMap = new TraceMap(
        /** @type {import('@jridgewell/trace-mapping').EncodedSourceMap} */ (
          toEncodedMap(bundleMapSource)
        )
      );

      const minifiedMapSource = new GenMapping({
        file: 'bundle.min.js',
        sourceRoot: '..',
      });
      addMapping(minifiedMapSource, {
        generated: { line: 1, column: 1 },
        original: { line: 3, column: 3 },
        source: 'temp/bundle.js',
      });
      addMapping(minifiedMapSource, {
        generated: { line: 11, column: 11 },
        original: { line: 13, column: 13 },
        source: 'temp/bundle.js',
      });
      addMapping(minifiedMapSource, {
        generated: { line: 21, column: 21 },
        original: { line: 23, column: 23 },
        source: 'temp/bundle.js',
      });
      const minifiedMap = new TraceMap(
        /** @type {import('@jridgewell/trace-mapping').EncodedSourceMap} */ (
          toEncodedMap(minifiedMapSource)
        )
      );

      /**
       *
       * @param {[string, string, string]} sources
       * @returns {import('..').EncodedSourceMap}
       */
      var expectedMap = function (sources) {
        var map = new GenMapping({
          file: 'bundle.min.js',
          sourceRoot: '..',
        });
        addMapping(map, {
          generated: { line: 1, column: 1 },
          original: { line: 2, column: 2 },
          source: sources[0],
        });
        setSourceContent(map, sources[0], 'foo coffee');
        addMapping(map, {
          generated: { line: 11, column: 11 },
          original: { line: 12, column: 12 },
          source: sources[1],
        });
        setSourceContent(map, sources[1], 'bar coffee');
        addMapping(map, {
          generated: { line: 21, column: 21 },
          original: { line: 22, column: 22 },
          source: sources[2],
        });
        setSourceContent(map, sources[2], 'baz coffee');
        return toEncodedMap(map);
      };

      /**
       *
       * @param {string} aSourceMapPath
       * @returns {import('..').EncodedSourceMap}
       */
      var actualMap = function (aSourceMapPath) {
        var map = fromMap(minifiedMap);
        // Note that relying on `bundleMap.file` (which is simply 'bundle.js')
        // instead of supplying the second parameter wouldn't work here.
        applySourceMap(map, bundleMap, '../temp/bundle.js', aSourceMapPath);
        return toEncodedMap(map);
      };

      assertEqualMaps(assert, actualMap(actualPath), expectedMap(expected));
    });
  });

  const names = [
    // `foo = 1` -> `var foo = 1;` -> `var a=1`
    // CoffeeScript doesn’t rename variables, so there’s no need for it to
    // provide names in its source maps. Minifiers do rename variables and
    // therefore do provide names in their source maps. So that name should be
    // retained if the original map lacks names.
    [null, 'foo', 'foo'],

    // `foo = 1` -> `var coffee$foo = 1;` -> `var a=1`
    // Imagine that CoffeeScript prefixed all variables with `coffee$`. Even
    // though the minifier then also provides a name, the original name is
    // what corresponds to the source.
    ['foo', 'coffee$foo', 'foo'],

    // `foo = 1` -> `var coffee$foo = 1;` -> `var coffee$foo=1`
    // Minifiers can turn off variable mangling. Then there’s no need to
    // provide names in the source map, but the names from the original map are
    // still needed.
    ['foo', null, 'foo'],

    // `foo = 1` -> `var foo = 1;` -> `var foo=1`
    // No renaming at all.
    [null, null, null],
  ];

  /**
   * Imagine some CoffeeScript code being compiled into JavaScript and then minified.
   * @param {string | null} coffeeName
   * @param {string | null} jsName
   * @param {string | null} expectedName
   */
  names.forEach(([coffeeName, jsName, expectedName]) => {
    it(`test applySourceMap name handling: ${coffeeName || 'null'}, ${jsName || 'null'}, ${
      expectedName || 'null'
    }`, () => {
      var minifiedMap = new GenMapping({
        file: 'test.js.min',
      });
      addMapping(minifiedMap, {
        generated: { line: 1, column: 4 },
        original: { line: 1, column: 4 },
        source: 'test.js',
        name: jsName,
      });

      var coffeeMap = new GenMapping({
        file: 'test.js',
      });
      addMapping(coffeeMap, {
        generated: { line: 1, column: 4 },
        original: { line: 1, column: 0 },
        source: 'test.coffee',
        name: coffeeName,
      });

      applySourceMap(minifiedMap, new TraceMap(toDecodedMap(coffeeMap)));

      const actualNames = toDecodedMap(minifiedMap).names;
      if (expectedName == null) {
        assert.equal(actualNames.length, 0);
      } else {
        assert.equal(actualNames.length, 1);
        assert.deepEqual(actualNames, [expectedName]);
      }
    });
  });
});
