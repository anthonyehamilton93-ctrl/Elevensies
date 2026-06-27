// api/weekly-roundup.js
// Called by a Supabase pg_cron job every Sunday at 6pm UTC.
// Fetches the top 10 leaderboard + weekly activity stats and emails all players.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FROM_EMAIL = 'Elevensies <noreply@playelevensies.com>';
const GAME_URL = 'https://playelevensies.com';
const CRON_SECRET = process.env.CRON_SECRET;

async function query(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  return res.json();
}

function roundupHTML(leaderboardRows, weekGames, topWord) {
  const leaderboardHTML = leaderboardRows.map((row, i) => `
    <tr>
      <td style="padding:8px 12px;font-family:'Jost',sans-serif;font-size:14px;color:#f0c020;font-weight:700;">${i + 1}</td>
      <td style="padding:8px 12px;font-family:'Jost',sans-serif;font-size:14px;color:#e2e8f0;">${row.name}</td>
      <td style="padding:8px 12px;font-family:'Jost',sans-serif;font-size:14px;color:#e2e8f0;text-align:right;">${Math.round(row.avg)} avg</td>
      <td style="padding:8px 12px;font-family:'Jost',sans-serif;font-size:14px;color:#f0c020;font-weight:700;text-align:right;">${row.best}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>This Week in Elevensies</title>
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

        <tr><td style="padding:0 40px 24px;text-align:center;">
          <h2 style="font-family:'Jost',sans-serif;font-size:20px;font-weight:700;color:#ffffff;margin:0 0 8px 0;">This week's roundup</h2>
          <p style="font-family:'Jost',sans-serif;font-size:14px;color:#e2e8f0;margin:0;">${weekGames} games played this week${topWord ? ` · best word: <strong style="color:#f0c020;">${topWord}</strong>` : ''}</p>
        </td></tr>

        <!-- Leaderboard table -->
        <tr><td style="padding:0 24px 32px;">
          <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr style="border-bottom:1px solid rgba(240,192,32,0.3);">
              <td style="padding:6px 12px;font-family:'Jost',sans-serif;font-size:11px;color:#8ba895;letter-spacing:0.1em;">#</td>
              <td style="padding:6px 12px;font-family:'Jost',sans-serif;font-size:11px;color:#8ba895;letter-spacing:0.1em;">PLAYER</td>
              <td style="padding:6px 12px;font-family:'Jost',sans-serif;font-size:11px;color:#8ba895;letter-spacing:0.1em;text-align:right;">AVG</td>
              <td style="padding:6px 12px;font-family:'Jost',sans-serif;font-size:11px;color:#8ba895;letter-spacing:0.1em;text-align:right;">BEST</td>
            </tr>
            ${leaderboardHTML}
          </table>
        </td></tr>

        <tr><td align="center" style="padding:0 40px 44px 40px;">
          <a href="${GAME_URL}" style="display:inline-block;background-color:#f0c020;color:#155c33;font-family:'Jost',sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.02em;text-transform:uppercase;">Play This Week</a>
        </td></tr>

        <tr><td style="padding:20px 40px;background-color:#114b29;text-align:center;">
          <p style="font-family:'Jost',sans-serif;font-size:12px;line-height:18px;color:#8ba895;margin:0;">You're receiving this as a registered Elevensies player. Reply to unsubscribe.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  // Verify secret so only pg_cron can trigger this
  const secret = req.headers['x-cron-secret'];
  if (CRON_SECRET && secret !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1. Fetch all completed game results
    const results = await query('/game_results?select=user_id,total_score,best_word,best_word_score,played_at&game_status=eq.completed');

    // 2. Aggregate per user: avg score, best score
    const map = {};
    for (const r of results) {
      if (!map[r.user_id]) map[r.user_id] = { total: 0, count: 0, best: 0, bestWord: null, bestWordScore: 0 };
      map[r.user_id].total += r.total_score;
      map[r.user_id].count++;
      if (r.total_score > map[r.user_id].best) map[r.user_id].best = r.total_score;
      if (r.best_word_score > map[r.user_id].bestWordScore) {
        map[r.user_id].bestWordScore = r.best_word_score;
        map[r.user_id].bestWord = r.best_word;
      }
    }

    // 3. Fetch display names
    const profiles = await query('/profiles?select=id,display_name');
    const nameMap = {};
    if (Array.isArray(profiles)) profiles.forEach(p => { nameMap[p.id] = p.display_name; });

    // 4. Build top 10 leaderboard by average score (3+ games)
    const leaderboard = Object.entries(map)
      .filter(([, u]) => u.count >= 3)
      .map(([id, u]) => ({ id, name: nameMap[id] || 'Player', avg: u.total / u.count, best: u.best }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);

    // 5. This week's stats
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekResults = results.filter(r => r.played_at > oneWeekAgo);
    const weekGames = weekResults.length;
    const topWordThisWeek = weekResults.reduce((best, r) =>
      r.best_word_score > (best?.best_word_score || 0) ? r : best, null);

    // 6. Fetch all confirmed users
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const { users } = await authRes.json();
    const recipients = (users || []).filter(u => u.email && u.email_confirmed_at).map(u => u.email);

    if (recipients.length === 0) return res.status(200).json({ message: 'No recipients' });

    const html = roundupHTML(leaderboard, weekGames, topWordThisWeek?.best_word || null);

    // 7. Send in batches of 100 (Resend batch limit)
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100).map(email => ({
        from: FROM_EMAIL, to: email,
        subject: "This week in Elevensies",
        html,
      }));
      await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    }

    return res.status(200).json({ sent: recipients.length, weekGames });
  } catch (err) {
    console.error('weekly-roundup error:', err);
    return res.status(500).json({ error: err.message });
  }
}
