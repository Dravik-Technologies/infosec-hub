'use strict';

const express = require('express');
const { createAccessRequest } = require('../../../packages/db/src/accessRequests');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await createAccessRequest(req.body || {});
    res.status(result.created ? 201 : 200).json({
      ok: true,
      created: result.created,
      request: result.request,
      message: result.created
        ? 'Your access request has been submitted to HUB administrators.'
        : 'A pending request already exists for this user and app.',
    });
  } catch (err) {
    if (err.message && (err.message.includes('required') || err.message.includes('valid appId'))) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[HUB access requests]', err.message);
    res.status(500).json({ error: 'Unable to submit access request' });
  }
});

module.exports = router;
