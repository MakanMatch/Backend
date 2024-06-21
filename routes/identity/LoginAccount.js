const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const Encryption = require('../../services/Encryption');
require('dotenv').config();

router.post("/", async (req, res) => {
  console.log("received");
  let data = req.body;
  console.log(data);

  try {
    let user;
    let userType;

    // Function to find user by email or username
    const findUser = async (model, identifier) => {
      if (identifier.includes('@')) {
        return await model.findOne({ where: { email: identifier } });
      } else {
        return await model.findOne({ where: { username: identifier } });
      }
    };

    // Check in Guest
    user = await findUser(Guest, data.usernameOrEmail);
    userType = 'Guest';

    // Check in Host if not found in Guest
    if (!user) {
      user = await findUser(Host, data.usernameOrEmail);
      userType = 'Host';
    }

    // Check in Admin if not found in Guest or Host
    if (!user) {
      user = await findUser(Admin, data.usernameOrEmail);
      userType = 'Admin';
    }

    // If user is not found in any of the models
    if (!user) {
      res.status(400).json({ message: "Invalid username or email or password." });
      return;
    }

    // Check password
    let passwordMatch = await Encryption.compare(data.password, user.password);
    if (!passwordMatch) {
      res.status(400).json({ message: "Invalid username or email or password." });
      return;
    }

    // Login success
    res.json({
      message: `Logged in successfully as ${userType}.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;