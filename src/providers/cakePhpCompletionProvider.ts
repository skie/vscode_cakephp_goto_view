import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { getAllElementNames } from '../utils/elementMapper';
import { getAllJsNames, getAllCssNames } from '../utils/assetMapper';
import { getAllCellNames } from '../utils/cellMapper';

export class CakePhpCompletionProvider implements vscode.CompletionItemProvider {

    private currentPosition: vscode.Position;

    constructor() {
        this.currentPosition = new vscode.Position(0, 0);
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
        this.currentPosition = position;
        log('CakePhpCompletionProvider.provideCompletionItems called');
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        log(`Line prefix: "${linePrefix}"`);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            log('No workspace folder found');
            return [];
        }
        let completionItems: vscode.CompletionItem[] = [];

        if (linePrefix.match(/\$this->element\s*\(\s*['"][\w\/\.]*$/)) {
            const elementMatch = linePrefix.match(/\$this->element\s*\(\s*['"](?<prefix>[\w\/\.]*)$/);
            const elementPrefix = elementMatch?.groups?.prefix || '';
            log(`Element prefix: "${elementPrefix}"`);
            const elementCompletions = this.findMatchingCompletions(elementPrefix, 'element');
            completionItems = this.createCompletionItems(elementCompletions, vscode.CompletionItemKind.Snippet, elementPrefix);
        } else if (linePrefix.match(/\$this->cell\s*\(\s*['"][\w\/\.]*$/)) {
            const cellMatch = linePrefix.match(/\$this->cell\s*\(\s*['"](?<prefix>[\w\/\.]*)$/);
            const cellPrefix = cellMatch?.groups?.prefix || '';
            log(`Cell prefix: "${cellPrefix}"`);
            const cellCompletions = this.findMatchingCompletions(cellPrefix, 'cell');
            completionItems = this.createCompletionItems(cellCompletions, vscode.CompletionItemKind.Snippet, cellPrefix);
        } else if (linePrefix.match(/\$this->render\s*\(\s*['"][\w\/\.]*$/)) {
            // @todo
        } else if (linePrefix.match(/\$this->Html->script\s*\(\s*['"][\w\/\d_\.]*$/)) {
            const scriptMatch = linePrefix.match(/\$this->Html->script\s*\(\s*['"](?<prefix>[\w\/\d_\.]*)$/);
            const scriptPrefix = scriptMatch?.groups?.prefix || '';
            log(`Script prefix: "${scriptPrefix}"`);
            const scriptCompletions = this.findMatchingCompletions(scriptPrefix, 'js');
            completionItems = this.createCompletionItems(scriptCompletions, vscode.CompletionItemKind.File, scriptPrefix);
        } else if (linePrefix.match(/\$this->Html->css\s*\(\s*['"][\w\/\.]*$/)) {
            const cssMatch = linePrefix.match(/\$this->Html->css\s*\(\s*['"](?<prefix>[\w\/\.]*)$/);
            const cssPrefix = cssMatch?.groups?.prefix || '';
            log(`CSS prefix: "${cssPrefix}"`);
            const cssCompletions = this.findMatchingCompletions(cssPrefix, 'css');
            completionItems = this.createCompletionItems(cssCompletions, vscode.CompletionItemKind.File, cssPrefix);
        }

        log(`Returning ${completionItems.length} completion items`);
        return completionItems;
    }

    private findMatchingCompletions(prefix: string, type: 'element' | 'template' | 'js' | 'css' | 'cell'): string[] {
        log(`findMatchingCompletions called with prefix: ${prefix}, type: ${type}`);

        let allKeys: string[];
        switch (type) {
            case 'element':
            case 'template':
                allKeys = getAllElementNames();
                break;
            case 'cell':
                allKeys = getAllCellNames();
                break;
            case 'js':
                allKeys = getAllJsNames();
                break;
            case 'css':
                allKeys = getAllCssNames();
                break;
            default:
                allKeys = [];
        }

        const matchingKeys = allKeys.filter(key => key.toLowerCase().startsWith(prefix.toLowerCase()));
        log(`Found ${matchingKeys.length} matching keys for prefix: ${prefix}`);
        return matchingKeys;
    }

    private createCompletionItems(completions: string[], kind: vscode.CompletionItemKind, prefix: string): vscode.CompletionItem[] {
        return completions.map(completion => {
            const item = new vscode.CompletionItem(completion, kind);
            item.detail = completion;

            let commonPrefixLength = 0;
            while (commonPrefixLength < prefix.length &&
                   commonPrefixLength < completion.length &&
                   prefix[commonPrefixLength].toLowerCase() === completion[commonPrefixLength].toLowerCase()) {
                commonPrefixLength++;
            }

            const insertText = completion.slice(commonPrefixLength);

            item.insertText = insertText;
            item.range = new vscode.Range(
                this.currentPosition.translate(0, -prefix.length + commonPrefixLength),
                this.currentPosition
            );

            return item;
        });
    }


}
