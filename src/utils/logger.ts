import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function initializeLogger() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('CakePHP Goto View');
    }
}

export function log(message: string) {
    if (outputChannel) {
        outputChannel.appendLine(message);
    }
}

export function getOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        initializeLogger();
    }
    return outputChannel;
}
