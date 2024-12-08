'use strict';

import {
    DocumentLinkProvider as vsDocumentLinkProvider,
    TextDocument,
    ProviderResult,
    DocumentLink,
    workspace,
    Position,
    CancellationToken,
    Range
} from "vscode";
import { getFilePaths, SEARCH_PATTERNS, getWordAtPosition } from "../utils/searchUtils";
import { log } from '../utils/logger';


export default class LinkProvider implements vsDocumentLinkProvider {
    constructor() {}

    public provideDocumentLinks(document: TextDocument, token: CancellationToken): ProviderResult<DocumentLink[]> {
        // log('LinkProvider.provideDocumentLinks called');
        let documentLinks = [];
        let config = workspace.getConfiguration('cakephp_goto_view');

        const linkEnabled = config.get<boolean>('quickJump', true);

        if (!linkEnabled) {
            // log('Link provider is disabled by configuration');
            return null;
        }

        let linesCount = document.lineCount <= config.get('maxLinesCount', 1000) ? document.lineCount : config.get('maxLinesCount', 1000);
        let index = 0;
        log(`Scanning ${linesCount} lines`);

        const isAssetCompressIni = document.fileName.endsWith('asset_compress.ini');

        while (index < linesCount) {
            let line = document.lineAt(index);

            if (isAssetCompressIni) {
                const filePath = line.text;
                if (filePath) {
                    let files = getFilePaths(filePath, document);
                    log(`Files found: ${files.length}`);
                    log(`File path: ${JSON.stringify(files)}`);
                    if (files.length > 0) {
                        let file = files[0];
                        const startIndex = line.text.match(/files\[\]\s*=\s*/)?.[0].length || 0;
                        let start = new Position(line.lineNumber, startIndex);
                        let end = new Position(line.lineNumber, line.text.length);
                        let documentlink = new DocumentLink(new Range(start, end), file.fileUri);
                        documentLinks.push(documentlink);
                        log(`Document link added for ${file.fileUri}`);
                    }
                }
            } else {
                for (let regex of Object.values(SEARCH_PATTERNS)) {
                    let result = line.text.match(regex);
                    // log(`Line ${index + 1}: ${result ? 'Match found' : 'No match'} for ${regex}`);

                    if (result !== null) {
                        log(`Line ${index + 1}: ${result ? 'Match found' : 'No match'} for ${regex}`);
                        log(`Matches found: ${result.length}`);
                        for (let item of result) {
                            let files = getFilePaths(item, document);
                            if (files.length > 0) {
                                let file = files[0];
                                let capturedContent = result[1];
                                let startIndex = line.text.indexOf(capturedContent);
                                let start = new Position(line.lineNumber, startIndex);
                                let end = start.translate(0, capturedContent.length);
                                let documentlink = new DocumentLink(new Range(start, end), file.fileUri);
                                documentLinks.push(documentlink);
                                log(`Document link added for ${file.fileUri}`);
                            }
                        }
                    }
                }
            }

            index++;
        }

        log(`Total document links found: ${documentLinks.length}`);
        return documentLinks;
    }
}
