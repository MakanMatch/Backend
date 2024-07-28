const FileOps = require('./FileOps');
const path = require('path')

/**
 * HTMLRenderer class to render HTML templates
 * 
 * Create `.html` file templates in the `views` directory in the root folder
 * 
 * Where you want to insert values, use the `placeholderFormat` as defined in the class, default: `{{ content }}`
 * 
 * To change the placeholder format used, change the `placeholderFormat` variable in the class and put `content` where you want the value to be inserted
 * 
 * Use the `render` method to render the template with the data. Attributes in the data object should match (case-sensitive) with the placeholders in the template
 * 
 * Example usage:
 * ```js
 * const HTMLRenderer = require('./services/HTMLRenderer');
 * const renderedHTML = HTMLRenderer.render('myTemplate.html', { title: 'Hello World', message: 'This is a test' });
 * ```
 * 
 * @var placeholderFormat: string - The placeholder format to use in the template
 * @method render: Renders the template with the provided data
 */
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