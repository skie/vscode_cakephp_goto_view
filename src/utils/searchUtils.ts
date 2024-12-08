import * as vscode from 'vscode';
import { log } from '../utils/logger';
import * as path from 'path';
import { parseAutoloadPsr4, findElementFiles, findTemplateFiles, findCellFiles, getPluginFromFilePath, searchFiles, removeDuplicatesAndSort, extractCellInfo, findJsFiles, findCssFiles, findEmailTemplateFiles } from './fileUtils';
import { constructSearchPaths, createFileInfo, FileInfo } from './pathUtils';
import { underscore } from './stringUtils';
import { getPluginPath, setNamespaceMap } from './pluginUtils';

export const SEARCH_PATTERNS = {
    render: '\\$this->render\\([\'"](.+?)[\'"]\\)',
    method: '\\bfunction\\s+(\\w+)\\s*\\(',
    elementCall: '\\$this->element\\([\'"](.+?)[\'"]',
    elementArray: '[\'"]element[\'"]\\s*=>\\s*[\'"](.+?)[\'"]',
    cell: '\\$this->cell\\([\'"](.+?)[\'"]',
    scriptHelper: '\\$this->Html->script\\([\'"](.+?)[\'"](?:,|\\))',
    scriptTag: '<script[^>]*src=[\'"](.+?)[\'"]',
    cssHelper: '\\$this->Html->css\\([\'"](.+?)[\'"](?:,|\\))',
    cssTag: '<link[^>]*?href=[\'"](.+?)[\'"][^>]*',
    setTemplate: '->setTemplate\\([\'"](.+?)[\'"]\\)',
};

export function getFilePaths(text: string, document: vscode.TextDocument): FileInfo[] {
    log('getFilePaths called');
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    log(`Workspace folder: ${workspaceFolder}`);
    if (!workspaceFolder) {
        log('No workspace folder found');
        return [];
    }

    const pluginMap = parseAutoloadPsr4(workspaceFolder);
    setNamespaceMap(pluginMap);

    log(path.basename(document.fileName));
    if (path.basename(document.fileName) === 'asset_compress.ini') {
        log('Processing asset_compress.ini file');
        return getAssetCompressFiles(text, document, workspaceFolder, pluginMap);
    }

    const isViewFile = document.fileName.includes('templates') || document.fileName.includes('Template');
    log(`Document file name: ${document.fileName}`);
    const isCellFile = document.fileName.includes('Cell.php');
    log(`Document file name: ${document.fileName}`);
    const currentPlugin = getPluginFromFilePath(document.fileName);
    log(`Current plugin: ${currentPlugin}`);
    const isMailerFile = document.fileName.includes('Mailer');
    log(`Is Mailer file: ${isMailerFile}`);

    let matchingFiles: FileInfo[] = [];

    for (const [patternName, pattern] of Object.entries(SEARCH_PATTERNS)) {
        const regex = new RegExp(pattern, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const searchPath = match[1];
            log(`Match found for ${patternName}: ${searchPath}`);

            switch (patternName) {
                case 'elementCall':
                case 'elementArray':
                    log(`Finding element files for ${searchPath}`);
                    matchingFiles.push(...findElementFiles(searchPath, workspaceFolder, currentPlugin, document));
                    break;
                case 'cell':
                    log(`Finding cell files for ${searchPath}`);
                    matchingFiles.push(...findCellFiles(searchPath, workspaceFolder, currentPlugin, document));
                    break;
                case 'method':
                    log(`Finding method files for ${searchPath}`);
                    if (isCellFile) {
                        matchingFiles.push(...findCellViewFiles(searchPath, document, workspaceFolder, currentPlugin));
                    } else {
                        matchingFiles.push(...findTemplateFiles(searchPath, workspaceFolder, 'controller', document));
                    }
                    break;
                case 'scriptHelper':
                case 'scriptTag':
                    log(`Finding script files for ${searchPath}`);
                    matchingFiles.push(...findJsFiles(searchPath, workspaceFolder, currentPlugin));
                    break;
                case 'cssHelper':
                case 'cssTag':
                    log(`Finding CSS files for ${searchPath}`);
                    matchingFiles.push(...findCssFiles(searchPath, workspaceFolder, currentPlugin));
                    break;
                case 'setTemplate':
                    if (isMailerFile) {
                        log(`Finding email template files for ${searchPath}`);
                        matchingFiles.push(...findEmailTemplateFiles(searchPath, workspaceFolder, currentPlugin));
                    }
                    break;
                default:
                    log(`Finding template files for ${searchPath}`);
                    matchingFiles.push(...findTemplateFiles(searchPath, workspaceFolder, isViewFile ? 'template' : 'controller', document));
            }
        }
    }
    const uniqueSortedFiles = removeDuplicatesAndSort(matchingFiles);

    log(`Total matching files: ${uniqueSortedFiles.length}`);
    return uniqueSortedFiles;
}

