// api/unsubscribe.js
// One-click unsubscribe from weekly emails.
// Linked from the footer of every weekly roundup email.
// ?uid=USER_ID sets email_unsubscribed = true on their profile.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  const { uid } = req.query;

  if (!uid) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('Something went wrong', 'No account ID was provided. Please contact us if you need help unsubscribing.'));
  }

  try {
    const { error } = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email_unsubscribed: true }),
    }).then(r => r.ok ? { error: null } : { error: true });

    if (error) throw new Error('Update failed');

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(page(
      "You've been unsubscribed",
      "You won't receive any more weekly emails from Elevensies. You can still sign in and play any time at playelevensies.com."
    ));
  } catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(page(
      'Something went wrong',
      'We couldn\'t process your request. Please try again or contact us directly.'
    ));
  }
}

function page(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Elevensies</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#1a6b3c;font-family:'Jost',-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:400px;background-color:#155c33;border-radius:16px;padding:48px 40px;text-align:center;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">
    <h1 style="font-size:32px;font-weight:800;color:#f0c020;letter-spacing:0.1em;margin:0 0 24px 0;">ELEVENSIES</h1>
    <h2 style="font-size:18px;font-weight:700;color:#ffffff;margin:0 0 12px 0;">${title}</h2>
    <p style="font-size:14px;line-height:1.6;color:#e2e8f0;margin:0 0 28px 0;">${message}</p>
    <a href="https://playelevensies.com" style="display:inline-block;background-color:#f0c020;color:#155c33;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:0.05em;text-transform:uppercase;">Back to the game</a>
  </div>
</body>
</html>`;
}
