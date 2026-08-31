function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function nonEmpty(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= (max || 500);
}

module.exports = { isEmail, nonEmpty };
