const fs = require('fs');
const path = require('path');
const FileOps = require('../services/FileOps');

let ignoredFiles = FileOps.read(path.join(__dirname, '../.gitignore')).split('\n').map(item => path.basename(item))
ignoredFiles += [
    'index.js',
    'WebSocketServer.js',
    'Chat.js'
]

var routes = []

const routeFiles = [];
function filesInDir(directory) {
    fs.readdirSync(directory).forEach(file => {
        const absolute = path.join(directory, file);
        if (fs.statSync(absolute).isDirectory()) {
            return filesInDir(absolute);
        } else {
            if (ignoredFiles.includes(file)) return;
            return routeFiles.push(absolute);
        }
    });
}
filesInDir(__dirname);

routeFiles.forEach(routeFile => {
    try {
        const routerExport = require(routeFile);

        // See if a router is being exported
        if (routerExport == undefined) { return; }

        var exportMode = null;
        if (typeof routerExport == 'function') {
            exportMode = "direct";
        } else if (typeof routerExport.router != 'undefined') {
            exportMode = "indirect";
        } else {
            console.log('No router found in ' + routeFile)
            return;
        }

        // Get the router
        const router = exportMode === "direct" ? routerExport : routerExport.router;

        // Get router path
        const routePath = exportMode == "direct" ? "/" : (routerExport.at === undefined ? "/" : routerExport.at);

        // Add to routes
        routes.push({ router: router, at: routePath, name: path.basename(routeFile) })
    } catch (err) {
        console.log(`ROUTES INDEX: Error auto-loading route from ${routeFile}. Will ignore and continue. Error: ${err}`)
    }
})

module.exports = routes;