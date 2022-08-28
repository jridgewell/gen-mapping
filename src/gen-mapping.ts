import { SetArray, put, get } from '@jridgewell/set-array';
import { encode } from '@jridgewell/sourcemap-codec';
import { TraceMap, decodedMappings, traceSegment } from '@jridgewell/trace-mapping';

import {
  COLUMN,
  SOURCES_INDEX,
  SOURCE_LINE,
  SOURCE_COLUMN,
  NAMES_INDEX,
} from './sourcemap-segment';

import relativeUri from '@jridgewell/resolve-uri/relative';
import resolveUri from '@jridgewell/resolve-uri';

import type { SourceMapInput } from '@jridgewell/trace-mapping';
import type { SourceMapSegment } from './sourcemap-segment';
import type { DecodedSourceMap, EncodedSourceMap, Pos, Mapping } from './types';

export type { DecodedSourceMap, EncodedSourceMap, Mapping };

export type Options = {
  file?: string | null;
  sourceRoot?: string | null;
};

const NO_NAME = -1;

/**
 * A low-level API to associate a generated position with an original source position. Line and
 * column here are 0-based, unlike `addMapping`.
 */
export let addSegment: {
  (
    map: GenMapping,
    genLine: number,
    genColumn: number,
    source?: null,
    sourceLine?: null,
    sourceColumn?: null,
    name?: null,
    content?: null,
  ): void;
  (
    map: GenMapping,
    genLine: number,
    genColumn: number,
    source: string,
    sourceLine: number,
    sourceColumn: number,
    name?: null,
    content?: string | null,
  ): void;
  (
    map: GenMapping,
    genLine: number,
    genColumn: number,
    source: string,
    sourceLine: number,
    sourceColumn: number,
    name: string,
    content?: string | null,
  ): void;
};

/**
 * A high-level API to associate a generated position with an original source position. Line is
 * 1-based, but column is 0-based, due to legacy behavior in `source-map` library.
 */
export let addMapping: {
  (
    map: GenMapping,
    mapping: {
      generated: Pos;
      source?: null;
      original?: null;
      name?: null;
      content?: null;
    },
  ): void;
  (
    map: GenMapping,
    mapping: {
      generated: Pos;
      source: string;
      original: Pos;
      name?: null;
      content?: string | null;
    },
  ): void;
  (
    map: GenMapping,
    mapping: {
      generated: Pos;
      source: string;
      original: Pos;
      name: string;
      content?: string | null;
    },
  ): void;
};

/**
 * Same as `addSegment`, but will only add the segment if it generates useful information in the
 * resulting map. This only works correctly if segments are added **in order**, meaning you should
 * not add a segment with a lower generated line/column than one that came before.
 */
export let maybeAddSegment: typeof addSegment;

/**
 * Same as `addMapping`, but will only add the mapping if it generates useful information in the
 * resulting map. This only works correctly if mappings are added **in order**, meaning you should
 * not add a mapping with a lower generated line/column than one that came before.
 */
export let maybeAddMapping: typeof addMapping;

/**
 * Adds/removes the content of the source file to the source map.
 */
export let setSourceContent: (map: GenMapping, source: string, content: string | null) => void;

/**
 * Returns a sourcemap object (with decoded mappings) suitable for passing to a library that expects
 * a sourcemap, or to JSON.stringify.
 */
export let toDecodedMap: (map: GenMapping) => DecodedSourceMap;

/**
 * Returns a sourcemap object (with encoded mappings) suitable for passing to a library that expects
 * a sourcemap, or to JSON.stringify.
 */
export let toEncodedMap: (map: GenMapping) => EncodedSourceMap;

/**
 * Constructs a new GenMapping, using the already present mappings of the input.
 */
export let fromMap: (input: SourceMapInput) => GenMapping;

/**
 * Returns an array of high-level mapping objects for every recorded segment, which could then be
 * passed to the `source-map` library.
 */
export let allMappings: (map: GenMapping) => Mapping[];

