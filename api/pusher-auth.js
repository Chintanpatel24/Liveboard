const Pusher = require('pusher');

const NAMES = [
  'Alex','Blake','Casey','Drew','Ellis','Finn',
  'Gray','Harper','Indigo','Jordan','Kit','Lee',
  'Morgan','Nova','Quinn','River','Sage','Taylor'
];

module.exports = async (req, res) => {
  // CORS for same-origin is fine; add header if deploying frontend separately
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;

  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    console.error('Missing Pusher env vars');
    return res.status(500).json({ error: 'Server not configured. Set Pusher env vars in Vercel.' });
  }

  const pusher = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });

  // Vercel auto-parses application/x-www-form-urlencoded bodies
  const socket_id    = req.body?.socket_id    || '';
  const channel_name = req.body?.channel_name || '';

  if (!socket_id || !channel_name) {
    return res.status(400).json({ error: 'Missing socket_id or channel_name' });
  }

  // Build a stable-ish user name from the socket id
  const hash   = socket_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const name   = NAMES[hash % NAMES.length] + '-' + ((hash * 7) % 90 + 10);
  const userId = socket_id.replace('.', '_');

  const auth = pusher.authorizeChannel(socket_id, channel_name, {
    user_id:   userId,
    user_info: { name },
  });

  res.json(auth);
};
