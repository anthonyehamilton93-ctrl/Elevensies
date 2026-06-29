// api/welcome-email.js
// Called by a Supabase Database Webhook when a new row is inserted into `profiles`.
// Sends a welcome email via Resend.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FROM_EMAIL = 'Elevensies <noreply@playelevensies.com>';
const GAME_URL = 'https://playelevensies.com';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function welcomeHTML(displayName, userId) {
  const name = displayName && !displayName.startsWith('user') ? displayName : 'there';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Elevensies</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#1a6b3c;font-family:'Jost',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#1a6b3c;padding:40px 20px;">
    <tr><td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:440px;background-color:#155c33;border-radius:16px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">
        <tr><td align="center" style="padding:44px 40px 20px 40px;">
          <h1 style="font-family:'Jost',sans-serif;font-size:32px;font-weight:800;color:#f0c020;margin:0;letter-spacing:0.1em;text-transform:uppercase;">ELEVENSIES</h1>
        </td></tr>
        <tr><td style="padding:0 40px;text-align:center;">
          <h2 style="font-family:'Jost',sans-serif;font-size:20px;font-weight:700;color:#ffffff;margin:0 0 12px 0;">Welcome, ${name}.</h2>
          <p style="font-family:'Jost',sans-serif;font-size:15px;line-height:22px;color:#e2e8f0;margin:0 0 28px 0;">
            Your account is set up and your stats are ready to track. The game opens every day at 11am — 10 tiles, 11 turns, one shot at the leaderboard. Your score counts even if you don't finish, so make every word count.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:0 40px 28px 40px;">
          <a href="${GAME_URL}" style="display:inline-block;background-color:#f0c020;color:#155c33;font-family:'Jost',sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.02em;text-transform:uppercase;">Play Elevensies</a>
        </td></tr>
        <tr><td align="center" style="padding:0 40px 44px 40px;">
          <a href="${GAME_URL}/api/subscribe?uid=${userId}" style="display:inline-block;border:2px solid rgba(240,192,32,0.5);color:#f0c020;font-family:'Jost',sans-serif;font-size:13px;font-weight:700;text-decoration:none;padding:10px 24px;border-radius:8px;letter-spacing:0.08em;text-transform:uppercase;">🔔 Remind me at 11am</a>
        </td></tr>
        <tr><td style="padding:20px 40px;background-color:#114b29;text-align:center;">
          <p style="font-family:'Jost',sans-serif;font-size:12px;line-height:18px;color:#8ba895;margin:0;">You're receiving this because you just created an Elevensies account. Check your junk folder for future emails!</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-webhook-secret'];
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { record } = req.body;
    if (!record?.id) return res.status(400).json({ error: 'No record in payload' });

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${record.id}`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const user = await authRes.json();
    if (!user?.email) return res.status(200).json({ message: 'No email found' });

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Welcome to Elevensies',
        html: welcomeHTML(record.display_name, record.id),
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('welcome-email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
