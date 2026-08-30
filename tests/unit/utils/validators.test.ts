import { isValidEmail, isValidPassword } from '../../../utils/validators';

describe('Validators Utility Tests', () => {
  describe('isValidEmail', () => {
    it('to\'g\'ri email formatini qabul qilishi kerak', () => {
      expect(isValidEmail('user@creova.ai')).toBe(true);
      expect(isValidEmail('test.dev@domain.uz')).toBe(true);
    });

    it('noto\'g\'ri email formatini rad etishi kerak', () => {
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('talablarga mos keladigan parol uchun true qaytarishi kerak', () => {
      expect(isValidPassword('Pass1234!')).toBe(true);
    });

    it('juda qisqa parolni rad etishi kerak', () => {
      expect(isValidPassword('123')).toBe(false);
    });
  });
});
