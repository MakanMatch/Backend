const express = require("express");
const router = express.Router();
const Logger = require("../../services/Logger")
const OpenAIChat = require("../../services/OpenAIChat");

router.post("/queryMakanBotWithUserPrompt", async (req, res) => {
    const { messagePrompt, conversationHistory } = req.body;

    if (!OpenAIChat.checkPermission()) {
        return res.status(400).send("ERROR: OpenAIChat is not available at this time.");
    }

    const message = await OpenAIChat.prompt(
        messagePrompt,
        true,
        conversationHistory
    )

    if (typeof message === "string" && message.startsWith("ERROR:")) {
        Logger.log(`CHATBOT MAKANBOT QUERYMAKANBOTWITHUSERPROMPT ERROR: Failed to run prompt through OpenAIChat; response: ${message}`)
        return res.status(400).send("ERROR: Failed to run prompt. Try again later.");
    } else {
        return res.status(200).json({ message: message.content });
    }
});

module.exports = { router, at: '/makanBot' };