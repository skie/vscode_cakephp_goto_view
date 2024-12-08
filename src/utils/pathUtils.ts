import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { log } from '../utils/logger';

export interface FileInfo {
    name: string;
    fileUri: vscode.Uri;
    showPath: string;
    methodLocation?: vscode.Location;
}

export function constructSearchPaths(workspaceFolder: vscode.WorkspaceFolder, type: 'template' | 'element' | 'cell' | 'cellClass' | 'js' | 'css' | 'email', plugin: string | null, pluginPath: string | null = null): string[] {
    log(`constructSearchPaths called with type: ${type}, plugin: ${plugin}, pluginPath: ${pluginPath}`);
    let basePaths: string[] = [];

    if (pluginPath) {
        log(`Using provided plugin path: ${pluginPath}`);
        basePaths.push(pluginPath);
    } else if (plugin) {
        const vendorPath = path.join(workspaceFolder.uri.fsPath, 'vendor');
        const possiblePluginPath = path.join(vendorPath, plugin.toLowerCase().replace('/', '-'));
        log(`Constructed possible plugin path: ${possiblePluginPath}`);
        basePaths.push(possiblePluginPath);
    }

    if (plugin) {
        const appLevelPluginPath = path.join(workspaceFolder.uri.fsPath, 'templates', 'plugin', plugin.replace('/', path.sep));
        log(`Adding app-level plugin path: ${appLevelPluginPath}`);
        basePaths.push(appLevelPluginPath);
    }

    const pluginsPath = path.join(workspaceFolder.uri.fsPath, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        log(`Plugins directory found: ${pluginsPath}`);
        const pluginFolders = fs.readdirSync(pluginsPath);
        for (const pluginFolder of pluginFolders) {
            let themePath: string;
            if (type === 'js' || type === 'css') {
                themePath = path.join(pluginsPath, pluginFolder);
                log(`Adding css/js theme path: ${themePath}`);
                basePaths.push(themePath);
            } else {
                if (plugin) {
                    themePath = path.join(pluginsPath, pluginFolder, 'templates', 'plugin', plugin.replace('/', path.sep));
                    basePaths.push(themePath);
                }
                themePath = path.join(pluginsPath, pluginFolder, 'templates');
                log(`Adding theme path: ${themePath}`);
                basePaths.push(themePath);
            }
        }
    } else {
        log(`Plugins directory not found: ${pluginsPath}`);
    }

    basePaths.push(workspaceFolder.uri.fsPath);

    let searchPaths = basePaths.flatMap(basePath => {
        switch (type) {
            case 'element':
                return [
                    path.join(basePath, 'templates', 'element'),
                    path.join(basePath, 'element'),
                    path.join(basePath),
                ];
            case 'cellClass':
                if (basePath.includes(path.sep + 'plugins' + path.sep)) {
                    return [
                        path.join(basePath, 'src', 'View', 'Cell'),
                    ];
                } else {
                    return [
                        path.join(basePath, 'src', 'View', 'Cell'),
                    ];
                }
            case 'cell':
                if (basePath.includes(path.sep + 'plugins' + path.sep)) {
                    return [
                        path.join(basePath, 'templates', 'cell'),
                        path.join(basePath, 'cell'),
                        path.join(basePath, 'src', 'View', 'Cell'),
                    ];
                } else {
                    return [
                        path.join(basePath, 'templates', 'cell'),
                        path.join(basePath, 'cell'),
                        path.join(basePath, 'src', 'View', 'Cell'),
                        path.join(basePath),
                        basePath
                    ];
                }
            case 'template':
                if (basePath.includes(path.sep + 'plugins' + path.sep)) {
                    return [
                        path.basename(basePath) === 'templates' ? basePath : path.join(basePath, 'templates'),
                        path.join(basePath),
                        basePath
                    ];
                } else {
                    return [
                        path.basename(basePath) === 'templates' ? basePath : path.join(basePath, 'templates')
                    ];
                }
            case 'email':
                if (basePath.includes(path.sep + 'plugins' + path.sep)) {
                    return [
                        path.join(basePath, 'templates', 'email'),
                        path.join(basePath),
                        basePath
                    ];
                } else {
                    return [
                        path.join(basePath, 'templates', 'email'),
                    ];
                }
            case 'js':
                return [
                    path.join(basePath, 'webroot'),
                    path.join(basePath, 'webroot', 'js'),
                    ...(pluginPath ? [path.join(pluginPath, 'webroot', 'js')] : [])
                ];
                break;
            case 'css':
                return [
                    path.join(basePath, 'webroot'),
                    path.join(basePath, 'webroot', 'css'),
                    ...(pluginPath ? [path.join(pluginPath, 'webroot', 'css')] : [])
                ];
                break;
        }
    });

    searchPaths = Array.from(new Set(searchPaths)).sort((a, b) => a.localeCompare(b));

    log(`Constructed search paths: ${JSON.stringify(searchPaths)}`);
    return searchPaths;
}

export function createFileInfo(filePath: string, workspaceFolder: vscode.WorkspaceFolder): FileInfo {
    log(`createFileInfo called with filePath: ${filePath}`);
    const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
    const fileInfo = {
        name: path.basename(filePath),
        fileUri: vscode.Uri.file(filePath),
        showPath: relativePath
    };
    log(`Created FileInfo: ${JSON.stringify(fileInfo)}`);
    return fileInfo;
}
