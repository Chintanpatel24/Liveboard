module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    pusherKey:     process.env.PUSHER_KEY     || '',
    pusherCluster: process.env.PUSHER_CLUSTER || '',
    configured:    !!(process.env.PUSHER_KEY && process.env.PUSHER_CLUSTER),
  });
};
