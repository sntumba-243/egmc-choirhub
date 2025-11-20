/**
 * Generate a secure random password
 * @param length Password length (default: 16)
 * @returns Secure random password
 */
export const generateSecurePassword = (length: number = 16): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
};

/**
 * Generate a memorable but secure password
 * Format: Word-Word-####
 */
export const generateMemorablePassword = (): string => {
  const words = [
    'Chorus', 'Melody', 'Harmony', 'Rhythm', 'Tempo', 'Pitch',
    'Voice', 'Song', 'Music', 'Note', 'Scale', 'Choir'
  ];
  
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const numbers = Math.floor(1000 + Math.random() * 9000);
  
  return `${word1}${word2}${numbers}`;
};