/**
 * Applies the mappings of a sub-source-map for a specific source file to the
 * source map being generated. Each mapping to the supplied source file is
 * rewritten using the supplied source map.
 */
export let applySourceMap: (
  map: GenMapping,
  sourceMapConsumer: TraceMap,
  sourceFile?: string,
  sourceMapPath?: string,
) => void;

// This split declaration is only so that terser can elminiate the static initialization block.
let addSegmentInternal: <S extends string | null | undefined>(
  skipable: boolean,
  map: GenMapping,
  genLine: number,
  genColumn: number,
  source: S,
  sourceLine: S extends string ? number : null | undefined,
  sourceColumn: S extends string ? number : null | undefined,
  name: S extends string ? string | null | undefined : null | undefined,
  content: S extends string ? string | null | undefined : null | undefined,
) => void;

/**
 * Provides the state to generate a sourcemap.
 */
export class GenMapping {
  private _names = new SetArray();
  private _sources = new SetArray();
  private _sourcesContent: (string | null)[] = [];
  private _mappings: SourceMapSegment[][] = [];
  declare file: string | null | undefined;
  declare sourceRoot: string | null | undefined;

  constructor({ file, sourceRoot }: Options = {}) {
    this.file = file;
    this.sourceRoot = sourceRoot;
  }

  static {
    addSegment = (map, genLine, genColumn, source, sourceLine, sourceColumn, name, content) => {
      return addSegmentInternal(
        false,
        map,
        genLine,
        genColumn,
        source,
        sourceLine,
        sourceColumn,
        name,
        content,
      );
    };

    maybeAddSegment = (
      map,
      genLine,
      genColumn,
      source,
      sourceLine,
      sourceColumn,
      name,
      content,
    ) => {
      return addSegmentInternal(
        true,
        map,
        genLine,
        genColumn,
        source,
        sourceLine,
        sourceColumn,
        name,
        content,
      );
    };

    addMapping = (map, mapping) => {
      return addMappingInternal(false, map, mapping as Parameters<typeof addMappingInternal>[2]);
    };

    maybeAddMapping = (map, mapping) => {
      return addMappingInternal(true, map, mapping as Parameters<typeof addMappingInternal>[2]);
    };

    setSourceContent = (map, source, content) => {
      const { _sources: sources, _sourcesContent: sourcesContent } = map;

      const sourceIndex = get(sources, source);
      if (sourceIndex !== undefined) {
        sourcesContent[sourceIndex] = content;
      }
    };

    toDecodedMap = (map) => {
      const {
        file,
        sourceRoot,
        _mappings: mappings,
        _sources: sources,
        _sourcesContent: sourcesContent,
        _names: names,
      } = map;
      removeEmptyFinalLines(mappings);

      return {
        version: 3,
        file: file || undefined,
        names: names.array,
        sourceRoot: sourceRoot || undefined,
        sources: sources.array,
        sourcesContent,
        mappings,
      };
    };

    toEncodedMap = (map) => {
      const decoded = toDecodedMap(map);
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

          const generated = { line: i + 1, column: seg[COLUMN] };
          let source: string | undefined = undefined;
          let original: Pos | undefined = undefined;
          let name: string | undefined = undefined;

          if (seg.length !== 1) {
            source = sources.array[seg[SOURCES_INDEX]];
            original = { line: seg[SOURCE_LINE] + 1, column: seg[SOURCE_COLUMN] };

            if (seg.length === 5) name = names.array[seg[NAMES_INDEX]];
          }

          out.push({ generated, source, original, name } as Mapping);
        }
      }

