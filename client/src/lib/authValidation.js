export function validateAuth(values, register = false) {
  const errors = {};
  if (register && (values.name.trim().length < 2 || values.name.trim().length > 100)) errors.name = 'Use a name between 2 and 100 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (new TextEncoder().encode(values.password).length > 72) errors.password = 'Password must be at most 72 UTF-8 bytes.';
  return errors;
}
