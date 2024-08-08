const express = require("express");
const multer = require("multer");
const Logger = require("../../services/Logger");
const FileManager = require("../../services/FileManager");
const { storeImage } = require("../../middleware/storeImage");
const {ChatHistory, ChatMessage} = require("../../models");
const Universal = require("../../services/Universal");
const router = express.Router();
const validateToken = require("../../middleware/validateToken");

router.post("/createImageMessage", validateToken, async(req, res) => {
    storeImage(req, res, async(err) => {
        const imageFile = req.file;
        const message = req.body;
        if (!imageFile && !message) {
            return res.status(400).send("No images and message was uploaded.")
        } else {
            if (err instanceof multer.MulterError) {
                Logger.log(`CHAT MANAGECHAT CREATEIMAGEMESSAGE ERROR: ${err.message}`)
                return res.status(500).send("ERROR: Error creating message with image")
            } else if (err) {
                Logger.log(`CHAT MANAGECHAT CREATEIMAGEMESSAGE ERROR: ${err.message}`)
                return res.status(500).send("ERROR: Error creating message with image")
            }
        }
        const uploadImageResponse = await FileManager.saveFile(imageFile.filename);
        if (uploadImageResponse !== true) {
            return res.status(500).send("ERROR: Failed to upload image to storage.");
        }

        //Validate the message that the user is trying to create

        if (!message.chatID || !req.user.userID || !message.message || !message.datetime) {
            return res.status(400).send("ERROR: Invalid message.")
        }
        var newMessage = {
            messageID: Universal.generateUniqueID(),
            chatID: message.chatID,
            senderID: req.user.userID,
            message: message.message,
            datetime: message.datetime,
            image: imageFile.filename,
            replyToID: message.replyToID || null
        }

        const creatingMessage = await ChatMessage.create(newMessage);
        if (!creatingMessage) {
            return res.status(500).send("ERROR: Failed to create message.")
        }
        
        res.status(200).json({ message: "SUCCESS: Image uploaded successfully.", imageName: imageFile.filename })
    })
});

module.exports = { router, at: "/chat" };