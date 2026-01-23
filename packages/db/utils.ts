/**
 * Database utility functions
 */

/**
 * Generate a unique 16-character alphanumeric doctor code
 * Format: XXXX-XXXX-XXXX-XXXX for readability
 */
export function generateDoctorCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    // Add hyphens for readability (every 4 characters)
    if ((i + 1) % 4 === 0 && i < 15) {
      code += '-';
    }
  }
  
  return code;
}

/**
 * Validate doctor code format
 * Must be exactly 16 alphanumeric characters (hyphens optional)
 */
export function validateDoctorCode(code: string): boolean {
  if (!code) return false;
  
  // Remove hyphens for validation
  const cleanCode = code.replace(/-/g, '');
  
  // Must be exactly 16 alphanumeric characters
  return /^[A-Z0-9]{16}$/i.test(cleanCode);
}

/**
 * Normalize doctor code (remove hyphens, uppercase)
 */
export function normalizeDoctorCode(code: string): string {
  return code.replace(/-/g, '').toUpperCase();
}
