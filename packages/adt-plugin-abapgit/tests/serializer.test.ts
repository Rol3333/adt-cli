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
