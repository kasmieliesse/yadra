const { db } = require('./_lib/db');

module.exports = async function handler(req, res) {
  const appUrl = process.env.APP_URL || 'https://yadra.fr';
  const token = (req.query && req.query.token) || '';

  function redirect(status) {
    res.writeHead(302, { Location: appUrl + '/?email_verified=' + status });
    res.end();
  }

  if (!token) return redirect('missing');

  try {
    const sql = db();
    const rows = await sql`
      select id, verify_token_expires from users where verify_token = ${token} and email_verified = false
    `;
    if (!rows.length) return redirect('invalid');

    const user = rows[0];
    if (new Date(user.verify_token_expires).getTime() < Date.now()) {
      return redirect('expired');
    }

    await sql`update users set email_verified = true, verify_token = null, verify_token_expires = null where id = ${user.id}`;
    return redirect('success');
  } catch (err) {
    console.error('verify-email error:', err);
    return redirect('error');
  }
};
