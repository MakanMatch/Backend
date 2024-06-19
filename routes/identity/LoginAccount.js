const express = require('express');
const router = express.Router();
const { Guest } = require('../../models');
const Encryption = require('../../services/Encryption');
require('dotenv').config();

router.post("/", async (req, res) => {
  console.log("received")
  let data = req.body;
  console.log(data)

  try {
    // Check username or email
    let guest;
    if (data.usernameOrEmail.includes('@')) {
      guest = await Guest.findOne({
        where: { email: data.usernameOrEmail }
      });
    } else {
      guest = await Guest.findOne({
        where: { username: data.usernameOrEmail }
      });
    }
    if (!guest) {
      res.status(400).json({ message: "Invalid username or email or password." });
      return;
    }

   // Check password
    let passwordMatch = await Encryption.compare(data.password, guest.password);
    if (!passwordMatch) {
      res.status(400).json({ message: "Invalid username or email or password." });
      return;
    }

    // Login success
    res.json({
      message: `Logged in successfully.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;