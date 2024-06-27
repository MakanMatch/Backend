const express = require('express');
const router = express.Router();
const { validateToken } = require('../../middleware/auth');

router.get('/MyAccount', validateToken, (req, res) => {
  // Get the user's information from the JWT token
  const userInfo = req.user;

  // Render the MyAccount component with the user's information as a prop
  res.render('MyAccount', { userInfo });
});

module.exports = router;