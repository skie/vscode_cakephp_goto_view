'use strict';

import * as vscode from 'vscode';
import LinkProvider from './providers/linkProvider';
import HoverProvider from './providers/hoverProvider';
import { initializeLogger, getOutputChannel, log } from './utils/logger';
import { CakePhpCompletionProvider } from './providers/cakePhpCompletionProvider';
import { initializeMapRefresher, disposeMapRefresher } from './utils/mapRefresher';

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('cakephp_goto_view');
    const enableLogging = config.get('enableLogging', false);

    try {
        if (enableLogging) {
            initializeLogger();
            const outputChannel = getOutputChannel();
            outputChannel.show(true);
            outputChannel.appendLine('CakePHP Goto View is now active!');
        }

        log('Starting extension activation');

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            log('Workspace folder found, initializing map refresher');
            initializeMapRefresher(context);
        } else {
            log('No workspace folder found. Map refresher not initialized.');
        }

        log('Registering language providers');
        const supportedLanguages = ['php', 'ini'];

        let hover = vscode.languages.registerHoverProvider(supportedLanguages, new HoverProvider());
        let link = vscode.languages.registerDocumentLinkProvider(supportedLanguages, new LinkProvider());

        context.subscriptions.push(hover, link);

        if (enableLogging) {
            const outputChannel = getOutputChannel();
            context.subscriptions.push(outputChannel);
            outputChannel.appendLine('CakePHP Goto View providers registered');
        }

        log('Registering CakePhpCompletionProvider');
        const triggerCharacters = ["'", '"', '/', '\\', '_',
            ...Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
        ];
        log(`Registering with trigger characters: ${JSON.stringify(triggerCharacters)}`);

        const cakePhpCompletionProvider = vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'php' },
            new CakePhpCompletionProvider(),
            ...triggerCharacters
        );

        context.subscriptions.push(cakePhpCompletionProvider);
        log('CakePhpCompletionProvider registered and added to subscriptions');

        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId === 'php') {
                log('PHP file opened: ' + document.fileName);
            }
        });

        const testCommand = vscode.commands.registerCommand('cakephp.testCompletion', () => {
            log('Test command executed');
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const provider = new CakePhpCompletionProvider();
                provider.provideCompletionItems(
                    activeEditor.document,
                    activeEditor.selection.active,
                    new vscode.CancellationTokenSource().token,
                    { triggerKind: vscode.CompletionTriggerKind.Invoke, triggerCharacter: 'a' }
                );
            } else {
                log('No active editor found');
            }
        });

        context.subscriptions.push(testCommand);
        log('Test command registered');
    } catch (error) {
        log(`Error during extension activation: ${error}`);
        console.error('Error during CakePHP Goto View extension activation:', error);
    }

}



export function deactivate() {
    disposeMapRefresher();
}

export { getOutputChannel };
