const { handleUpload } = require('@vercel/blob/client');
const { getSessionUser, readBody } = require('./_lib');

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
    const session = getSessionUser(req);
    if (!session || session.type !== 'promoteur' || !session.promoterId) { res.status(403).json({ error: 'interdit' }); return; }

    const body = await readBody(req);

    const jsonResponse = await handleUpload({
      body,
      request: {
        headers: { get: function (name) { return req.headers[String(name).toLowerCase()]; } },
        url: 'https://' + req.headers.host + req.url
      },
      onBeforeGenerateToken: async function () {
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,
          maximumSizeInBytes: 10 * 1024 * 1024
        };
      }
    });

    res.status(200).json(jsonResponse);
  } catch (err) {
    res.status(400).json({ error: 'upload failed', detail: String(err && err.message || err) });
  }
};
