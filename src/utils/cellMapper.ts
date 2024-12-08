import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { log } from './logger';
import { parseAutoloadPsr4 } from './fileUtils';
import { variableCamelize } from './stringUtils';

interface CellMap {
    [key: string]: string[];
}

let cellMap: CellMap = {};

export function generateCellMap(workspaceFolder: vscode.WorkspaceFolder): void {
    log('Generating cell map');
    cellMap = {};

    const appCellPath = path.join(workspaceFolder.uri.fsPath, 'templates', 'cell');
    if (fs.existsSync(appCellPath)) {
        log(`Scanning app level cells at: ${appCellPath}`);
        scanCellDirectory(appCellPath);
    } else {
        log(`App level cell directory does not exist: ${appCellPath}`);
    }

    const appPluginPath = path.join(workspaceFolder.uri.fsPath, 'templates', 'plugin');
    if (fs.existsSync(appPluginPath)) {
        // log(`Scanning app level plugin overrides for cells at: ${appPluginPath}`);
        scanPluginOverrides(appPluginPath);
    } else {
        // log(`App level plugin override directory does not exist: ${appPluginPath}`);
    }

    const pluginMap = parseAutoloadPsr4(workspaceFolder);
    for (const [namespace, pluginPath] of Object.entries(pluginMap)) {
        const pluginName = namespace.split('\\').slice(0, 2).join('/');
        const pluginCellPath = path.join(pluginPath, 'templates', 'cell');

        if (fs.existsSync(pluginCellPath)) {
            // log(`Scanning plugin cells for ${pluginName} at: ${pluginCellPath}`);
            scanCellDirectory(pluginCellPath, pluginName);
        } else {
            // log(`Plugin cell directory does not exist for ${pluginName}: ${pluginCellPath}`);
        }

        const pluginOverridePath = path.join(pluginPath, 'templates', 'plugin');
        if (fs.existsSync(pluginOverridePath)) {
            // log(`Scanning plugin overrides for cells in ${pluginName} at: ${pluginOverridePath}`);
            scanPluginOverrides(pluginOverridePath);
        } else {
            // log(`Plugin override directory does not exist for ${pluginName}: ${pluginOverridePath}`);
        }
    }

    log(`Cell map generated with ${Object.keys(cellMap).length} cells`);
    // log(`Cell map contents: ${JSON.stringify(cellMap, null, 2)}`);
}

function scanCellDirectory(dirPath: string, pluginName: string = ''): void {
    // log(`Scanning cell directory: ${dirPath}`);
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
                const cellPath = currentRelativePath.slice(0, -4);
                const [cellName, viewName] = cellPath.split('/').slice(-2);
                const key = pluginName
                    ? `${pluginName}.${cellName}::${viewName}`
                    : `${cellName}::${viewName}`;

                // log(`Adding cell: ${key} -> ${fullPath}`);
                if (!cellMap[key]) {
                    cellMap[key] = [];
                }
                cellMap[key].push(fullPath);

                if (viewName.includes('_')) {
                    const camelizedViewName = variableCamelize(viewName);
                    const camelizedKey = pluginName
                        ? `${pluginName}.${cellName}::${camelizedViewName}`
                        : `${cellName}::${camelizedViewName}`;

                    // log(`Adding camelized cell: ${camelizedKey} -> ${fullPath}`);
                    if (!cellMap[camelizedKey]) {
                        cellMap[camelizedKey] = [];
                    }
                    cellMap[camelizedKey].push(fullPath);
                }
            }
        }
    };

    scanDir(dirPath);
}

function scanPluginOverrides(pluginPath: string): void {
    // log(`Scanning plugin overrides for cells: ${pluginPath}`);
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
                const cellPath = path.join(fullItemPath, 'cell');

                if (fs.existsSync(cellPath)) {
                    const pluginName = updatedNamespace.join('/');
                    // log(`Scanning override cells for plugin ${pluginName} at: ${cellPath}`);
                    scanCellDirectory(cellPath, pluginName);
                }

                scanNestedPlugins(fullItemPath, updatedNamespace);
            }
        }
    };

    scanNestedPlugins(pluginPath);
}

export function getCellPaths(cellName: string): string[] {
    // log(`Getting cell paths for: ${cellName}`);
    const paths = cellMap[cellName] || [];
    // log(`Paths found: ${JSON.stringify(paths)}`);
    return paths;
}

export function getAllCellNames(): string[] {
    return Object.keys(cellMap);
}
