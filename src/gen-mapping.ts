import { SetArray, put } from '@jridgewell/set-array';
import { encode } from '@jridgewell/sourcemap-codec';

import type { SourceMapSegment } from './sourcemap-segment';
import type { DecodedSourceMap, EncodedSourceMap, Pos, Mapping } from './types';

export type { DecodedSourceMap, EncodedSourceMap, Mapping };

export type Options = {
  file?: string | null;
  sourceRoot?: string | null;
};

export let addSegment: {
  (
    map: GenMapping,
    genLine: number,
    genColumn: number,
    source?: null,
    sourceLine?: null,
    sourceColumn?: null,
    name?: null,
  ): void;
  (
    map: GenMapping,
    genLine: number,
    genColumn: number,
    source: string,
    sourceLine: number,
    sourceColumn: number,
    name?: null,
  ): void;
  (
    map: GenMapping,
    genLine: number,
    genColumn: number,
    source: string,
    sourceLine: number,
    sourceColumn: number,
    name: string,
  ): void;
};

export let addMapping: {
  (
    map: GenMapping,
    mapping: {
      generated: Pos;
      source?: null;
      original?: null;
      name?: null;
    },
  ): void;
  (
    map: GenMapping,
    mapping: {
      generated: Pos;
      source: string;
      original: Pos;
      name?: null;
    },
  ): void;
  (
    map: GenMapping,
    mapping: {
      generated: Pos;
      source: string;
      original: Pos;
      name: string;
    },
  ): void;
};

export let setSourceContent: (map: GenMapping, source: string, content: string | null) => void;

export let decodedMap: (map: GenMapping) => DecodedSourceMap;
export let encodedMap: (map: GenMapping) => EncodedSourceMap;
export let allMappings: (map: GenMapping) => Mapping[];

export let PrettyMapping: {
  (opts?: Options): GenMapping;
  new (opts?: Options): GenMapping;
};

/**
 * Provides the state to generate a sourcemap.
 */
export class GenMapping {
  private _names = new SetArray();
  private _sources = new SetArray();
  private _sourcesContent: (string | null)[] = [];
  private _mappings: SourceMapSegment[][] = [];
  private _pretty = false;
  declare file: string | null | undefined;
  declare sourceRoot: string | null | undefined;

  constructor({ file, sourceRoot }: Options = {}) {
    this.file = file;
    this.sourceRoot = sourceRoot;
  }

  static {
    PrettyMapping = function (opts) {
      const map = new GenMapping(opts);
      map._pretty = true;
      return map;
    } as typeof PrettyMapping;

    addSegment = (map, genLine, genColumn, source, sourceLine, sourceColumn, name) => {
      const {
        _mappings: mappings,
        _sources: sources,
        _sourcesContent: sourcesContent,
        _names: names,
        _pretty: pretty,
      } = map;

      const line = getLine(mappings, genLine);
      if (source == null) {
        const seg: SourceMapSegment = [genColumn];
        const index = getColumnIndex(line, genColumn, seg, pretty);

        if (pretty && skipSourceless(genColumn, line, index)) return;
        return insert(line, index, seg);
      }

      // Sigh, TypeScript can't figure out sourceLine and sourceColumn aren't nullish if source
      // isn't nullish.
      assert<number>(sourceLine);
      assert<number>(sourceColumn);
      const sourcesIndex = put(sources, source);
      const seg: SourceMapSegment = name
        ? [genColumn, sourcesIndex, sourceLine, sourceColumn, put(names, name)]
        : [genColumn, sourcesIndex, sourceLine, sourceColumn];

      const index = getColumnIndex(line, genColumn, seg, pretty);
      if (pretty && skipSource(seg, line, index)) return;

      if (sourcesIndex === sourcesContent.length) sourcesContent[sourcesIndex] = null;
      insert(line, index, seg);
    };

    addMapping = (map, mapping) => {
      const { generated, source, original, name } = mapping;
      return (addSegment as any)(
        map,
        generated.line - 1,
        generated.column,
        source,
        original == null ? undefined : original.line - 1,
        original?.column,
        name,
      );
    };

    setSourceContent = (map, source, content) => {
      const { _sources: sources, _sourcesContent: sourcesContent } = map;
      sourcesContent[put(sources, source)] = content;
    };

    decodedMap = (map) => {
      const {
        file,
        sourceRoot,
        _mappings: mappings,
        _sources: sources,
        _sourcesContent: sourcesContent,
        _names: names,
      } = map;

      return {
        version: 3,
        file,
        names: names.array,
        sourceRoot: sourceRoot || undefined,
        sources: sources.array,
        sourcesContent,
        mappings,
      };
    };

    encodedMap = (map) => {
      const decoded = decodedMap(map);
      return {
        ...decoded,
        mappings: encode(decoded.mappings as SourceMapSegment[][]),
      };
    };

    allMappings = (map) => {
      const out: Mapping[] = [];
      const { _mappings: mappings, _sources: sources, _names: names } = map;

      for (let i = 0; i < mappings.length; i++) {
        const line = mappings[i];
        for (let j = 0; j < line.length; j++) {
          const seg = line[j];

          const generated = { line: i + 1, column: seg[0] };
          let source: string | undefined = undefined;
          let original: Pos | undefined = undefined;
          let name: string | undefined = undefined;

          if (seg.length !== 1) {
            source = sources.array[seg[1]];
            original = { line: seg[2] + 1, column: seg[3] };

            if (seg.length === 5) name = names.array[seg[4]];
          }

          out.push({ generated, source, original, name } as Mapping);
        }
      }

      return out;
    };
  }
}

