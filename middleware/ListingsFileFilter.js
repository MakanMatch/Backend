const path = require('path');
const Logger = require('../services/Logger');

const ListingsFileFilter = function (req, file, cb) {
    const allowedMIMETypes = /jpeg|jpg|png|svg\+xml/;
    const allowedExtensions = /jpeg|jpg|png|svg/;
    
    const mimetype = allowedMIMETypes.test(file.mimetype);
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      cb(null, true);
      Logger.log(`File ${file.originalname} uploaded successfully`);
    } else {
      cb(new Error('Only .jpeg, .jpg, .png, and .svg files are allowed'), false);
    }
};

module.exports = ListingsFileFilter;