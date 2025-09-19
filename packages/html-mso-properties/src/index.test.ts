import { describe, expect, test } from 'vitest';

import msoProperties from './index';

describe('@ciolabs/html-mso-properties', () => {
  test('should export an array of MSO properties', () => {
    expect(Array.isArray(msoProperties)).toBe(true);
  });

  test('should have more than 400 properties', () => {
    expect(msoProperties.length).toBeGreaterThan(400);
  });

  test('should have font-color as the first property', () => {
    expect(msoProperties[0].property).toBe('font-color');
  });
});
