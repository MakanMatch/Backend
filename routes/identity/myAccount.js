const express = require('express');
const router = express.Router();
const yup = require('yup');
const axios = require('axios');
const { Logger, Encryption } = require('../../services');
const { Guest, Host, Admin, FoodListing, Review, ChatMessage } = require('../../models');
const { validateToken } = require('../../middleware/auth');
const FileManager = require('../../services/FileManager');
const { storeFile } = require('../../middleware/storeFile');
const multer = require('multer');

async function isUniqueUsername(username, currentUser) {
    const usernameExists = await Guest.findOne({ where: { username } }) ||
        await Host.findOne({ where: { username } }) ||
        await Admin.findOne({ where: { username } });

    return !usernameExists || usernameExists.userID === currentUser.userID;
}

async function isUniqueEmail(email, currentUser) {
    const emailExists = await Guest.findOne({ where: { email } }) ||
        await Host.findOne({ where: { email } }) ||
        await Admin.findOne({ where: { email } });

    return !emailExists || emailExists.userID === currentUser.userID;
}

async function isUniqueContactNum(contactNum, currentUser) {
    if (contactNum && contactNum.trim() !== '') {
        const contactNumExists = await Guest.findOne({ where: { contactNum } }) ||
            await Host.findOne({ where: { contactNum } }) ||
            await Admin.findOne({ where: { contactNum } });
    
        return (!contactNumExists) || contactNumExists.userID === currentUser.userID;
    }
}

