import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('HoverProvider Test Suite', () => {
    vscode.window.showInformationMessage('Start HoverProvider tests.');

    let outputChannel: vscode.OutputChannel;

    suiteSetup(() => {
        outputChannel = vscode.window.createOutputChannel('HoverProvider Test');
    });

    suiteTeardown(() => {
        outputChannel.dispose();
    });

    test('HoverProvider provides hover information for CakePHP controller', async () => {
        const fixturePath = path.resolve(__dirname, '../../../fixtures/cakephp_app/src/Controller/TestController.php');

        const document = await vscode.workspace.openTextDocument(fixturePath);
        await vscode.window.showTextDocument(document);

        const position = new vscode.Position(10, 22); // Adjust this based on where 'render' is in your test file
        const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', document.uri, position);

        // We can't directly access other extension's output channels
        // Instead, let's log our test results
        outputChannel.appendLine('Test results:');
        outputChannel.appendLine(`Hover results length: ${hoverResults?.length}`);
        if (hoverResults && hoverResults.length > 0) {
            const hoverContent = hoverResults[0].contents[0];
            if (hoverContent instanceof vscode.MarkdownString) {
                outputChannel.appendLine(`Hover content: ${hoverContent.value}`);
            }
        }
        outputChannel.show();
        console.log('Test completed. Check the Test Output channel for details.');
        assert.strictEqual(hoverResults?.length, 1, 'Expected one hover result');

        const hoverContent = hoverResults![0].contents[0];
        assert.ok(hoverContent instanceof vscode.MarkdownString, 'Hover content should be a MarkdownString');
        assert.ok((hoverContent as vscode.MarkdownString).value.includes('render'), 'Hover should include information about the render method');
    });
});