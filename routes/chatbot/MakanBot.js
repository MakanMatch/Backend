const express = require("express");
const multer = require("multer");
const router = express.Router();
const { FoodListing } = require("../../models");
const { Host, Guest, UserRecord, FavouriteListing } = require("../../models");
const Universal = require("../../services/Universal");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger")
const { storeImages } = require("../../middleware/storeImages");
const axios = require("axios");
const yup = require("yup");
const { validateToken } = require("../../middleware/auth");
const { Op } = require("sequelize");
const OpenAIChat = require("../../services/OpenAIChat");

router.post("/queryMakanBotWithUserPrompt", validateToken, async (req, res) => {
    const { messagePrompt, conversationHistory } = req.body;

    console.log("Message Prompt: ", messagePrompt);
    console.log("Conversation History: ", conversationHistory);

    (async () => {
        const message = await OpenAIChat.prompt(
            messagePrompt,
            true,
            conversationHistory
        )
        res.status(200).json({ message: message.content });
    })();
});



module.exports = { router, at: '/makanBot' };