      return out;
    };

    fromMap = (input) => {
      const map = new TraceMap(input);
      const gen = new GenMapping({ file: map.file, sourceRoot: map.sourceRoot });

      putAll(gen._names, map.names);
      putAll(gen._sources, map.sources as string[]);
      gen._sourcesContent = map.sourcesContent || map.sources.map(() => null);
      gen._mappings = decodedMappings(map) as GenMapping['_mappings'];

      return gen;
    };

    // Internal helpers
    addSegmentInternal = (
      skipable,
      map,
      genLine,
      genColumn,
      source,
      sourceLine,
      sourceColumn,
      name,
      content,
    ) => {
      const {
        _mappings: mappings,
        _sources: sources,
        _sourcesContent: sourcesContent,
        _names: names,
      } = map;
      const line = getLine(mappings, genLine);
      const index = getColumnIndex(line, genColumn);

      if (!source) {
        if (skipable && skipSourceless(line, index)) return;
        return insert(line, index, [genColumn]);
      }

      // Sigh, TypeScript can't figure out sourceLine and sourceColumn aren't nullish if source
      // isn't nullish.
      assert<number>(sourceLine);
      assert<number>(sourceColumn);

      const sourcesIndex = put(sources, source);
      const namesIndex = name ? put(names, name) : NO_NAME;
      if (sourcesIndex === sourcesContent.length) sourcesContent[sourcesIndex] = content ?? null;

      if (skipable && skipSource(line, index, sourcesIndex, sourceLine, sourceColumn, namesIndex)) {
        return;
      }

      return insert(
        line,
        index,
        name
          ? [genColumn, sourcesIndex, sourceLine, sourceColumn, namesIndex]
          : [genColumn, sourcesIndex, sourceLine, sourceColumn],
      );
    };

    applySourceMap = (
      map: GenMapping,
      consumer: TraceMap,
      rawSourceFile?: string | null,
      sourceMapPath?: string | null,
    ) => {
      let sourceFile = rawSourceFile ?? consumer.file;
      if (sourceFile == null) {
        throw new Error(
          'applySourceMap requires either an explicit source file, ' +
            'or the source map\'s "file" property. Both were omitted.',
        );
      }

      if (!sourceMapPath) sourceMapPath = '';
      else if (!sourceMapPath.endsWith('/')) sourceMapPath += '/';

      const { _mappings: mappings, _sourcesContent: sourcesContent, sourceRoot } = map;
      const sources = map._sources.array;
      const names = map._names.array;

      const {
        sources: consumerSources,
        sourcesContent: consumerSourcesContent,
        names: consumerNames,
      } = consumer;

      let sourceIndex = get(map._sources, sourceFile);
      if (sourceIndex === undefined && sourceRoot) {
        // If we couldn't fine the source file and there's a sourceRoot, the sourceFile may have
        // been joined with the root already. Try again after making the file relative to the root.
        sourceFile = relativeUri(sourceRoot, sourceFile);
        sourceIndex = get(map._sources, sourceFile);
      }

      // If we still can't find the source file, then there's no way we could remap the file with
      // the new consumer map.
      if (sourceIndex === undefined) return;

      // The source file and several names could be replaced by the remapped consumer map. To avoid
      // leaving dead entires, we regenerate the both (and the paired sourcesContent).
      const newSources = new SetArray();
      const newSourcesContent: (string | null)[] = [];
      const newNames = new SetArray();

      for (let i = 0; i < mappings.length; i++) {
        const line = mappings[i];

        for (let j = 0; j < line.length; j++) {
          const seg = line[j];
          if (seg.length === 1) continue;

          let traced = null;
          if (seg[1] === sourceIndex) {
            traced = traceSegment(consumer, seg[2], seg[3]);
          }

          if (traced == null) {
            // Either this segment is mapping a different source file, or we couldn't traced the
            // original mapping in the consumer. Either way, we'll keep the original.
            const initialIndex = seg[1];
            const newSourceIndex = (seg[1] = put(newSources, sources[initialIndex]));
            newSourcesContent[newSourceIndex] = sourcesContent[initialIndex];
            if (seg.length === 5) seg[4] = put(newNames, names[seg[4]]);
            continue;
          }

          if (traced.length === 1) {
            // If the traced mapping points to a sourceless segment, we need to truncate the
            // original to also be sourceless.
            (seg as number[]).length = 1;
            continue;
          }

          let source = consumerSources[traced[1]] || '';
          if (sourceMapPath != null) {
            source = resolveUri(source, sourceMapPath);
          }
          if (sourceRoot != null) {
            source = relativeUri(sourceRoot, source);
          }

          const newSourceIndex = put(newSources, source);
          newSourcesContent[newSourceIndex] = consumerSourcesContent
            ? consumerSourcesContent[traced[1]]
            : null;

          seg[1] = newSourceIndex;
          seg[2] = traced[2];
          seg[3] = traced[3];

          // If the traced segment has a name, prioritize that. If not, we'll take the original's
          // name. We can't shorten this into a ternary because we may not have a name at all, and
          // we cannot set index 4 if there is no name.
          if (traced.length === 5) {
            seg[4] = put(newNames, consumerNames[traced[4]]);
          } else if (seg.length == 5) {
            seg[4] = put(newNames, names[seg[4]]);
          }
        }
      }

      map._sources = newSources;
      map._sourcesContent = newSourcesContent;
      map._names = newNames;
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

function getColumnIndex(line: SourceMapSegment[], genColumn: number): number {
  let index = line.length;
  for (let i = index - 1; i >= 0; index = i--) {
    const current = line[i];
    if (genColumn >= current[COLUMN]) break;
  }
  return index;
}

function insert<T>(array: T[], index: number, value: T) {
  for (let i = array.length; i > index; i--) {
    array[i] = array[i - 1];
  }
  array[index] = value;
}

function removeEmptyFinalLines(mappings: SourceMapSegment[][]) {
  const { length } = mappings;
  let len = length;
  for (let i = len - 1; i >= 0; len = i, i--) {
    if (mappings[i].length > 0) break;
  }
  if (len < length) mappings.length = len;
}

function putAll(strarr: SetArray, array: string[]) {
  for (let i = 0; i < array.length; i++) put(strarr, array[i]);
}

function skipSourceless(line: SourceMapSegment[], index: number): boolean {
  // The start of a line is already sourceless, so adding a sourceless segment to the beginning
  // doesn't generate any useful information.
  if (index === 0) return true;

  const prev = line[index - 1];
  // If the previous segment is also sourceless, then adding another sourceless segment doesn't
  // genrate any new information. Else, this segment will end the source/named segment and point to
  // a sourceless position, which is useful.
  return prev.length === 1;
}

function skipSource(
  line: SourceMapSegment[],
  index: number,
  sourcesIndex: number,
  sourceLine: number,
  sourceColumn: number,
  namesIndex: number,
): boolean {
  // A source/named segment at the start of a line gives position at that genColumn
  if (index === 0) return false;

  const prev = line[index - 1];

  // If the previous segment is sourceless, then we're transitioning to a source.
  if (prev.length === 1) return false;

  // If the previous segment maps to the exact same source position, then this segment doesn't
  // provide any new position information.
  return (
    sourcesIndex === prev[SOURCES_INDEX] &&
    sourceLine === prev[SOURCE_LINE] &&
    sourceColumn === prev[SOURCE_COLUMN] &&
    namesIndex === (prev.length === 5 ? prev[NAMES_INDEX] : NO_NAME)
  );
}

function addMappingInternal<S extends string | null | undefined>(
  skipable: boolean,
  map: GenMapping,
  mapping: {
    generated: Pos;
    source: S;
    original: S extends string ? Pos : null | undefined;
    name: S extends string ? string | null | undefined : null | undefined;
    content: S extends string ? string | null | undefined : null | undefined;
  },
) {
  const { generated, source, original, name, content } = mapping;
  if (!source) {
    return addSegmentInternal(
      skipable,
      map,
      generated.line - 1,
      generated.column,
      null,
      null,
      null,
      null,
      null,
    );
  }
  const s: string = source;
  assert<Pos>(original);
  return addSegmentInternal(
    skipable,
    map,
    generated.line - 1,
    generated.column,
    s,
    original.line - 1,
    original.column,
    name,
    content,
  );
}
