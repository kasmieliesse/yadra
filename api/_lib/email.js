const { Resend } = require('resend');

function resendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY manquant (variable d\'environnement Vercel).');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM || 'yadra! <notifications@yadra.fr>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'eliesse13100@proton.me';

async function sendVerificationEmail(to, firstName, verifyUrl) {
  const resend = resendClient();
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Confirmez votre adresse email — yadra!',
    html:
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0A0A0A;color:#E6E6E6;">' +
      '<h1 style="font-size:22px;color:#fff;margin:0 0 16px;">Bienvenue sur yadra!, ' + escapeHtml(firstName) + '</h1>' +
      '<p style="font-size:14px;line-height:1.6;color:#9C9C9C;">Confirmez votre adresse email pour activer votre compte.</p>' +
      '<a href="' + verifyUrl + '" style="display:inline-block;margin-top:20px;padding:12px 24px;border-radius:999px;background:linear-gradient(135deg,#D89A78,#B76E4D);color:#fff;text-decoration:none;font-weight:700;font-size:13px;">Vérifier mon email</a>' +
      '<p style="font-size:12px;color:#9C9C9C;margin-top:24px;">Ce lien expire dans 24 heures. Si vous n\'êtes pas à l\'origine de cette inscription, ignorez cet email.</p>' +
      '</div>'
  });
}

async function sendLeadNotification(lead) {
  const resend = resendClient();
  var typeLabel = lead.type === 'promoter_application' ? 'Candidature promoteur'
    : lead.type === 'project_inquiry' ? 'Demande sur un projet' : 'Contact général';
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    replyTo: lead.email || undefined,
    subject: '[yadra!] ' + typeLabel + (lead.project_name ? ' — ' + lead.project_name : ''),
    html:
      '<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111;">' +
      '<h2 style="margin:0 0 12px;">' + typeLabel + '</h2>' +
      (lead.project_name ? ('<p><b>Projet :</b> ' + escapeHtml(lead.project_name) + '</p>') : '') +
      '<p><b>Nom :</b> ' + escapeHtml(lead.name) + '</p>' +
      (lead.email ? ('<p><b>Email :</b> ' + escapeHtml(lead.email) + '</p>') : '') +
      (lead.phone ? ('<p><b>Téléphone :</b> ' + escapeHtml(lead.phone) + '</p>') : '') +
      (lead.message ? ('<p><b>Message :</b><br>' + escapeHtml(lead.message).replace(/\n/g, '<br>') + '</p>') : '') +
      '</div>'
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

module.exports = { sendVerificationEmail, sendLeadNotification, ADMIN_EMAIL };
