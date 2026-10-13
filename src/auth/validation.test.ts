import { describe, expect, it } from 'vitest';
import { mapChangePasswordErrors, validateChangePassword } from '@/auth/validation';

const valid = { currentPassword: 'old-pass-1', newPassword: 'new-pass-1', confirmPassword: 'new-pass-1' };

describe('validateChangePassword', () => {
  it('accepts a valid change', () => {
    expect(validateChangePassword(valid, null)).toEqual({});
  });

  it.each([
    [{ currentPassword: '' }, 'currentPassword', 'Enter your current password.'],
    [{ newPassword: 'short', confirmPassword: 'short' }, 'newPassword', 'Use at least 8 characters.'],
    [{ newPassword: 'old-pass-1', confirmPassword: 'old-pass-1' }, 'newPassword', 'Choose a password different from your current one.'],
    [{ confirmPassword: 'new-pass-2' }, 'confirmPassword', "Passwords don't match."],
  ])('%o → %s', (change, field, message) => {
    expect(validateChangePassword({ ...valid, ...change }, null)[field]).toBe(message);
  });

  it('rejects the login ID as the new password', () => {
    const errors = validateChangePassword({ ...valid, newPassword: '21BAL042', confirmPassword: '21BAL042' }, '21BAL042');
    expect(errors.newPassword).toBe("Don't use your roll no. or employee ID as your password.");
  });
});

describe('mapChangePasswordErrors', () => {
  it('uses the spec copy for the three known server messages', () => {
    expect(mapChangePasswordErrors('currentPassword: is incorrect')).toEqual({
      currentPassword: 'Your current password is incorrect.',
    });
    expect(
      mapChangePasswordErrors(
        'newPassword: must be different from the current password, currentPassword: is incorrect',
      ),
    ).toEqual({
      newPassword: 'Choose a password different from your current one.',
      currentPassword: 'Your current password is incorrect.',
    });
    expect(mapChangePasswordErrors('newPassword: must not be your login ID')).toEqual({
      newPassword: "Don't use your roll no. or employee ID as your password.",
    });
  });

  it('falls back to the server reason, and to null for unknown paths', () => {
    expect(mapChangePasswordErrors('newPassword: must not be blank')).toEqual({ newPassword: 'Must not be blank.' });
    expect(mapChangePasswordErrors('somethingElse: nope')).toBeNull();
  });
});
