import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from './logger';
import { constructSearchPaths, createFileInfo, FileInfo } from './pathUtils';
import { parseElementName, getPluginPath } from './pluginUtils';
import { underscore } from './stringUtils';
import { getElementPaths, getAllElementNames, elementMap } from './elementMapper';
import { getCellPaths } from './cellMapper';
import { getJsPaths, getCssPaths } from './assetMapper';
interface NamespaceMap {
    [key: string]: string;
}

interface ControllerInfo {
    name: string;
    prefix: string;
    suffix: string;
}

export interface CellInfo {
    name: string;
    prefix: string;
    suffix: string;
}

let namespaceMap: NamespaceMap | null = null;

export function parseAutoloadPsr4(workspaceFolder: vscode.WorkspaceFolder, refresh: boolean = false): NamespaceMap {
    if (namespaceMap !== null && !refresh) {
        log('Using cached namespace map');
        return namespaceMap;
    }

    const autoloadPath = path.join(workspaceFolder.uri.fsPath, 'vendor', 'composer', 'autoload_psr4.php');

    if (!fs.existsSync(autoloadPath)) {
        log(`autoload_psr4.php not found at ${autoloadPath}`);
        return {};
    }

    log(`Parsing autoload_psr4.php at ${autoloadPath}`);

    const content = fs.readFileSync(autoloadPath, 'utf8');
    const returnRegex = /return\s+array\s*\(([\s\S]*?)\);/;
    const match = content.match(returnRegex);

    if (!match) {
        return {};
    }

    const entries = match[1].split(',\n');
    namespaceMap = {};

    entries.forEach(entry => {
        const [namespace, paths] = entry.split('=>').map(part => part.trim());
        if (namespace && paths) {
            const cleanNamespace = namespace
                .replace(/^['"]|['"]$/g, '')
                .replace(/\\\\/g, '\\')
                .replace(/\\$/, '');
            const basePathMatch = paths.match(/\$baseDir\s*\.\s*'(.*)'/);
            const vendorPathMatch = paths.match(/\$vendorDir\s*\.\s*'(.*)'/);

            if (basePathMatch) {
                let relativePath = basePathMatch[1].replace(/^\//, '');
                if (!relativePath.endsWith('tests')) {
                    relativePath = relativePath.replace(/\/src$/, '');
                    namespaceMap![cleanNamespace] = path.join(workspaceFolder.uri.fsPath, relativePath);
                }
            } else if (vendorPathMatch) {
                let relativePath = vendorPathMatch[1].replace(/^\//, '');
                if (!relativePath.endsWith('tests')) {
                    relativePath = relativePath.replace(/\/src$/, '');
                    namespaceMap![cleanNamespace] = path.join(workspaceFolder.uri.fsPath, 'vendor', relativePath);
                }
            }
        }
    });

    log('Namespace map parsing completed');

    return namespaceMap;
}

export function searchFiles(basePaths: string[], fileName: string, extensions: string[] = ['.php']): string[] {
    log(`searchFiles called with fileName: ${fileName}`);
    const foundFiles: string[] = [];
    for (const basePath of basePaths) {
        for (const ext of extensions) {
            const fullPath = path.join(basePath, fileName + ext);
            log(`Searching for file: ${fullPath}`);
            if (fs.existsSync(fullPath)) {
                foundFiles.push(fullPath);
                log(`File found: ${fullPath}`);
            } else {
                log(`File not found: ${fullPath}`);
            }
        }
    }
    log(`Total files found: ${foundFiles.length}`);
    return foundFiles;
}

export function findElementFiles(elementPath: string, workspaceFolder: vscode.WorkspaceFolder, currentPlugin: string | null, document?: vscode.TextDocument): FileInfo[] {
    log(`findElementFiles called with elementPath: ${elementPath}, currentPlugin: ${currentPlugin}`);
    const { plugin, path: parsedPath } = parseElementName(elementPath);
    log(`Parsed element: plugin=${plugin}, path=${parsedPath}`);

    const currentFilePlugin = document ? getPluginFromFilePath(document.uri.fsPath) : null;
    log(`Current file plugin: ${currentFilePlugin}`);

    let searchKeys: string[] = [];

    if (plugin) {
        searchKeys.push(`${plugin}.${parsedPath}`);
    } else if (currentFilePlugin) {
        searchKeys.push(`${currentFilePlugin}.${parsedPath}`);
    }
    searchKeys.push(parsedPath);

    log(`Search keys: ${JSON.stringify(searchKeys)}`);

    let elementPaths: string[] = [];
    for (const searchKey of searchKeys) {
        for (const [mapKey, paths] of Object.entries(elementMap)) {
            if (mapKey.endsWith(searchKey) && Array.isArray(paths)) {
                elementPaths = paths as string[];
                log(`Paths found for key ${searchKey}: ${JSON.stringify(elementPaths)}`);
                break;
            }
        }
        if (elementPaths.length > 0) {
            break;
        }
    }

    if (elementPaths.length === 0) {
        log(`No element files found for ${searchKeys.join(', ')}`);
        return [];
    }

    log(`Found ${elementPaths.length} element file(s) for ${searchKeys.join(', ')}`);
    const fileInfos = elementPaths.map(file => createFileInfo(file, workspaceFolder));

    const uniqueSortedFiles = removeDuplicatesAndSort(fileInfos);
    log(`Unique sorted files: ${JSON.stringify(uniqueSortedFiles)}`);

    return uniqueSortedFiles;
}

export function removeDuplicatesAndSort(files: FileInfo[]): FileInfo[] {
    const uniqueFiles = new Map<string, FileInfo>();

    files.forEach(file => {
        uniqueFiles.set(file.fileUri.fsPath, file);
    });

    return Array.from(uniqueFiles.values()).sort((a, b) => {
        return a.showPath.localeCompare(b.showPath);
    });
}
export function findTemplateFiles(searchPath: string, workspaceFolder: vscode.WorkspaceFolder, type: 'template' | 'controller' | 'cell' , document: vscode.TextDocument): FileInfo[] {
    log(`findTemplateFiles called with searchPath: ${searchPath}, type: ${type}`);
    const { plugin, path: parsedPath } = parseElementName(searchPath);
    log(`Parsed template: plugin=${plugin}, path=${parsedPath}`);

    const pluginPath = plugin ? getPluginPath(plugin) : null;
    log(`Plugin path: ${pluginPath}`);

    let searchPaths: string[] = [];
    if (type === 'controller') {
        searchPaths = constructSearchPaths(workspaceFolder, 'template', plugin, pluginPath);
    } else if (type === 'cell') {
        searchPaths = constructSearchPaths(workspaceFolder, 'cell', plugin, pluginPath);
    }

    let finalSearchPath = parsedPath;
    if (type === 'controller') {
        const controllerInfo = extractControllerInfo(document);
        if (controllerInfo) {
            log(`Controller info: ${JSON.stringify(controllerInfo)}`);
            finalSearchPath = path.join(controllerInfo.suffix, controllerInfo.name, underscore(parsedPath));
        }
    } else if (type === 'cell') {
        const cellInfo = extractCellInfo(document);
        if (cellInfo) {
            log(`Cell info: ${JSON.stringify(cellInfo)}`);
            finalSearchPath = path.join(cellInfo.suffix, cellInfo.name, underscore(parsedPath));
        }
    }

    const viewParts = finalSearchPath.split('/');
    let possiblePaths = [
        finalSearchPath,
        viewParts.join(path.sep),
    ];

    const uniqueSortedPaths = Array.from(new Set(possiblePaths)).sort((a, b) => a.localeCompare(b));
    possiblePaths = uniqueSortedPaths;

    log(`Possible view paths: ${JSON.stringify(possiblePaths)}`);

    const files = possiblePaths.flatMap(p => searchFiles(searchPaths, p));
    log(`Files found: ${JSON.stringify(files)}`);

    return files.map(file => createFileInfo(file, workspaceFolder));
}

export function findCellFiles(cellPath: string, workspaceFolder: vscode.WorkspaceFolder, currentPlugin: string | null, document?: vscode.TextDocument): FileInfo[] {
    log(`findCellFiles called with cellPath: ${cellPath}, currentPlugin: ${currentPlugin}`);
    const { plugin, path: parsedPath } = parseElementName(cellPath);
    log(`Parsed cell: plugin=${plugin}, path=${parsedPath}`);
    const { plugin: plugin2, className, methodName } = parseCellName(cellPath);
    log(`Parsed cell: plugin=${plugin2}, path=${parsedPath} className=${className}, methodName=${methodName}`);
    const pluginPath = plugin ? getPluginPath(plugin) : null;
    log(`Plugin path: ${pluginPath}`);
    const searchPaths = constructSearchPaths(workspaceFolder, 'cellClass', plugin2 || currentPlugin, pluginPath);
    log(`Search paths: ${JSON.stringify(searchPaths)}`);

    const currentFilePlugin = document ? getPluginFromFilePath(document.uri.fsPath) : null;
    log(`Current file plugin: ${currentFilePlugin}`);

    let searchKeys: string[] = [];

    const normalizedCellPath = parsedPath.includes('::') ? parsedPath : `${parsedPath}::view`;

    if (plugin) {
        searchKeys.push(`${plugin}.${normalizedCellPath}`);
    }
    if (currentFilePlugin) {
        searchKeys.push(`${currentFilePlugin}.${normalizedCellPath}`);
    }
    if (currentPlugin && currentPlugin !== currentFilePlugin) {
        searchKeys.push(`${currentPlugin}.${normalizedCellPath}`);
    }
    searchKeys.push(normalizedCellPath);

    log(`Search keys: ${JSON.stringify(searchKeys)}`);

    let cellPaths: string[] = [];
    for (const searchKey of searchKeys) {
        const paths = getCellPaths(searchKey);
        if (paths.length > 0) {
            log(`Paths found for key ${searchKey}: ${JSON.stringify(paths)}`);
            cellPaths = cellPaths.concat(paths);
        }
    }

    if (cellPaths.length === 0) {
        log(`No cell files found for ${searchKeys.join(', ')}`);
        return [];
    }

    const classFiles = searchFiles(searchPaths, className + 'Cell');
    log(`Class files: ${JSON.stringify(classFiles)}`);

    log(`Found ${cellPaths.length} cell file(s) for ${searchKeys.join(', ')}`);
    const fileInfos = [
        ...cellPaths.map(file => createFileInfo(file, workspaceFolder)),
        ...classFiles.map(file => {
            const fileInfo = createFileInfo(file, workspaceFolder);
            fileInfo.methodLocation = findMethodInFile(file, methodName);
            return fileInfo;
        })
    ];

    const uniqueSortedFiles = removeDuplicatesAndSort(fileInfos);
    log(`Unique sorted files: ${JSON.stringify(uniqueSortedFiles)}`);

    return uniqueSortedFiles;
}

export function _findCellFiles(cellPath: string, workspaceFolder: vscode.WorkspaceFolder, currentPlugin: string | null): FileInfo[] {
    log(`findCellFiles called with cellPath: ${cellPath}, currentPlugin: ${currentPlugin}`);
    const { plugin, className, methodName } = parseCellName(cellPath);
    const pluginPath = plugin ? getPluginPath(plugin) : null;
    const searchPaths = constructSearchPaths(workspaceFolder, 'cell', plugin || currentPlugin, pluginPath);
    log(`Search paths: ${JSON.stringify(searchPaths)}`);

    const templateSearchPaths = [
        path.join(workspaceFolder.uri.fsPath, 'templates', 'cell'),
        ...searchPaths.map(p => path.join(p, 'templates', 'cell')),
        ...searchPaths.map(p => path.join(p))
    ];

    const viewFileName = underscore(methodName);
    const viewFiles = templateSearchPaths.flatMap(basePath =>
        searchFiles([path.join(basePath, className)], viewFileName)
    );
    log(`View files: ${JSON.stringify(viewFiles)}`);

    const classFiles = searchFiles(searchPaths, className + 'Cell');
    log(`Class files: ${JSON.stringify(classFiles)}`);

    return [
        ...viewFiles.map(file => createFileInfo(file, workspaceFolder)),
        ...classFiles.map(file => {
            const fileInfo = createFileInfo(file, workspaceFolder);
            fileInfo.methodLocation = findMethodInFile(file, methodName);
            return fileInfo;
        })
    ];
}

export function parseCellName(cellName: string): { plugin: string | null, path: string, className: string, methodName: string } {
    const parts = cellName.split('::');
    if (parts.length !== 2) {
        return { plugin: null, path: cellName, className: cellName, methodName: '' };
    }

    const [cellClass, methodName] = parts;
    const classPath = cellClass.replace(/\\/g, '/');
    const fileName = methodName.replace(/([A-Z])/g, '_$1').toLowerCase();
    const fullPath = `${classPath}/${fileName}`;

    const pluginMatch = classPath.match(/^(\w+)\./);
    if (pluginMatch) {
        return {
            plugin: pluginMatch[1],
            path: fullPath.slice(pluginMatch[0].length),
            className: classPath.slice(pluginMatch[0].length),
            methodName: methodName
        };
    }

    return { plugin: null, path: fullPath, className: classPath, methodName: methodName };
}

export function findMethodInFile(filePath: string, methodName: string): vscode.Location | undefined {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const methodRegex = new RegExp(`\\bfunction\\s+${methodName}\\b`);

    for (let i = 0; i < lines.length; i++) {
        if (methodRegex.test(lines[i])) {
            return new vscode.Location(
                vscode.Uri.file(filePath),
                new vscode.Position(i, lines[i].indexOf('function'))
            );
        }
    }

    return undefined;
}

export function getPluginFromFilePath(filePath: string): string | null {
    const pluginsIndex = filePath.indexOf('plugins');
    if (pluginsIndex !== -1) {
        const pathAfterPlugins = filePath.slice(pluginsIndex + 8);
        const pluginName = pathAfterPlugins.split(path.sep)[0];
        log(`Plugin found in 'plugins' directory: ${pluginName}`);
        return pluginName;
    }

    if (namespaceMap) {
        let longestMatch = '';
        let matchedPlugin = null;

        for (const [namespace, pluginPath] of Object.entries(namespaceMap)) {
            if (filePath.startsWith(pluginPath) && pluginPath.length > longestMatch.length) {
                longestMatch = pluginPath;
                matchedPlugin = namespace.split('\\')[0];
            }
        }

        if (matchedPlugin) {
            log(`Plugin found from namespace map: ${matchedPlugin}`);
            return matchedPlugin;
        }
    }

    log(`No plugin found for path ${filePath}`);
    return null;
}

export function _getPluginFromFilePath(filePath: string): string | null {
    const pluginsIndex = filePath.indexOf('plugins');
    if (pluginsIndex !== -1) {
        const pathAfterPlugins = filePath.slice(pluginsIndex + 8);
        const pluginName = pathAfterPlugins.split(path.sep)[0];
        return pluginName;
    }
    return null;
}

export function extractControllerInfo(input: vscode.TextDocument | string): ControllerInfo | null {
    let fileContent: string;

    if (typeof input === 'string') {
        fileContent = fs.readFileSync(input, 'utf8');
    } else {
        fileContent = input.getText();
    }

    const namespaceMatch = fileContent.match(/namespace\s+([\w\\]+)/);
    const classMatch = fileContent.match(/class\s+(\w+)Controller/);

    if (!namespaceMatch || !classMatch) {
        return null;
    }

    const fullNamespace = namespaceMatch[1];
    const controllerName = classMatch[1];

    const parts = fullNamespace.split('\\');
    const controllerIndex = parts.indexOf('Controller');

    let prefix = '';
    let suffix = '';

    if (controllerIndex !== -1) {
        prefix = parts.slice(0, controllerIndex).join('\\');
        suffix = parts.slice(controllerIndex + 1).join('\\');
    }

    return {
        name: controllerName,
        prefix: prefix,
        suffix: suffix
    };
}

export function extractCellInfo(input: vscode.TextDocument | string): CellInfo | null {
    let fileContent: string;

    if (typeof input === 'string') {
        fileContent = fs.readFileSync(input, 'utf8');
    } else {
        fileContent = input.getText();
    }

    const namespaceMatch = fileContent.match(/namespace\s+([\w\\]+)/);
    const classMatch = fileContent.match(/class\s+(\w+)Cell/);

    if (!namespaceMatch || !classMatch) {
        return null;
    }

    const fullNamespace = namespaceMatch[1];
    const cellName = classMatch[1];

    const parts = fullNamespace.split('\\');
    const cellIndex = parts.indexOf('Cell');

    let prefix = '';
    let suffix = '';

    if (cellIndex !== -1) {
        prefix = parts.slice(0, cellIndex).join('\\');
        suffix = parts.slice(cellIndex + 1).join('\\');
    }

    return {
        name: cellName,
        prefix: prefix,
        suffix: suffix
    };
}

export function findJsFiles(scriptName: string, workspaceFolder: vscode.WorkspaceFolder, currentPlugin: string | null): FileInfo[] {
    log(`findJsFiles called with scriptName: ${scriptName}, currentPlugin: ${currentPlugin}`);

    let searchKeys: string[] = [scriptName];

    if (currentPlugin) {
        searchKeys.unshift(`${currentPlugin}.${scriptName}`);
    }

    log(`Search keys: ${JSON.stringify(searchKeys)}`);

    let jsPaths: string[] = [];
    for (const searchKey of searchKeys) {
        const paths = getJsPaths(searchKey);
        if (paths.length > 0) {
            log(`Paths found for key ${searchKey}: ${JSON.stringify(paths)}`);
            jsPaths = jsPaths.concat(paths);
            break;
        }
    }

    if (jsPaths.length === 0) {
        log(`No JS files found for ${searchKeys.join(', ')}`);
        return [];
    }

    log(`Found ${jsPaths.length} JS file(s) for ${searchKeys.join(', ')}`);
    const fileInfos = jsPaths.map(file => createFileInfo(file, workspaceFolder));

    const uniqueSortedFiles = removeDuplicatesAndSort(fileInfos);
    log(`Unique sorted files: ${JSON.stringify(uniqueSortedFiles)}`);

    return uniqueSortedFiles;
}

export function findCssFiles(cssName: string, workspaceFolder: vscode.WorkspaceFolder, currentPlugin: string | null): FileInfo[] {
    log(`findCssFiles called with cssName: ${cssName}, currentPlugin: ${currentPlugin}`);

    let searchKeys: string[] = [cssName];

    if (currentPlugin) {
        searchKeys.unshift(`${currentPlugin}.${cssName}`);
    }

    log(`Search keys: ${JSON.stringify(searchKeys)}`);

    let cssPaths: string[] = [];
    for (const searchKey of searchKeys) {
        const paths = getCssPaths(searchKey);
        if (paths.length > 0) {
            log(`Paths found for key ${searchKey}: ${JSON.stringify(paths)}`);
            cssPaths = cssPaths.concat(paths);
            break;
        }
    }

    if (cssPaths.length === 0) {
        log(`No CSS files found for ${searchKeys.join(', ')}`);
        return [];
    }

    log(`Found ${cssPaths.length} CSS file(s) for ${searchKeys.join(', ')}`);
    const fileInfos = cssPaths.map(file => createFileInfo(file, workspaceFolder));

    const uniqueSortedFiles = removeDuplicatesAndSort(fileInfos);
    log(`Unique sorted files: ${JSON.stringify(uniqueSortedFiles)}`);

    return uniqueSortedFiles;
}

export function findEmailTemplateFiles(templateName: string, workspaceFolder: vscode.WorkspaceFolder, plugin: string | null): FileInfo[] {
    const searchPaths = constructSearchPaths(workspaceFolder, 'email', plugin);
    const textFiles = searchFiles(searchPaths.map(p => path.join(p, 'text')), templateName);
    const htmlFiles = searchFiles(searchPaths.map(p => path.join(p, 'html')), templateName);

    return [...textFiles, ...htmlFiles].map(file => createFileInfo(file, workspaceFolder));
}

export async function findMatchingFiles(searchPath: string, workspaceFolder: vscode.WorkspaceFolder, type: 'element' | 'template' | 'js' | 'css', currentPlugin: string | null): Promise<FileInfo[]> {
    log(`findMatchingFiles called with searchPath: ${searchPath}, type: ${type}, currentPlugin: ${currentPlugin}`);
    const { plugin, path: parsedPath } = parseElementName(searchPath);
    log(`Parsed path: plugin=${plugin}, path=${parsedPath}`);

    const pluginPath = plugin ? getPluginPath(plugin) : null;
    log(`Plugin path: ${pluginPath}`);

    const searchPaths = constructSearchPaths(workspaceFolder, type, plugin || currentPlugin, pluginPath);
    log(`Search paths: ${JSON.stringify(searchPaths)}`);

    const matchingFiles: FileInfo[] = [];
    for (const basePath of searchPaths) {
        const fullSearchPath = path.join(basePath, parsedPath);
        log(`Searching in: ${fullSearchPath}`);
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(fullSearchPath));
            log(`Found ${entries.length} entries in ${fullSearchPath}`);
            for (const [name, fileType] of entries) {
                if (fileType === vscode.FileType.File) {
                    if ((type === 'js' && name.endsWith('.js')) ||
                        (type === 'css' && name.endsWith('.css')) ||
                        (type !== 'js' && type !== 'css')) {
                        const filePath = path.join(fullSearchPath, name);
                        log(`Adding file: ${filePath}`);
                        matchingFiles.push(createFileInfo(filePath, workspaceFolder));
                    }
                } else if (fileType === vscode.FileType.Directory) {
                    log(`Recursing into directory: ${name}`);
                    const subDirFiles = await findMatchingFiles(path.join(parsedPath, name), workspaceFolder, type, currentPlugin);
                    matchingFiles.push(...subDirFiles);
                }
            }
        } catch (error) {
            log(`Error reading directory ${fullSearchPath}: ${error}`);
        }
    }

    const result = removeDuplicatesAndSort(matchingFiles);
    log(`Returning ${result.length} matching files`);
    return result;
}