import * as vscode from 'vscode';
import * as path from 'path';
import { generateElementMap } from './elementMapper';
import { generateCellMap } from './cellMapper';
import { generateAssetMaps } from './assetMapper';
import { log } from './logger';
import { parseAutoloadPsr4 } from './fileUtils';

let fileWatcher: vscode.FileSystemWatcher | undefined;
let statusBarItem: vscode.StatusBarItem;

export function initializeMapRefresher(context: vscode.ExtensionContext) {
    log('Initializing map refresher');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        log('No workspace folder found in map refresher. Aborting initialization.');
        return;
    }

    log('Initializing status bar item');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);

    log('Generating initial maps');
    generateMaps(workspaceFolder);

    log('Creating file watcher');
    createFileWatcher(workspaceFolder, context);

    log('Registering refresh command');
    const refreshCommand = vscode.commands.registerCommand('cakephp-helper.refreshMaps', () => {
        log('Manual refresh command triggered');
        generateMaps(workspaceFolder);
        vscode.window.showInformationMessage('CakePHP Helper: Maps refreshed');
    });

    context.subscriptions.push(refreshCommand);

    log('Setting up Composer change listener');
    listenForComposerChanges(workspaceFolder);

    log('Map refresher initialization completed');
}

function generateMaps(workspaceFolder: vscode.WorkspaceFolder) {
    showRegeneratingStatus();
    log('Generating all maps');
    const namespaceMap = parseAutoloadPsr4(workspaceFolder, true);
    generateElementMap(workspaceFolder);
    generateCellMap(workspaceFolder);
    generateAssetMaps(workspaceFolder);
    hideRegeneratingStatus();
}

function createFileWatcher(workspaceFolder: vscode.WorkspaceFolder, context: vscode.ExtensionContext) {
    const watchPatterns = [
        new vscode.RelativePattern(workspaceFolder, '**/templates/**'),
        new vscode.RelativePattern(workspaceFolder, '**/webroot/**'),
        new vscode.RelativePattern(workspaceFolder, '**/plugins/**')
    ];

    fileWatcher = vscode.workspace.createFileSystemWatcher('{' + watchPatterns.map(p => p.pattern).join(',') + '}');

    fileWatcher.onDidCreate((uri) => {
        log(`File created: ${uri.fsPath}`);
        generateMaps(workspaceFolder);
    });

    fileWatcher.onDidDelete((uri) => {
        log(`File deleted: ${uri.fsPath}`);
        generateMaps(workspaceFolder);
    });

    context.subscriptions.push(fileWatcher);
}

function listenForComposerChanges(workspaceFolder: vscode.WorkspaceFolder) {
    const composerJsonPath = path.join(workspaceFolder.uri.fsPath, 'composer.json');
    const composerLockPath = path.join(workspaceFolder.uri.fsPath, 'composer.lock');

    const composerWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, '{composer.json,composer.lock}'));

    composerWatcher.onDidChange((uri) => {
        log(`Composer file changed: ${uri.fsPath}`);
        generateMaps(workspaceFolder);
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.uri.fsPath === composerJsonPath || document.uri.fsPath === composerLockPath) {
            log('Composer file saved, regenerating maps');
            generateMaps(workspaceFolder);
        }
    });
}

function showRegeneratingStatus() {
    statusBarItem.text = "$(sync~spin) Regenerating CakePHP maps...";
    statusBarItem.show();
}

function hideRegeneratingStatus() {
    statusBarItem.hide();
}

export function disposeMapRefresher() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
