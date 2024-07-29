const express = require("express");
const multer = require("multer");
const Logger = require("../../services/Logger");
const FileManager = require("../../services/FileManager");
const { storeImage } = require("../../middleware/storeImage");

const router = express.Router();

router.post("/uploadImage", async(req, res) => {
    storeImage(req, res, async(err) => {
        console.log("Files: ", req.file)
        const imageFile = req.file;
        if (!imageFile) {
            return res.status(400).send("No files were uploaded.")
        } else {
            if (err instanceof multer.MulterError) {
                Logger.log(`CHAT UPLOADIMAGE ERROR: ${err.message}`)
                return res.status(400).send("UERROR: " + err.message)
            } else if (err) {
                Logger.log(`CHAT UPLOADIMAGE INTERNAL SERVER ERROR: ${err.message}`)
                return res.status(500).send("ERROR: " + err.message)
            }
        }
        const uploadImageResponse = await FileManager.saveFile(imageFile.filename)
        if (uploadImageResponse) {
            res.status(200).send("Image uploaded to storage successfully.")
        } else {
            res.status(500).send("ERROR: Failed to upload image to storage.")
        }
    })
});

module.exports = { router, at: "/chat" };