import * as vscode from 'vscode';
import { getWordAtPosition, getFilePaths } from '../utils/searchUtils';
import { FileInfo } from '../utils/pathUtils';
import { log } from '../utils/logger';

export default class HoverProvider implements vscode.HoverProvider {
    constructor() {}

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        let config = vscode.workspace.getConfiguration('cakephp_goto_view');
        const hoverEnabled = config.get<boolean>('hover', true);

        if (!hoverEnabled) {
            // log('Hover provider is disabled by configuration');
            return null;
        }

        log('HoverProvider.provideHover called');
        log(`Hovering at line ${position.line + 1}, character ${position.character}`);

        const lineText = document.lineAt(position.line).text;
        const word = getWordAtPosition(document, position);

        log(`Hovering over word: ${word}`);

        const filePaths = getFilePaths(lineText, document);
        log(`File paths found: ${JSON.stringify(filePaths)}`);

        if (filePaths.length > 0) {
            const hoverMessage = new vscode.MarkdownString();
            hoverMessage.appendText(`Related files found:\n`);

            filePaths.forEach(file => {
                let linkUri = file.fileUri.toString();
                if (file.methodLocation) {
                    const { line, character } = file.methodLocation.range.start;
                    linkUri += `#${line + 1},${character + 1}`;
                }
                const linkText = `[${file.showPath}](${linkUri})`;

                if (file.name.endsWith('Cell.php')) {
                    hoverMessage.appendMarkdown(`- Cell Class: ${linkText}`);
                    if (file.methodLocation) {
                        hoverMessage.appendMarkdown(` (method at line ${file.methodLocation.range.start.line + 1})`);
                    }
                } else if (file.name.endsWith('.js')) {
                    hoverMessage.appendMarkdown(`- JS File: ${linkText}`);
                } else if (file.name.endsWith('.css')) {
                    hoverMessage.appendMarkdown(`- CSS File: ${linkText}`);
                } else if (file.name.endsWith('.php') && file.showPath.includes('Controller')) {
                    hoverMessage.appendMarkdown(`- Controller: ${linkText}`);
                    if (file.methodLocation) {
                        hoverMessage.appendMarkdown(` (method at line ${file.methodLocation.range.start.line + 1})`);
                    }
                } else if (file.name.endsWith('.php') && file.showPath.includes('Table')) {
                    hoverMessage.appendMarkdown(`- Table: ${linkText}`);
                } else if (file.showPath.includes('templates')) {
                    if (file.showPath.includes('cell')) {
                        hoverMessage.appendMarkdown(`- Cell View: ${linkText}`);
                    } else if (file.showPath.includes('element')) {
                        hoverMessage.appendMarkdown(`- Element: ${linkText}`);
                    } else {
                        hoverMessage.appendMarkdown(`- View: ${linkText}`);
                    }
                } else {
                    hoverMessage.appendMarkdown(`- File: ${linkText}`);
                }
                hoverMessage.appendMarkdown('\n');
            });

            return new vscode.Hover(hoverMessage);
        }

        log('No file paths found, returning null');
        return null;
    }
}
