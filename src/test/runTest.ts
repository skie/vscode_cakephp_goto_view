const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
	const extensionTestsPath = path.resolve(__dirname, './suite/index');
    
    const vscodeVersion = '1.93.0';
    
    console.log(`Attempting to download VS Code version ${vscodeVersion}`);
    
    const vscodeExecutablePath = await runTests({
      version: vscodeVersion,
      platform: 'win32-x64-archive',
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions'
      ]
    });

    console.log(`Using VS Code executable at: ${vscodeExecutablePath}`);

  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
