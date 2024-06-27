const express = require('express');
const router = express.Router();
const { validateToken } = require('../../middleware/auth');

router.post('/logout', (req, res) => {
  
});



module.exports = router;