router.put('/updateAccountDetails', validateToken, async (req, res) => {
    const userType = req.user.userType;

    const schema = yup.object().shape({
        username: yup.string().required().trim().min(1).max(50),
        email: yup.string().required().email(),
        contactNum: yup.string().optional().trim().max(8).nullable()
    });

    if (userType === "Host" && (req.body.contactNum === '' || req.body.contactNum === undefined)) {
        res.status(400).send("UERROR: Contact number cannot be empty.");
        return
    }

    const userID = req.user.userID;

    try {
        const data = await schema.validate(req.body, { abortEarly: false });

        const { username, email, contactNum } = data

        // Find user using userID
        let user = await Guest.findByPk(userID) ||
            await Host.findByPk(userID) ||
            await Admin.findByPk(userID);

        if (!user) {
            res.status(400).send("UERROR: User doesn't exist.");
            return;
        }

        if (!await isUniqueUsername(username, user)) {
            return res.status(400).send("UERROR: Username already exists.");
        }

        if (!await isUniqueEmail(email.replaceAll(" ", ""), user)) {
            return res.status(400).send("UERROR: Email already exists.");
        }

        if (!contactNum == '' && !await isUniqueContactNum(contactNum, user)) {
            return res.status(400).send("UERROR: Contact number already exists.");
        }

        // Update user information
        user.username = username;        
        if (email !== user.email) {
            user.email = email;
            user.emailVerified = false;
        } else {
            user.email = email;
        }
        if (contactNum === '' || contactNum === null) {
            user.contactNum = null;
        } else {
            user.contactNum = contactNum;
        }

        // Save changes to the database
        saveUser = await user.save();

        if (!saveUser) {
            Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS ERROR: Failed to save user details for userID ${userID}`)
            return res.status(500).send("ERROR: Failed to update user details")
        }

        Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS: Updated user details for userID ${userID}`)
        res.send("SUCCESS: Account information updated.");
    } catch (err) {
        Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS ERROR: Failed to update user details for userID ${userID}; error: ${err}`)
        res.status(500).send("ERROR: Error updating user details.");
    }
});

router.delete('/deleteAccount', validateToken, async (req, res) => {
    let userID;
    let userType;

    if (req.user.userType === "Admin") {
        userID = req.query.targetUserID;
        userType = req.query.userType;
    } else {
        userID = req.user.userID;
        userType = req.user.userType;
    }

    try {
        let user;

        // Find the user based on userType
        if (userType === 'Guest') {
            user = await Guest.findOne({ where: { userID } });
        } else if (userType === 'Host') {
            user = await Host.findOne({ where: { userID } });
        } else if (userType === 'Admin') {
            user = await Admin.findOne({ where: { userID } });
        }

        if (!user) {
            return res.status(400).send('UERROR: User not found.');
        }

        // Collate all images to delete
        var collatedImages = [];
        
        // Collect profile picture
        if (user.profilePicture) {
            collatedImages.push(user.profilePicture);
        }

        // Collect images from food listings if user is a host
        if (userType === 'Host') {
            const listings = await FoodListing.findAll({ where: { hostID: userID }, attributes: ["listingID", "images"] });
            if (listings) {
                for (const listing of listings) {
                    collatedImages = collatedImages.concat(listing.images.split("|"));
                }
            }
        }

        // Collect review images if applicable
        if (userType === 'Guest') {
            const reviews = await Review.findAll({ where: { guestID: userID }, attributes: ["reviewID", "images"] });
            if (reviews) {
                for (const review of reviews) {
                    if (review.images) {
                        collatedImages = collatedImages.concat(review.images.split("|"));
                    }
                }
            }

            if (user.paymentImage) {
                collatedImages.push(user.paymentImage);
            }
        }

        // Collect chat message images if applicable
        const chatMessages = await ChatMessage.findAll({ where: { senderID: userID }, attributes: ["messageID", "image"] });
        if (chatMessages) {
            for (const message of chatMessages) {
                if (message.image) {
                    collatedImages.push(message.image);
                }
            }
        }

        const deleteUser = await user.destroy();

        if (!deleteUser) {
            Logger.log(`IDENTITY MYACCOUNT DELETEACCOUNT ERROR: Failed to delete user ${userID}`)
            res.status(500).send(`ERROR: Failed to delete user ${userID}`)
            return
        }

        // Delete all collated images
        for (const image of collatedImages) {
            try {
                await FileManager.deleteFile(image);
            } catch (err) {
                Logger.log(`IDENTITY MYACCOUNT DELETEACCOUNT ERROR: Failed to delete image '${image}' from storage; error: ${err}`);
            }
        }

        Logger.log(`IDENTITY MYACCOUNT DELETEACCOUNT: ${userType} account ${userID} deleted.`)
        res.send(`SUCCESS: User ${userID} deleted successfully.`);
    } catch (err) {
        Logger.log(`IDENTITY MYACCOUNT DELETEACCOUNT ERROR: Failed to delete user ${userID}; error: ${err}`)
        res.status(500).send(`ERROR: Failed to delete user ${userID}.`);
    }
});

router.put('/changePassword', validateToken, async (req, res) => {
    const changePasswordSchema = yup.object().shape({
        userType: yup.string().required().oneOf(['Guest', 'Host', 'Admin']),
        currentPassword: yup.string().required(),
        newPassword: yup.string().required().min(6),
    });

    const { userID, userType } = req.user;

    try {
        const data = await changePasswordSchema.validate(req.body, { abortEarly: false });

        const { currentPassword, newPassword } = data

        let user;

        // Find the user based on userType
        if (userType === 'Guest') {
            user = await Guest.findOne({ where: { userID } });
        } else if (userType === 'Host') {
            user = await Host.findOne({ where: { userID } });
        } else if (userType === 'Admin') {
            user = await Admin.findOne({ where: { userID } });
        }

        if (!user) {
            return res.status(400).send('UERROR: User not found.');
        }

        // Verify current password
        let passwordMatch = await Encryption.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.send('UERROR: Incorrect current password');
        }

        // Update user's password
        newPasswordHashed = await Encryption.hash(newPassword);
        user.password = newPasswordHashed;

        saveNewPassword = await user.save();

        if (!saveNewPassword) {
            Logger.log(`IDENTITY MYACCOUNT CHANGEPASSWORD ERROR: Failed to save new password for user ${userID}`)
            return res.status(500).send(`ERROR: Failed to save new password for user ${userID}`)
        }

        Logger.log(`IDENTITY MYACCOUNT CHANGEPASSWORD: Password successfully changed for user ${userID}`)
        res.send('SUCCESS: Password changed successfully');
    } catch (err) {
        Logger.log(`IDENTITY MYACCOUNT CHANGEPASSWORD ERROR: Failed to change password for user ${userID}`)
        res.status(500).send(`ERROR: Failed to change password for user ${userID}`);
    }
});

router.put('/changeName', validateToken, async (req, res) => {
    const changeNameSchema = yup.object().shape({
        fname: yup.string()
            .required('First name cannot be empty')
            .min(1, 'First name cannot be empty')
            .max(30)
            .matches(/^[^0-9]*$/, 'UERROR: First name cannot contain numbers'),
        lname: yup.string()
            .required('Last name cannot be empty')
            .min(1, 'Last name cannot be empty')
            .max(30)
            .matches(/^[^0-9]*$/, 'UERROR: Last name cannot contain numbers')
    });

    const { userID, userType } = req.user;

    try {
        const data = await changeNameSchema.validate(req.body, { abortEarly: false });

        const { fname, lname } = data;

        let user;

        // Find the user based on userType
        if (userType === 'Guest') {
            user = await Guest.findOne({ where: { userID } });
        } else if (userType === 'Host') {
            user = await Host.findOne({ where: { userID } });
        } else if (userType === 'Admin') {
            user = await Admin.findOne({ where: { userID } });
        }

        if (!user) {
            return res.status(400).send('UERROR: User not found.');
        }

        if (user.fname === fname && user.lname === lname) {
            return res.status(200).send('SUCCESS: Nothing to update.');
        }

        // Update user's name
        user.fname = fname;
        user.lname = lname;

        const saveNewName = await user.save();

        if (!saveNewName) {
            Logger.log(`IDENTITY MYACCOUNT CHANGENAME ERROR: Failed to save new name for user ${userID}`);
            return res.status(500).send(`ERROR: Failed to update name.`);
        }

        Logger.log(`IDENTITY MYACCOUNT CHANGENAME: Name successfully changed for user ${userID}`);
        res.send('SUCCESS: Name changed successfully');
    } catch (err) {
        if (err instanceof yup.ValidationError) {
            const validationErrors = err.errors.join(' ');
            return res.status(400).send(validationErrors);
        }
        Logger.log(`IDENTITY MYACCOUNT CHANGENAME ERROR: Failed to change name for user ${userID}; error: ${err}`);
        res.status(500).send(`ERROR: Failed to change name for user ${userID}`);
    }
});

router.put('/changeAddress', validateToken, async (req, res) => {
    const userID = req.user.userID;
    const { blkNo, street, postalCode, unitNum } = req.body;

    // Construct address string
    let address = '';
    if (blkNo && unitNum) {
        address = `Block ${blkNo} ${street} ${postalCode} #${unitNum}`;
    } else if (blkNo) {
        address = `Block ${blkNo} ${street} ${postalCode}`;
    } else if (unitNum) {
        address = `${street} ${postalCode} #${unitNum}`;
    } else {
        address = `${street} ${postalCode}`;
    }

    if (!street || !postalCode) {
        return res.status(400).send("UERROR: Street and postal code are required.");
    }

    try {
        // Geocode address to ensure it is valid
        const encodedAddress = encodeURIComponent(String(address));
        const apiKey = process.env.GMAPS_API_KEY;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address="${encodedAddress}"&key=${apiKey}`;
        const response = await axios.get(url);
        const location = response.data.results[0];
        if (!location) {
            return res.status(400).send("UERROR: Invalid address.");
        }

        const fullCoordinates = `${location.geometry.location.lat},${location.geometry.location.lng}`;
        components = location.address_components;
        let street = '';
        let city = '';
        let state = '';

        components.forEach(component => {
            if (component.types.includes('route')) {
                street = component.long_name;
            }
            if (component.types.includes('locality')) {
                city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
            }
        });
        
        let approximateAddress = '';
        if (street) {
            approximateAddress += street;
        }
        if (city) {
            if (approximateAddress) approximateAddress += ', ';
            approximateAddress += city;
        }
        if (state) {
            if (approximateAddress) approximateAddress += `, ${state}`;
        }

        try {
            const encodedApproximateAddress = encodeURIComponent(String(approximateAddress));
            const approxUrl = `https://maps.googleapis.com/maps/api/geocode/json?address="${encodedApproximateAddress}"&key=${apiKey}`;
            const approxResponse = await axios.get(approxUrl);
            const approxLocation = approxResponse.data.results[0].geometry.location;
            const approxCoordinates = `${approxLocation.lat},${approxLocation.lng}`;

            // Update address in the database
            const user = await Host.findByPk(userID) || await Guest.findByPk(userID) || await Admin.findByPk(userID);
            if (!user) {
                return res.status(404).send("ERROR: User not found.");
            }

            user.address = address;
            user.coordinates = fullCoordinates;
            user.approxCoordinates = approxCoordinates
            user.approxAddress = approximateAddress;
            
            saveUser = await user.save();
            if (!saveUser) {
                Logger.log(`IDENTITY MYACCOUNT CHANGEADDRESS ERROR: Failed to save address for user ${userID}`);
                return res.status(500).send("ERROR: Failed to save address.");
            }

            // Update all of the host's listings
            if (req.user.userType == "Host") {
                const updatedListings = await FoodListing.update(
                    {
                        approxCoordinates: approxCoordinates,
                        address: address,
                        approxAddress: approximateAddress
                    },
                    {
                        where: { hostID: user.userID }
                    }
                )

                if (!updatedListings) {
                    Logger.log(`IDENTITY MYACCOUNT CHANGEADDRESS ERROR: Failed to update listings for user ${userID}`);
                    return res.status(500).send("ERROR: Failed to update listings.");
                }
            }

            Logger.log(`IDENTITY MYACCOUNT CHANGEADDRESS: Address updated successfully for user ${userID}.`);
            res.send("SUCCESS: Address updated successfully.");
        } catch (err) {
            Logger.log(`IDENTITY MYACCOUNT CHANGEADDRESS ERROR: Failed to update address for user ${userID}; error: ${err}`);
            return res.status(500).send("ERROR: Failed to update address.");
        }
    } catch (err) {
        Logger.log(`IDENTITY MYACCOUNT CHANGEADDRESS ERROR: Failed to update address for user ${userID}; error: ${err}`);
        res.status(500).send("ERROR: Internal server error.");
    }
});

