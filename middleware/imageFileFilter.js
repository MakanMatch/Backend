const path = require('path');

const imageFileFilter = function (req, file, cb) {
    const allowedMIMETypes = /jpeg|jpg|png|heic|svg\+xml/;
    const allowedExtensions = /jpeg|jpg|png|heic|svg/;
    
    const mimetype = allowedMIMETypes.test(file.mimetype);
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpeg, .jpg, .png, and .svg files are allowed'), false);
    }
};

module.exports = imageFileFilter;