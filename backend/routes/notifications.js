const router = require('express').Router();
const db     = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    res.json(await db.rows(
      `SELECT * FROM notifications WHERE client_id = $1 ORDER BY id DESC LIMIT 20`,
      [req.user.id]
    ));
  } catch (e) { next(e); }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res, next) => {
  try {
    await db.query(
      `UPDATE notifications SET read = true WHERE client_id = $1 AND read = false`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