router.post('/uploadProfilePicture', validateToken, async (req, res) => {
    storeFile(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            Logger.log(`IDENTITY MYACCOUNT UPLOADPROFILEPICTURE ERROR: Image upload error; error: ${err}.`);
            return res.status(400).send("ERROR: Image upload error");
        } else if (err) {
            Logger.log(`IDENTITY MYACCOUNT UPLOADPROFILEPICTURE ERROR: Internal server error; error: ${err}.`);
            return res.status(400).send("ERROR: Internal server error");
        } else if (req.file === undefined) {
            res.status(400).send("UERROR: No file selected.");
            return;
        }

        const userID = req.user.userID;
        const userType = req.user.userType;
        let user;

        // Find the user based on userType
        if (userType === 'Guest') {
            user = await Guest.findByPk(userID);
        } else if (userType === 'Host') {
            user = await Host.findByPk(userID);
        } else if (userType === 'Admin') {
            user = await Admin.findByPk(userID);
        }
        
        if (!user) {
            res.status(404).send("ERROR: User not found.");
            return;
        }

        // Check for an existing profile picture and delete it
        if (user.profilePicture) {
            try {
                const fileDelete = await FileManager.deleteFile(user.profilePicture);
                if (fileDelete !== true) {
                    if (fileDelete !== "ERROR: File does not exist.") {
                        Logger.log("IDENTITY MYACCOUNT UPLOADPROFILEPICTURE ERROR: Failed to delete previous profile picture from storage; error: " + fileDelete);
                        res.status(500).send("ERROR: Failed to delete previous profile picture.");
                        return;
                    } else {
                        Logger.log("IDENTITY MYACCOUNT UPLOADPROFILEPICTURE WARNING: Unexpected FM response in deleting previous profile picture from storage; response: " + fileDelete);
                    }
                }
            } catch (err) {
                Logger.log("IDENTITY MYACCOUNT UPLOADPROFILEPICTURE ERROR: Failed to delete previous profile picture from storage; error: " + err);
                res.status(500).send("ERROR: Failed to delete previous profile picture.");
                return;
            }
        }

        var fileSave = await FileManager.saveFile(req.file.filename);
        if (fileSave !== true) {
            res.status(400).send("ERROR: Failed to save file.");
            return;
        }

        user.profilePicture = req.file.filename;
        const saveUserProfilePicture = await user.save();
        if (!saveUserProfilePicture) {
            Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS ERROR: Failed to save user profile picture for userID ${userID}`);
            res.status(500).send("ERROR: Failed to save user profile picture");
            return
        }

        res.send("SUCCESS: Profile picture uploaded successfully.");

        Logger.log(`IDENTITY MYACCOUNT UPLOADPROFILEPICTURE: Uploaded profile picture '${req.file.filename}' for user '${userID}'.`);
        return;
    });
});

router.post('/removeProfilePicture', validateToken, async (req, res) => {
    const userID = req.user.userID;
    const userType = req.user.userType;
    let user;

    // Find the user based on userType
    if (userType === 'Guest') {
        user = await Guest.findByPk(userID);
    } else if (userType === 'Host') {
        user = await Host.findByPk(userID);
    } else if (userType === 'Admin') {
        user = await Admin.findByPk(userID);
    }
    if (!user) {
        res.status(404).send("ERROR: User not found.");
        return;
    }

    // Check for an existing profile picture and delete it
    if (user.profilePicture) {
        try {
            const fileDelete = await FileManager.deleteFile(user.profilePicture);
            if (fileDelete !== true) {
                if (fileDelete !== "ERROR: File does not exist.") {
                    Logger.log("IDENTITY MYACCOUNT REMOVEPROFILEPICTURE ERROR: Failed to delete profile picture from storage; error: " + fileDelete);
                    res.status(500).send("ERROR: Failed to delete profile picture.");
                    return;
                } else {
                    Logger.log("IDENTITY MYACCOUNT REMOVEPROFILEPICTURE WARNING: Unexpected FM response in deleting profile picture from storage; response: " + fileDelete);
                }
            }
        } catch (err) {
            Logger.log("IDENTITY MYACCOUNT REMOVEPROFILEPICTURE ERROR: Failed to delete profile picture from storage; error: " + err);
            res.status(500).send("ERROR: Failed to delete profile picture.");
            return;
        }

        // Update user record to remove the profile picture reference
        user.profilePicture = null;
        await user.save();
    } else {
        res.status(200).send("SUCCESS: No profile picture to remove.");
        return;
    }

    Logger.log(`IDENTITY MYACCOUNT REMOVEPROFILEPICTURE: Removed profile picture for user '${userID}'.`);
    res.send("SUCCESS: Profile picture removed successfully.");
    return;
});


module.exports = { router, at: '/identity/myAccount' };