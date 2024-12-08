import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { log } from './logger';
import { parseAutoloadPsr4 } from './fileUtils';

export interface ElementMap {
    [key: string]: string[];
}

export let elementMap: ElementMap = {};

export function generateElementMap(workspaceFolder: vscode.WorkspaceFolder): void {
    log('Generating element map');
    elementMap = {};

    const appElementPath = path.join(workspaceFolder.uri.fsPath, 'templates', 'element');
    if (fs.existsSync(appElementPath)) {
        log(`Scanning app level elements at: ${appElementPath}`);
        scanElementDirectory(appElementPath);
    } else {
        log(`App level element directory does not exist: ${appElementPath}`);
    }

    const appPluginPath = path.join(workspaceFolder.uri.fsPath, 'templates', 'plugin');
    if (fs.existsSync(appPluginPath)) {
        log(`Scanning app level plugin overrides at: ${appPluginPath}`);
        scanPluginOverrides(appPluginPath);
    } else {
        log(`App level plugin override directory does not exist: ${appPluginPath}`);
    }

    const pluginMap = parseAutoloadPsr4(workspaceFolder);
    for (const [namespace, pluginPath] of Object.entries(pluginMap)) {
        const pluginName = namespace.split('\\').slice(0, 2).join('/');
        const pluginElementPath = path.join(pluginPath, 'templates', 'element');

        if (fs.existsSync(pluginElementPath)) {
            // log(`Scanning plugin elements for ${pluginName} at: ${pluginElementPath}`);
            scanElementDirectory(pluginElementPath, pluginName);
        } else {
            // log(`Plugin element directory does not exist for ${pluginName}: ${pluginElementPath}`);
        }

        const pluginOverridePath = path.join(pluginPath, 'templates', 'plugin');
        if (fs.existsSync(pluginOverridePath)) {
            // log(`Scanning plugin overrides for ${pluginName} at: ${pluginOverridePath}`);
            scanPluginOverrides(pluginOverridePath);
        } else {
            // log(`Plugin override directory does not exist for ${pluginName}: ${pluginOverridePath}`);
        }
    }

    log(`Element map generated with ${Object.keys(elementMap).length} elements`);
    // log(`Element map contents: ${JSON.stringify(elementMap, null, 2)}`);
}

function scanElementDirectory(dirPath: string, pluginName: string = ''): void {
    // log(`Scanning directory: ${dirPath}`);
    if (!fs.existsSync(dirPath)) {
        // log(`Directory does not exist: ${dirPath}`);
        return;
    }

    const scanDir = (currentPath: string, relativePath: string = '') => {
        const files = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(currentPath, file.name);
            const currentRelativePath = path.join(relativePath, file.name).replace(/\\/g, '/');

            if (file.isDirectory()) {
                scanDir(fullPath, currentRelativePath);
            } else if (file.isFile() && path.extname(file.name).toLowerCase() === '.php') {
                const elementPath = currentRelativePath.slice(0, -4);
                const key = pluginName ? `${pluginName}.${elementPath}` : elementPath;

                // log(`Adding element: ${key} -> ${fullPath}`);
                if (!elementMap[key]) {
                    elementMap[key] = [];
                }
                elementMap[key].push(fullPath);
            }
        }
    };

    scanDir(dirPath);
}

function scanPluginOverrides(pluginPath: string): void {
    // log(`Scanning plugin overrides: ${pluginPath}`);
    if (!fs.existsSync(pluginPath)) {
        // log(`Plugin override directory does not exist: ${pluginPath}`);
        return;
    }

    const scanNestedPlugins = (currentPath: string, currentNamespace: string[] = []) => {
        const items = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const item of items) {
            const fullItemPath = path.join(currentPath, item.name);

            if (item.isDirectory()) {
                const updatedNamespace = [...currentNamespace, item.name];
                const elementPath = path.join(fullItemPath, 'element');

                if (fs.existsSync(elementPath)) {
                    const pluginName = updatedNamespace.join('/');
                    // log(`Scanning override elements for plugin ${pluginName} at: ${elementPath}`);
                    scanElementDirectory(elementPath, pluginName);
                }

                // Always continue scanning deeper, even if 'element' directory is found
                scanNestedPlugins(fullItemPath, updatedNamespace);
            }
        }
    };

    scanNestedPlugins(pluginPath);
}

export function getElementPaths(elementName: string): string[] {
    return elementMap[elementName] || [];
}

export function getAllElementNames(): string[] {
    return Object.keys(elementMap);
}
