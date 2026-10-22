import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AbapGitSerializer } from '../src/lib/serializer.ts';
import { programHandler } from '../src/lib/handlers/objects/prog.ts';
import '../src/lib/handlers/objects/index.ts';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'abapgit-serializer-'));
  tempDirs.push(dir);
  return dir;
}

function programValuesFromXml(
  xml: string,
): Parameters<NonNullable<typeof programHandler.fromAbapGit>>[0] {
  const parsed = programHandler.schema.parse(xml);
  assert.ok(parsed && typeof parsed === 'object');
  const abapGit = (parsed as { abapGit?: unknown }).abapGit;
  assert.ok(abapGit && typeof abapGit === 'object');
  const abap = (abapGit as { abap?: unknown }).abap;
  assert.ok(abap && typeof abap === 'object');
  const values = (abap as { values?: unknown }).values;
  assert.ok(values && typeof values === 'object');
  return values as Parameters<
    NonNullable<typeof programHandler.fromAbapGit>
  >[0];
}

function generatedContent(
  files: { path: string; content: string }[],
  suffix: string,
): string {
  const file = files.find((candidate) => candidate.path.endsWith(suffix));
  assert.ok(file);
  return file.content;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('AbapGitSerializer', () => {
  it('serializes a PROG/I include as prog files with SUBCI', async () => {
    const includeSource = 'INCLUDE zapi_include.';
    const files = await programHandler.serialize({
      name: 'ZAPI_INCLUDE',
      kind: 'Include',
      getSource: async () => includeSource,
    } as never);

    assert.deepEqual(files.map((file) => file.path).sort(), [
      'zapi_include.prog.abap',
      'zapi_include.prog.xml',
    ]);
    assert.match(
      files.find((file) => file.path.endsWith('.xml'))!.content,
      /<SUBC>I<\/SUBC>/,
    );
  });

  it('keeps executable reports at SUBC1', async () => {
    const files = await programHandler.serialize({
      name: 'ZAPI_REPORT',
      kind: 'Program',
      getSource: async () => 'REPORT zapi_report.',
    } as never);

    assert.match(
      files.find((file) => file.path.endsWith('.xml'))!.content,
      /<SUBC>1<\/SUBC>/,
    );
  });

  it('maps generated Include and report metadata and hands sources to deserialization', async () => {
    const includeSource = 'INCLUDE ztest_include.';
    const reportSource = 'REPORT ztest_report.';
    const includeFiles = await programHandler.serialize({
      name: 'ZTEST_INCLUDE',
      kind: 'Include',
      getSource: async () => includeSource,
    } as never);
    const reportFiles = await programHandler.serialize({
      name: 'ZTEST_REPORT',
      kind: 'Program',
      getSource: async () => reportSource,
    } as never);

    const fromAbapGit = programHandler.fromAbapGit;
    assert.ok(fromAbapGit);
    const includeXml = generatedContent(includeFiles, '.xml');
    const reportXml = generatedContent(reportFiles, '.xml');
    const generatedIncludeSource = generatedContent(includeFiles, '.abap');
    const generatedReportSource = generatedContent(reportFiles, '.abap');
    assert.equal(generatedIncludeSource, includeSource);
    assert.equal(generatedReportSource, reportSource);
    const include = fromAbapGit(programValuesFromXml(includeXml));
    const report = fromAbapGit(programValuesFromXml(reportXml));

    assert.equal(include.type, 'PROG/I');
    assert.ok(!('programType' in include));
    assert.equal(report.type, 'PROG/P');
    assert.ok('programType' in report);
    assert.equal(report.programType, 'executableProgram');
    const setSources = programHandler.setSources;
    assert.ok(setSources);
    const includeTarget: { _pendingSource?: string } = {};
    const reportTarget: { _pendingSource?: string } = {};
    setSources(includeTarget as never, { main: generatedIncludeSource });
    setSources(reportTarget as never, { main: generatedReportSource });
    assert.equal(includeTarget._pendingSource, generatedIncludeSource);
    assert.equal(reportTarget._pendingSource, generatedReportSource);
  });

  it('preserves module and subroutine program types in generated metadata', async () => {
    const moduleFiles = await programHandler.serialize({
      name: 'ZTEST_MODULE',
      kind: 'Program',
      isLoaded: true,
      dataSync: { programType: 'modulePool' },
      getSource: async () => 'PROGRAM ztest_module.',
    } as never);
    const subroutineFiles = await programHandler.serialize({
      name: 'ZTEST_SUBROUTINE',
      kind: 'Program',
      isLoaded: true,
      dataSync: { programType: 'subroutinePool' },
      getSource: async () => 'PROGRAM ztest_subroutine.',
    } as never);

    const fromAbapGit = programHandler.fromAbapGit;
    assert.ok(fromAbapGit);
    const moduleXml = generatedContent(moduleFiles, '.xml');
    const subroutineXml = generatedContent(subroutineFiles, '.xml');
    assert.match(moduleXml, /<SUBC>M<\/SUBC>/);
    assert.match(subroutineXml, /<SUBC>S<\/SUBC>/);
    const module = fromAbapGit(programValuesFromXml(moduleXml));
    const subroutine = fromAbapGit(programValuesFromXml(subroutineXml));
    assert.ok('programType' in module);
    assert.equal(module.programType, 'modulePool');
    assert.ok('programType' in subroutine);
    assert.equal(subroutine.programType, 'subroutinePool');
  });

  it('writes namespaced BDEF files below the target directory', async () => {
    const targetPath = createTempDir();
    const serializer = new AbapGitSerializer();

    const written = await serializer.serializeObjectPublic(
      {
        name: '/ACR/BEHAVIOR',
        type: 'BDEF',
        kind: 'BehaviorDefinition',
        getSource: async () =>
          'managed implementation in class zbp_acr unique;',
      } as never,
      targetPath,
      '',
    );

    assert.deepEqual(
      written.map((file) => file.slice(join(targetPath, 'src').length + 1)),
      ['acr/behavior.bdef.abdl', 'acr/behavior.bdef.json'],
    );
    assert.ok(existsSync(join(targetPath, 'src', 'acr', 'behavior.bdef.abdl')));
    assert.ok(existsSync(join(targetPath, 'src', 'acr', 'behavior.bdef.json')));
  });
});
