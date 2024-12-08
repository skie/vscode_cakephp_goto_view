import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { log } from './logger';
import { parseAutoloadPsr4 } from './fileUtils';

export interface AssetMap {
    [key: string]: string[];
}

export let jsMap: AssetMap = {};
export let cssMap: AssetMap = {};

export function generateAssetMaps(workspaceFolder: vscode.WorkspaceFolder): void {
    log('Generating JS and CSS maps');
    jsMap = {};
    cssMap = {};

    const appWebrootPath = path.join(workspaceFolder.uri.fsPath, 'webroot');
    if (fs.existsSync(appWebrootPath)) {
        log(`Scanning app level assets at: ${appWebrootPath}`);
        scanAssetDirectory(appWebrootPath);
    } else {
        log(`App level webroot directory does not exist: ${appWebrootPath}`);
    }

    const pluginMap = parseAutoloadPsr4(workspaceFolder);
    for (const [namespace, pluginPath] of Object.entries(pluginMap)) {
        const pluginName = namespace.split('\\').slice(0, 2).join('/');
        const pluginWebrootPath = path.join(pluginPath, 'webroot');

        if (fs.existsSync(pluginWebrootPath)) {
            // log(`Scanning plugin assets for ${pluginName} at: ${pluginWebrootPath}`);
            scanAssetDirectory(pluginWebrootPath, pluginName);
        } else {
            // log(`Plugin webroot directory does not exist for ${pluginName}: ${pluginWebrootPath}`);
        }
    }

    log(`JS map generated with ${Object.keys(jsMap).length} files`);
    // log(`JS map: ${JSON.stringify(jsMap, null, 2)}`);
    log(`CSS map generated with ${Object.keys(cssMap).length} files`);
    // log(`CSS map: ${JSON.stringify(cssMap, null, 2)}`);
}

function scanAssetDirectory(dirPath: string, pluginName: string = ''): void {
    // log(`Scanning asset directory: ${dirPath}`);
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
            } else if (file.isFile()) {
                const ext = path.extname(file.name).toLowerCase();
                if (ext === '.js' || ext === '.css') {
                    const assetPath = currentRelativePath;
                    const map = ext === '.js' ? jsMap : cssMap;
                    const scope = ext === '.js' ? 'js' : 'css';

                    const keys = generateAssetKeys(pluginName, assetPath, ext, scope);

                    for (const key of keys) {
                        // log(`Adding ${ext.slice(1)} asset: ${key} -> ${fullPath}`);
                        if (!map[key]) {
                            map[key] = [];
                        }
                        if (!map[key].includes(fullPath)) {
                            map[key].push(fullPath);
                        }
                    }
                }
            }
        }
    };

    scanDir(dirPath);
}

function generateAssetKeys(pluginName: string, assetPath: string, ext: string, scope: string): string[] {
    const keys = [];
    const assetPathWithoutExt = assetPath.slice(0, -ext.length);

    const trimmedPath = assetPath.replace(/^(css\/|js\/)/i, '');
    const trimmedPathWithoutExt = trimmedPath.slice(0, -ext.length);

    if (pluginName) {
        keys.push(`${pluginName}.${assetPath}`);
        keys.push(`${pluginName}.${assetPathWithoutExt}`);
        keys.push(`${pluginName}.${trimmedPath}`);
        keys.push(`${pluginName}.${trimmedPathWithoutExt}`);
        if (scope === 'css') {
            keys.push(`${pluginName}./css/${trimmedPath}`);
            keys.push(`${pluginName}./css/${trimmedPathWithoutExt}`);
        } else if (scope === 'js') {
            keys.push(`${pluginName}./js/${trimmedPath}`);
            keys.push(`${pluginName}./js/${trimmedPathWithoutExt}`);
        }
    } else {
        keys.push(assetPath);
        keys.push(assetPathWithoutExt);
        keys.push(trimmedPath);
        keys.push(trimmedPathWithoutExt);
        if (scope === 'css') {
            keys.push(`/css/${trimmedPath}`);
            keys.push(`/css/${trimmedPathWithoutExt}`);
        } else if (scope === 'js') {
            keys.push(`/js/${trimmedPath}`);
            keys.push(`/js/${trimmedPathWithoutExt}`);
        }
    }

    return [...new Set(keys)];
}

export function getJsPaths(jsName: string): string[] {
    return jsMap[jsName] || [];
}

export function getCssPaths(cssName: string): string[] {
    return cssMap[cssName] || [];
}

export function getAllJsNames(): string[] {
    return Object.keys(jsMap);
}

export function getAllCssNames(): string[] {
    return Object.keys(cssMap);
}
