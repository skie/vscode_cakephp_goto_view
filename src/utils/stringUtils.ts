export function underscore(str: string): string {
    return str.replace(/([A-Z])/g, function($1) { return "_" + $1.toLowerCase(); });
}

export function pluralize(str: string): string {
    if (str.endsWith('y')) {
        return str.slice(0, -1) + 'ies';
    } else if (str.endsWith('s')) {
        return str + 'es';
    } else {
        return str + 's';
    }
}

export function singularize(str: string): string {
    if (str.endsWith('ies')) {
        return str.slice(0, -3) + 'y';
    } else if (str.endsWith('es')) {
        return str.slice(0, -2);
    } else if (str.endsWith('s')) {
        return str.slice(0, -1);
    } else {
        return str;
    }
}

export function camelize(str: string): string {
    return str.replace(/[-_](\w)/g, function(_, c) { return c ? c.toUpperCase() : ''; });
}

export function variableCamelize(str: string): string {
    return str.replace(/[-_](\w)/g, function(_, c, i) {
        if (i === 0) {
            return c.toLowerCase();
        }
        return c.toUpperCase();
    });
}