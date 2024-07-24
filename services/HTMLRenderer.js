const FileOps = require('./FileOps');
const path = require('path')

class HTMLRenderer {
    static placeholderFormat = '{{ content }}';

    static render(template, data) {
        const filePath = path.join(process.cwd(), "views", template);
        if (!FileOps.exists(filePath)) {
            throw new Error(`HTMLRENDERER ERROR: Template ${template} does not exist.`);
        }

        var renderedContent = FileOps.read(filePath)
        for (const key of Object.keys(data)) {
            const placeholder = this.placeholderFormat.replace('content', key);
            renderedContent = renderedContent.split(placeholder).join(data[key]);
        }

        return renderedContent;
    }
}

module.exports = HTMLRenderer;