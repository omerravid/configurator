import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateJSON,
  sanitizeString,
  isValidUsername,
  validateConfigName,
} from '../utils/validation';

describe('validation utilities', () => {
  describe('validatePassword', () => {
    it('accepts valid passwords', () => {
      const result = validatePassword('SecurePass123');
      expect(result.valid).toBe(true);
    });

    it('rejects passwords that are too short', () => {
      const result = validatePassword('short1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });

    it('rejects passwords without numbers', () => {
      const result = validatePassword('PasswordOnly');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('letter and one number');
    });

    it('rejects passwords without letters', () => {
      const result = validatePassword('12345678');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('letter and one number');
    });

    it('rejects passwords that are too long', () => {
      const result = validatePassword('a'.repeat(129) + '1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('too long');
    });
  });

  describe('validateJSON', () => {
    it('accepts valid JSON', () => {
      const result = validateJSON('{"key": "value"}');
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual({ key: 'value' });
    });

    it('rejects invalid JSON', () => {
      const result = validateJSON('{invalid}');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid JSON');
    });

    it('rejects empty strings', () => {
      const result = validateJSON('');
      expect(result.valid).toBe(false);
    });

    it('rejects non-string input', () => {
      const result = validateJSON(123);
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('escapes HTML entities', () => {
      const result = sanitizeString('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('handles empty strings', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });

    it('handles special characters', () => {
      const result = sanitizeString('Test & "quotes" <tags>');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
      expect(result).toContain('&lt;');
    });
  });

  describe('isValidUsername', () => {
    it('accepts valid usernames', () => {
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('test_user')).toBe(true);
      expect(isValidUsername('user-name')).toBe(true);
    });

    it('rejects usernames that are too short', () => {
      expect(isValidUsername('ab')).toBe(false);
    });

    it('rejects usernames that are too long', () => {
      expect(isValidUsername('a'.repeat(31))).toBe(false);
    });

    it('rejects usernames with invalid characters', () => {
      expect(isValidUsername('user@name')).toBe(false);
      expect(isValidUsername('user name')).toBe(false);
      expect(isValidUsername('user.name')).toBe(false);
    });
  });

  describe('validateConfigName', () => {
    it('accepts valid configuration names', () => {
      const result = validateConfigName('MyConfig');
      expect(result.valid).toBe(true);
    });

    it('rejects empty names', () => {
      const result = validateConfigName('   ');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('cannot be empty');
    });

    it('rejects names with path traversal', () => {
      const result = validateConfigName('../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('path separators');
    });

    it('rejects names that are too long', () => {
      const result = validateConfigName('a'.repeat(101));
      expect(result.valid).toBe(false);
      expect(result.message).toContain('too long');
    });
  });
});

