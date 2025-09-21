import { getBrowserInfo, isMobile, isIOSMobile, isSpeechRecognitionSupported } from '../browser';

// Mock navigator for testing
const mockNavigator = (userAgent: string) => {
  Object.defineProperty(window, 'navigator', {
    value: { userAgent },
    writable: true,
  });
};

describe('browser utils', () => {
  describe('getBrowserInfo', () => {
    it('should detect mobile browsers', () => {
      mockNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)');
      const info = getBrowserInfo();
      expect(info.isMobile).toBe(true);
      expect(info.isIOSMobile).toBe(true);
    });

    it('should detect desktop browsers', () => {
      mockNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      const info = getBrowserInfo();
      expect(info.isMobile).toBe(false);
      expect(info.isIOSMobile).toBe(false);
    });
  });

  describe('isMobile', () => {
    it('should return true for mobile user agents', () => {
      mockNavigator('Mozilla/5.0 (Android 10; Mobile; rv:68.0) Gecko/68.0 Firefox/68.0');
      // Note: We need to re-import to get updated values
      jest.resetModules();
      const { isMobile } = require('../browser');
      expect(isMobile).toBe(true);
    });
  });
});