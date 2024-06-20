const express = require("express");
const { generateUniqueID } = require("../../services/Universal");
const router = express.Router();
const multer = require('multer');
const FileManager = require("../../services/FileManager");
const path = require('path');
const FoodListing = require("../../models").FoodListing;
const Guest = require("../../models").Guest;
const Host = require("../../models").Host;
require("../../services/Universal").generateUniqueID;
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
      callback(null, path.join(__dirname, '../../FileStore'))
  },
  filename: (req, file, callback) => {
      callback(null, uuidv4() + path.extname(file.originalname))
  }
})

const storeFile = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }
})
.single('images')

router.post("/createHost", async (req, res) => {
  // POST a new host before creating a food listing
  const {
    userID,
    username,
    email,
    password,
    contactNum,
    address,
    emailVerified,
    favCuisine,
    mealsMatched,
    foodRating,
    hygieneGrade,
    paymentImage,
  } = req.body;

  try {
    const newHost = await Host.create({
      userID,
      username,
      email,
      password,
      contactNum,
      address,
      emailVerified: emailVerified || false,
      favCuisine,
      mealsMatched: mealsMatched || 0,
      foodRating: foodRating || null,
      hygieneGrade: hygieneGrade || null,
      paymentImage,
    });

    res.json({ message: "Host created successfully!", newHost });
  } catch (error) {
    console.error("Error creating host:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/hostInfo", async (req, res) => {
  try {
    // GET host info before displaying listing's host name
    const hostInfo = await Host.findByPk("2bb0df69-6264-409b-a008-d09f7a08dd53"); // hardcoded for now
    res.json(hostInfo);
  } catch (error) {
    console.error("Error fetching host info:", error);
    res.status(500).json({ error: "Failed to fetch host info" });
  }
});


router.get("/", async (req, res) => {
  // GET all food listings
  try {
    const foodListings = await FoodListing.findAll();
    res.json(foodListings);
  } catch (error) {
    console.error("Error retrieving food listings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addListing", async (req, res) => {
  // POST a new food listing
  const {
    title,
    images,
    shortDescription,
    longDescription,
    portionPrice,
    totalSlots,
    datetime,
  } = req.body;

  const listingID = generateUniqueID(10);
  const approxAddress = "Sengkang, Singapore" // hardcoded for now
  const address = "123 Fake Street, Singapore 123456" // hardcoded for now
  const hostID = "2bb0df69-6264-409b-a008-d09f7a08dd53" // hardcoded for now
  const published = true;

  try {
    const newFoodListing = await FoodListing.create({
      listingID,
      title,
      images,
      shortDescription,
      longDescription,
      portionPrice,
      approxAddress,
      address,
      totalSlots,
      datetime,
      published,
      hostID,
    });

    res.json({ message: "Food listing created successfully!", ID: listingID});
  } catch (error) {
    console.error("Error creating food listing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addImage", async (req, res) => {
  try {
    storeFile(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        console.error("Multer error:", err);
        res.status(400).json({ error: "File upload error" });
      } else if (err) {
        console.error("Unknown error occured during upload:", err);
        res.status(500).json({ error: "Internal server error" });
      } else if (!req.file) {
        res.status(400).json({ error: "No file was selected to upload" });
      } else {
        await FileManager.saveFile(req.file.filename);
        publicUrl = `https://firebasestorage.googleapis.com/v0/b/makanmatch.appspot.com/o/${req.file.filename}?alt=media`
        res.json({ message: "File uploaded successfully", url: publicUrl });
      }
    });
  } catch (error) {
    console.error("Error occured while adding image to food listing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/updateListingImageUrl", async (req, res) => {
  const { listingID, url } = req.body;

  try {
    const updatedListing = await FoodListing.update(
      { images: url },
      { where: { listingID } }
    );

    if (updatedListing == 1) {
      res.json({ message: "Image URL updated successfully!", updatedListing });
    } else {
      res.status(404).json({ error: "Food listing not found" });
    }
  } catch (error) {
    console.error("Error updating image URL:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
