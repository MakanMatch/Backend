// Middleware for file upload:
// 1. Set destination to /public/uploads folder
// 2. Replace original file name to new unique id
// 3. Limit file size to 10MB
// 4. File input name in form must be 'file'

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path.join(__dirname, '../FileStore'))
    },
    filename: (req, file, callback) => {
        callback(null, uuidv4() + path.extname(file.originalname))
    }
})

const storeFiles = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 10 }
})
.array('file') // file input name

module.exports = { storeFiles };