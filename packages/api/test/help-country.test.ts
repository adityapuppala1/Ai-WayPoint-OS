import { describe, expect, it } from 'vitest';
import { helpCountry } from '../src/services/me';

describe('where to find help', () => {
  it('uses the country the person chose', () => {
    expect(helpCountry({ country: 'GH', timezone: 'Africa/Nairobi' })).toBe('GH');
  });

  it('falls back to the country of their time zone, including old zone names', () => {
    expect(helpCountry({ country: null, timezone: 'Africa/Nairobi' })).toBe('KE');
    expect(helpCountry({ country: null, timezone: 'Asia/Calcutta' })).toBe('IN');
  });

  it('knows nothing when neither says where they are', () => {
    expect(helpCountry({ country: null, timezone: 'UTC' })).toBeNull();
    expect(helpCountry({ country: null })).toBeNull();
  });
});
