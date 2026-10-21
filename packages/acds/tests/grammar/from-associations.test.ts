/// <reference types="vitest/globals" />
// Vitest globals are enabled for this package (see vitest.config.ts).
import { parse } from '../../src/index';
import type {
  AssociationDeclaration,
  ViewEntityDefinition,
} from '../../src/ast';

function getView(src: string): ViewEntityDefinition {
  const r = parse(src);
  expect(r.errors).toHaveLength(0);
  return r.ast.definitions[0] as ViewEntityDefinition;
}

function cond(source: string | undefined): string {
  return (source ?? '').replace(/\s+/g, '');
}

describe('FROM-clause associations', () => {
  it('parses an association declared in the FROM clause', () => {
    const v = getView(`
      define view entity V as select from I_SampleItem as _Item
        association [0..1] to ZTEST_LastRelease as _LastRelease
          on _LastRelease.PurchaseRequisition = _Item.PurchaseRequisition
      {
        key _Item.k
      }
    `);

    expect(v.fromAssociations).toHaveLength(1);
    const a = v.fromAssociations?.[0] as AssociationDeclaration;
    expect(a.associationKind).toBe('association');
    expect(a.target).toBe('ZTEST_LastRelease');
    expect(a.alias).toBe('_LastRelease');
    expect(a.cardinality).toEqual({ min: 0, max: 1 });
    expect(cond(a.on?.source)).toBe(
      '_LastRelease.PurchaseRequisition=_Item.PurchaseRequisition',
    );
  });

  it('captures a $projection condition', () => {
    const v = getView(`
      define view entity V as select from I_SampleItem as _Item
        association [0..1] to I_SampleProduct as _Product
          on $projection.Product = _Product.Product
      {
        key _Item.k
      }
    `);

    const a = v.fromAssociations?.[0] as AssociationDeclaration;
    expect(cond(a.on?.source)).toBe('$projection.Product=_Product.Product');
  });

  it('captures a multiline $projection condition', () => {
    const v = getView(`
      define view entity V as select from I_SampleItem as _Item
        association [0..1] to I_SampleAccountAssignment as _Assgmt
          on  $projection.PurchaseRequisition = _Assgmt.PurchaseRequisition
          and $projection.PurchaseRequisitionItem = _Assgmt.PurchaseRequisitionItem
          and _Assgmt.PurchaseReqnAcctAssgmtNumber = '01'
      {
        key _Item.k
      }
    `);

    const a = v.fromAssociations?.[0] as AssociationDeclaration;
    expect(cond(a.on?.source)).toBe(
      '$projection.PurchaseRequisition=_Assgmt.PurchaseRequisition' +
        'and$projection.PurchaseRequisitionItem=_Assgmt.PurchaseRequisitionItem' +
        "and_Assgmt.PurchaseReqnAcctAssgmtNumber='01'",
    );
  });

  it('parses several FROM associations', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        association [0..1] to I_SampleProduct as _Product
          on $projection.Product = _Product.Product
        association [0..1] to I_SampleCompanyCode as _CompanyCode
          on $projection.CompanyCode = _CompanyCode.CompanyCode
      {
        key _Item.k
      }
    `);

    expect(v.fromAssociations).toHaveLength(2);
    expect(v.fromAssociations?.map((a) => a.target)).toEqual([
      'I_SampleProduct',
      'I_SampleCompanyCode',
    ]);
  });

  it('parses joins and FROM associations in the same FROM clause', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        left outer join ZI_Other as _Other on _Item.k = _Other.k
        association [0..1] to I_SampleProduct as _Product
          on $projection.Product = _Product.Product
      {
        key _Item.k
      }
    `);

    expect(v.joins).toHaveLength(1);
    expect(v.joins[0].joinType).toBe('leftOuter');
    expect(v.fromAssociations).toHaveLength(1);
    expect(v.fromAssociations?.[0].target).toBe('I_SampleProduct');
  });

  it('keeps FROM associations apart from element list associations', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        association [0..1] to I_SampleProduct as _Product
          on $projection.Product = _Product.Product
      {
        key _Item.k,
        association [0..1] to I_Text as _Text on _Item.k = _Text.k
      }
    `);

    expect(v.fromAssociations).toHaveLength(1);
    expect(v.fromAssociations?.[0].alias).toBe('_Product');

    const elementAssociations = v.members.filter(
      (m) => 'associationKind' in m,
    ) as AssociationDeclaration[];
    expect(elementAssociations).toHaveLength(1);
    expect(elementAssociations[0].alias).toBe('_Text');
  });

  it('parses a composition in the FROM clause', () => {
    const v = getView(`
      define view entity V as select from I_Item as _Item
        composition [0..*] of I_Text as _Text on _Item.k = _Text.k
      {
        key _Item.k
      }
    `);

    const a = v.fromAssociations?.[0] as AssociationDeclaration;
    expect(a.associationKind).toBe('composition');
    expect(a.target).toBe('I_Text');
    expect(a.cardinality).toEqual({ min: 0, max: '*' });
  });

  it('does not classify an association by its underscore-prefixed name', () => {
    // The alias alone says nothing about the kind of the declaration —
    // the parser records what was written.
    const v = getView(`
      define view entity V as select from I_Item as _Item
        association [1..1] to I_SampleProduct as _Product
          on $projection.Product = _Product.Product
      {
        key _Item.k
      }
    `);

    const a = v.fromAssociations?.[0] as AssociationDeclaration;
    expect(a.associationKind).toBe('association');
    expect(a.targetMultiplicity).toBeUndefined();
    expect(a.cardinality).toEqual({ min: 1, max: 1 });
  });
});
