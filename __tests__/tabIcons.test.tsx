/**
 * @format
 *
 * Tab-bar icons: a `color` tint must flatten every drawn fill/stroke, so no
 * pale Figma duotone layer (#EAECF0 at 45% was invisible) survives on the
 * tab bar — while untinted icons keep their duotone fills.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BasketIcon, MedalIcon, ProfileIcon } from '../src/components/icons';

const xmlsOf = async (el: React.ReactElement): Promise<string[]> => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(el);
  });
  const xmls = r.root
    .findAll(n => typeof n.props.xml === 'string')
    .map(n => n.props.xml as string);
  await ReactTestRenderer.act(() => r.unmount());
  return xmls;
};

test.each([
  ['Medal', MedalIcon],
  ['Profile', ProfileIcon],
  ['Basket', BasketIcon],
])('%s icon tints every layer', async (_name, Icon) => {
  const xmls = await xmlsOf(<Icon color="#3843FF" />);
  expect(xmls.length).toBeGreaterThan(0);
  for (const xml of xmls) {
    expect(xml).toContain('#3843FF');
    expect(xml).not.toMatch(/#EAECF0|#CDCDD0|#040415|#9B9BA1/i);
  }
});

test('untinted icons keep the duotone fills', async () => {
  const xmls = await xmlsOf(<ProfileIcon />);
  expect(xmls.join(' ')).toMatch(/#040415|#9B9BA1|#EAECF0|#CDCDD0/i);
});
