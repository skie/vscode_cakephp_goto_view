import { log } from '../utils/logger';

export let namespaceMap: { [key: string]: string } | null = null;

export function setNamespaceMap(map: { [key: string]: string }) {
    namespaceMap = map;
}

export function getPluginPath(namespace: string): string | null {
    log(`getPluginPath called with namespace: ${namespace}`);
    if (!namespaceMap) {
        log('namespaceMap is null');
        return null;
    }
    const normalizedNamespace = namespace.replace(/\//g, '\\');
    log(`Normalized namespace: ${normalizedNamespace}`);
    const pluginPath = namespaceMap[normalizedNamespace];

    return pluginPath || null;
}

export function parseElementName(elementName: string): { plugin: string | null, path: string } {
    log(`parseElementName called with elementName: ${elementName}`);
    const parts = elementName.split('.');
    if (parts.length > 1) {
        if (parts[parts.length - 1] === 'js' || parts[parts.length - 1] === 'css') {
            parts.pop();
        }
    }
    if (parts.length > 1) {
        const plugin = parts[0];
        const path = parts.slice(1).join('.');
        log(`Parsed as plugin: ${plugin}, path: ${path}`);
        return { plugin, path };
    }
    log(`No plugin found, path: ${elementName}`);
    return { plugin: null, path: elementName };
}