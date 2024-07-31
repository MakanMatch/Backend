const express = require("express");
const multer = require("multer");
const Logger = require("../../services/Logger");
const FileManager = require("../../services/FileManager");
const { storeImage } = require("../../middleware/storeImage");
const {ChatHistory, ChatMessage} = require("../../models");
const Universal = require("../../services/Universal");
const router = express.Router();

router.post("/createImageMessage", async(req, res) => {
    storeImage(req, res, async(err) => {
        const imageFile = req.file;
        const message = req.body;
        if (!imageFile && !message) {
            return res.status(400).send("No images and message was uploaded.")
        } else {
            if (err instanceof multer.MulterError) {
                Logger.log(`CHAT UPLOADIMAGE ERROR: ${err.message}`)
                return res.status(400).send("UERROR: " + err.message)
            } else if (err) {
                Logger.log(`CHAT UPLOADIMAGE INTERNAL SERVER ERROR: ${err.message}`)
                return res.status(500).send("ERROR: " + err.message)
            }
        }
        const uploadImageResponse = await FileManager.saveFile(imageFile.filename);
        var newMessage = {
            messageID: Universal.generateUniqueID(),
            chatID: message.chatID,
            senderID: message.senderID,
            message: message.message,
            datetime: message.datetime,
            image: imageFile.filename,
        }

        const creatingMessage = await ChatMessage.create(newMessage);
        if (!creatingMessage) {
            return res.status(500).send("ERROR: Failed to create message.")
        }
        if (uploadImageResponse) {
            res.status(200).json({ message: "SUCCESS: Image uploaded successfully.", imageName: imageFile.filename })
        } else {
            res.status(500).send("ERROR: Failed to upload image to storage.")
        }
    })
});

module.exports = { router, at: "/chat" };