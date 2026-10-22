import { beforeEach, describe, expect, it, vi } from 'vitest';

const factoryGet = vi.fn();
const formatImport = vi.fn();
const quickSearch = vi.fn();

vi.mock('@abapify/adk', () => ({
  AdkPackage: {
    get: vi.fn(async () => ({ superPackage: undefined })),
  },
  AdkTransport: { get: vi.fn() },
  MergedTransportView: class {},
  matchesSelector: vi.fn(),
  createAdkFactory: vi.fn(() => ({ get: factoryGet })),
  getGlobalContext: vi.fn(() => ({
    client: {
      adt: {
        repository: {
          informationsystem: {
            search: {
              quickSearch,
            },
          },
        },
      },
    },
  })),
}));

vi.mock('../../../src/utils/format-loader', () => ({
  loadFormatPlugin: vi.fn(async () => ({
    name: 'abapGit',
    description: 'abapGit format plugin',
    instance: {
      registry: { isSupported: vi.fn(() => true) },
      format: { import: formatImport },
      hooks: {},
    },
  })),
  parseFormatSpec: vi.fn(() => ({ package: '@abapify/adt-plugin-abapgit' })),
}));

vi.mock('../../../src/utils/destinations', () => ({
  getConfig: vi.fn(async () => ({ raw: {} })),
}));

describe('ImportService.importObject()', () => {
  beforeEach(() => {
    factoryGet.mockReset();
    formatImport.mockReset();
    quickSearch.mockReset();
    factoryGet.mockImplementation((_name, type) => ({
      type,
      load: vi.fn(async () => undefined),
    }));
    formatImport.mockResolvedValue({ success: true, filesCreated: [] });
    quickSearch.mockResolvedValue({
      objectReference: [
        {
          name: 'Z_SHARED_NAME',
          type: 'BDEF/BDO',
          packageName: 'ZPKG',
        },
        {
          name: 'Z_SHARED_NAME',
          type: 'DDLX',
          packageName: 'ZPKG',
        },
      ],
    });
  });

  it('selects the requested type when the same name belongs to multiple object types', async () => {
    const { ImportService } =
      await import('../../../src/services/import/service');

    const result = await new ImportService().importObject({
      objectName: 'Z_SHARED_NAME',
      objectType: 'DDLX',
      outputPath: '/tmp/import-object',
      format: 'abapgit',
    });

    expect(factoryGet).toHaveBeenCalledWith('Z_SHARED_NAME', 'DDLX');
    expect(result.objectType).toBe('DDLX');
  });

  it('requires an explicit type when the same name belongs to multiple object types', async () => {
    const { ImportService } =
      await import('../../../src/services/import/service');

    await expect(
      new ImportService().importObject({
        objectName: 'Z_SHARED_NAME',
        outputPath: '/tmp/import-object',
        format: 'abapgit',
      }),
    ).rejects.toThrow(
      "Object 'Z_SHARED_NAME' is ambiguous. Use --object-type to select one of: BDEF, DDLX.",
    );
    expect(factoryGet).not.toHaveBeenCalled();
  });

  it('uses the full search type for the factory while checking format support by CTS base type', async () => {
    quickSearch.mockResolvedValue({
      objectReference: [
        {
          name: 'ZAPI_STRUCTURE',
          type: 'TABL/DS',
          packageName: 'ZPKG',
        },
      ],
    });
    const { ImportService } =
      await import('../../../src/services/import/service');

    const result = await new ImportService().importObject({
      objectName: 'ZAPI_STRUCTURE',
      objectType: 'TABL',
      outputPath: '/tmp/import-object',
      format: 'abapgit',
    });

    expect(factoryGet).toHaveBeenCalledWith('ZAPI_STRUCTURE', 'TABL/DS');
    expect(result.objectType).toBe('TABL');
  });
});