function assert<T>(_val: unknown): asserts _val is T {
  // noop.
}

function getLine(mappings: SourceMapSegment[][], index: number): SourceMapSegment[] {
  for (let i = mappings.length; i <= index; i++) {
    mappings[i] = [];
  }
  return mappings[index];
}

function getColumnIndex(
  line: SourceMapSegment[],
  column: number,
  seg: SourceMapSegment,
  pretty: boolean,
): number {
  let index = line.length;
  for (let i = index - 1; i >= 0; i--, index--) {
    const current = line[i];
    const col = current[0];
    if (col > column) continue;
    if (col < column) break;

    const cmp = compare(current, seg);
    if (cmp === 0) return pretty ? -1 : index;
    if (cmp < 0) break;
  }
  return index;
}

function compare(a: SourceMapSegment, b: SourceMapSegment): number {
  let cmp = compareNum(a.length, b.length);
  if (cmp !== 0) return cmp;

  // We've already checked genColumn
  if (a.length === 1) return 0;

  cmp = compareNum(a[1], b[1]!);
  if (cmp !== 0) return cmp;
  cmp = compareNum(a[2], b[2]!);
  if (cmp !== 0) return cmp;
  cmp = compareNum(a[3], b[3]!);
  if (cmp !== 0) return cmp;

  if (a.length === 4) return 0;
  return compareNum(a[4], b[4]!);
}

function compareNum(a: number, b: number): number {
  return a - b;
}

function insert<T>(array: T[], index: number, value: T) {
  if (index === -1) return;
  for (let i = array.length; i > index; i--) {
    array[i] = array[i - 1];
  }
  array[index] = value;
}

function skipSourceless(genColumn: number, line: SourceMapSegment[], index: number): boolean {
  // Sourceless segments at the beginning of a line are useless.
  if (index <= 0) return true;

  // If the previous segment is also sourceless, then this segment is uesless.
  const prev = line[index - 1];
  if (prev.length === 1) return true;

  // If the previous segment starts at the same column, then we we're useless.
  // Due to sorting, it's impossible for a source segment to be previous to us. And a sourceless
  // segment would have been captured above.
  // if (prev[0] === genColumn) return true;

  // If we need to insert this segment at the end of the line, then we should keep it.
  if (index === line.length) return false;

  // If the next segment is also sourceless, then we can adjust it to start at our column.
  const next = line[index];
  if (next.length === 1) {
    next[0] = genColumn;
    return true;
  }

  // If the next segment starts at the same column, then we we're useless.
  if (next[0] === genColumn) return true;

  return false;
}

function skipSource(
  seg: Exclude<SourceMapSegment, [number]>,
  line: SourceMapSegment[],
  index: number,
): boolean {
  if (index > 0) {
    const prev = line[index - 1];

  }
  return false;
}
