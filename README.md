# CakePHP VSCode plugin

This VSCode extension enhances development productivity for CakePHP projects by providing intelligent navigation and code insight features. It offers quick access to related files, simplifies traversing between controllers, views, and other components, and supports plugin-aware file resolution. The extension also provides navigation capabilities for JavaScript and CSS files, allowing developers to easily locate and open associated asset files within their CakePHP project structure.

## Feature overview for a VSCode plugin

1. Controller to Template Navigation:
   - Hover over controller names or `->render()` calls in controller files
   - Display a link to the corresponding template file
   - Clicking the link opens the template file

2. View Element Navigation:
   - Hover over element references in view files
   - Show links to the corresponding element files
   - Clicking a link opens the element file

3. Cell Navigation:
   - Hover over cell references in view or controller files
   - Display links to both the cell class file and its template
   - Clicking a link opens the respective file

4. Asset Navigation:
   - Hover over `Html->js()` calls to show and open JavaScript files
   - Hover over `Html->css()` calls to show and open CSS files

5. Email Template Navigation:
   - Hover over email template references
   - Show links to both HTML and text versions of the email template
   - Clicking a link opens the respective email template file

6. Plugin-aware File Resolution:
   - Correctly resolve files across different plugins
   - Support for both plugin and app-level files

7. Asset Compression Configuration:
   - Hover over asset references in `asset_compress.ini`
   - Show and open the referenced asset files

8. Namespace and Class Resolution:
   - Parse and utilize Composer's autoload configuration for accurate file lookups


# Settings



## quickJump

Use `Ctrl` or `Alt` + `click` to jump to the first matched file.

