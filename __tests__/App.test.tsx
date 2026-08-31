/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders and unmounts cleanly (clears the midnight timer)', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(renderer.toJSON()).not.toBeNull();
  // App arms a setTimeout for the next midnight; without this unmount an
  // in-band (single-file) jest run never exits.
  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});