export function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position) {
    if (path.basename(document.fileName) === 'asset_compress.ini') {
        const line = document.lineAt(position.line).text;
        if (line.trim().match(/^files\[\]\s*=\s*/)) {
            const filePath = line.substring(line.indexOf('=') + 1).trim();
            log(`Found file path in asset_compress.ini: ${filePath}`);
            return filePath;
        }
    }
    for (const [patternName, pattern] of Object.entries(SEARCH_PATTERNS)) {
        let regex = new RegExp(pattern);
        let wordRange = document.getWordRangeAtPosition(position, regex);
        if (wordRange) {
            let word = document.getText(wordRange);
            log(`Word found for ${patternName}: ${word}`);
            return word;
        }
    }
    log(`No word found at position`);
    return '';
}

function findCellViewFiles(methodName: string, document: vscode.TextDocument, workspaceFolder: vscode.WorkspaceFolder, plugin: string | null): FileInfo[] {
    const cellInfo = extractCellInfo(document);
    if (!cellInfo) {
        log('Not a valid Cell file');
        return [];
    }

    const viewFileName = underscore(methodName);
    const searchPaths = constructSearchPaths(workspaceFolder, 'cell', plugin);

    const viewFiles = searchFiles(searchPaths.map(p => path.join(p, cellInfo.name)), viewFileName);
    return viewFiles.map(file => createFileInfo(file, workspaceFolder));
}



function getAssetCompressFiles(currentLine: string, document: vscode.TextDocument, workspaceFolder: vscode.WorkspaceFolder, pluginMap: Record<string, string>): FileInfo[] {
    let matchingFiles: FileInfo[] = [];

    const match = currentLine.match(/files\[\]\s*=\s*(.+)$/);
    if (!match) {
        log(`No valid file path found in the current line: ${currentLine}`);
        return matchingFiles;
    }
    const filePath = match[1].trim();

    const fileExtension = path.extname(filePath).toLowerCase();
    const assetType = fileExtension === '.css' ? 'css' : 'js';

    if (filePath.startsWith('p:') || filePath.startsWith('plugin:')) {
        let pluginName, pluginFilePath;
        if (filePath.startsWith('p:')) {
            [, pluginName, pluginFilePath] = filePath.match(/p:([^:]+):(.+)/) || [];
        } else {
            [, pluginName, pluginFilePath] = filePath.match(/plugin:([^:]+):(.+)/) || [];
        }

        const pluginPath = getPluginPath(pluginName);
        log(`Plugin name: ${pluginName}, plugin file path: ${pluginFilePath}, pluginPath: ${pluginPath}, pluginMap[pluginName]: ${pluginMap[pluginName]}`);
        if (pluginName && pluginFilePath && pluginPath) {
            let fullPath;
            if (pluginFilePath.startsWith('/')) {
                fullPath = path.join(pluginPath, 'webroot', pluginFilePath);
            } else if (pluginFilePath.startsWith(assetType)) {
                fullPath = path.join(pluginPath, 'webroot', pluginFilePath);
            } else {
                fullPath = path.join(pluginPath, 'webroot', assetType, pluginFilePath);
            }
            log(`Full path for plugin file: ${fullPath}`);
            matchingFiles.push(createFileInfo(fullPath, workspaceFolder));
        }
    } else {
        let fullPath;
        if (filePath.startsWith('/')) {
            fullPath = path.join(workspaceFolder.uri.fsPath, 'webroot', filePath);
        } else {
            fullPath = path.join(workspaceFolder.uri.fsPath, 'webroot', assetType, filePath);
        }

        log(`Full path for app file: ${fullPath}`);
        matchingFiles.push(createFileInfo(fullPath, workspaceFolder));
    }

    log(`Total matching files: ${matchingFiles.length}`);
    return removeDuplicatesAndSort(matchingFiles);
}