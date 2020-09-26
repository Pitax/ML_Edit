import { compileFunction } from 'vm';
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. 
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerML|| defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerML'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	let pattern = /(HH)/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		let diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} la variabile non esiste o è scritta male`,
			source: 'ML Edit'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Errore Variabile'
				}
			];
		}
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			//Funzioni
			{label: 'ABS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'AXALARM', kind: CompletionItemKind.Function, data: 1	},
			{label: 'CLRDISP', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDABS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDACOS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDASIN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDATAN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDATAN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDATOD', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDCEIL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDCOS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDCOSH', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDDTOA', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDEXP', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDFLOINT', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDFLOOR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDINTFLO', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDLOG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDLOGE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDPOW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDREAD', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDROUND', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDSIGN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDSIN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDSINH', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDSQRT', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDTAN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DDTANH', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DISPCH', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DISPDEC', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DISPQUO', kind: CompletionItemKind.Function, data: 1	},
			{label: 'DISPWORD', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFBW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFWL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFAPPEND', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFASSIGN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFATOI', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFBIND', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFDEBIN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFBITPROBE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCOMPENS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCONNECT', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCONSLEDOFF', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCONSOLE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCOUPLE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCOUPLE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCYC', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFGTAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFINDMAX', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFITOA', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFKMU', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFLW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFLDARCHDS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFLGANTRY', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFLOCK', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFMSPEC', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFORIG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFOSCILLATE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFOUTANALOG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFOVR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFOUTRIFI', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPALMON', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPALMOFF', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPALMPRESET', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPOSALIGN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPOSFREE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPOSITJ', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPOSOFF', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFRDPAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFRDSTAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFRDTAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFRDVAL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFRDVAL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFRDW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFTESTW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFWRW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFANDW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFORW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFXORW', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFRDZERO', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSENCOS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSETAXREP', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSETERGEN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSETFC', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSETJOG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSETZERO', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSKCOLOR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSPECPOSQA', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSPINGEAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSPINGEARAUX', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSTRCMP', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSTRDEL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSTRLEN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSQRADD', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSQRSUB', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSQRMUL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFSYNC', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFTAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFTEXTCLOSE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFTEXTDEL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFTEXTOPEN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFTEXTWRITE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFUNCOUPLE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFWB', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFWRCENTAV', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFWRPAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFWRSTAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFZEROTYPE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'MOLDIV', kind: CompletionItemKind.Function, data: 1	},
			{label: 'PRESS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'PUSHALT', kind: CompletionItemKind.Function, data: 1	},
			{label: 'RBUFTOOL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'RDPAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'RDPRM', kind: CompletionItemKind.Function, data: 1	},
			{label: 'RDQUO', kind: CompletionItemKind.Function, data: 1	},
			{label: 'RPARTOOL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'SEARCHPOS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'WBUFTOOL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'WBUFPOS', kind: CompletionItemKind.Function, data: 1	},
			{label: 'WPARTOOL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'WRPAR', kind: CompletionItemKind.Function, data: 1	},
			{label: 'WRPRM', kind: CompletionItemKind.Function, data: 1	},
			{label: 'ZEROSPINDLE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'ANALOGIC', kind: CompletionItemKind.Function, data: 1	},
			{label: 'CLOSESER', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFANGLE', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFARCXY', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCHANGEFIL', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCHG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFCHG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFFCOB', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFINB', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFINDEX', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFLN', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFLOG', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFOUTB', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPALM', kind: CompletionItemKind.Function, data: 1	},
			{label: 'FFPWM', kind: CompletionItemKind.Function, data: 1	},
			//Variabili ZSTAR HH
			{label: 'HHALARM', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHBOARDALARM', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHBOX', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHBRAKE', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHBRAKESTAT', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHCONTROL', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHCURR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHCURRPERC', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHDCVOLT', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHDCVOLTOFF', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHENCMV', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHENCVERR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHENCWARN', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHENDATN', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHENDATP', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOALARM', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOHW', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVORXER', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOTEMP', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOTXER', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOUPDSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOVERSION', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIINTDTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIINTTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHEVOWARNING', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIMAXDTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIMAXTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIMOD', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIMODPERC', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIPROPDTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIPROPTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIREF', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIREFPERC', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHIREFSET', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHISD', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHKVREFSET', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHMOTENC', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHMOTORSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHMOTREF', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHMOTVEL', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHMOTVOLT', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHNOSMOOTHREF', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHPOLEPOS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHPOSENC', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHPOWER', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHPOWERPERC', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHPOWEVOPOS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSAFESTAT', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSLIP', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSLSACTIVATE', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSLSACTIVSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSLSSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSOSACTIVATE', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSOSACTIVSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSOSSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSPEEDTOL', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSPINLOAD', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTEMPDRI', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTEMPMOT', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTIMES', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTORQUE', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTORQUEMODE', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTURBOFREQ', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTURBOMAP', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHTURNUNIT', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVERS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVINTDTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVINTTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVPROPDTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVPROPTAR', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVREFSET', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVSD', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHVSQ', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHWARNING', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHZEROSTATUS', kind: CompletionItemKind.Class, data: 2	},
			{label: 'HHZEROTYPE', kind: CompletionItemKind.Class, data: 2	},
			//Variabili GG
			{label: 'GGEENKMU', kind: CompletionItemKind.Interface, data: 3	},
			{label: '#GGAD', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGADMAP', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGAPAGVIS', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGAPLGANTRY', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGBITBB', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGBLACKBOX', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGBUFIN', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGBUFINW', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGBUFOUT', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCLOCK', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCLOCKT', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCLOCKTON', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCNTIME', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUNT', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUNTCMD', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUNTON', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUNTOUT', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUNTREF', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUNTSET', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUNTPLC', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCNTIMEOFF', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUPLE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUPLES', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGCOUPLE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGDCOUPLE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGDCOUPLES', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGDGANTRY', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGEPS', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGERLINK', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGERRWFILE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGFIRSTCYCLE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGFLAGANTRY', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGFLAGMLK', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGKMUOFFS', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGLANGUAGE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGLICOP', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGMES', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGMESDE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGMLTYPE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGMONTH', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGNOMOD', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGNTOOL', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGNUMSERIE', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGOPSOFT', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGOUTKMU', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGOUTKMU', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPA', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPALMIN', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPALMINL', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPALMOUT', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPALMOUTL', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPKTLOST', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPRMFLAG', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPROC', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPROCMAP', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPUB', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPUB', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPUL', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPUL', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPUW', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGPUW', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGQUOLGANTRY', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGRS', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGSCOPESLOW', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGSEC', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGSHUTDOWN', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGSK', kind: CompletionItemKind.Interface, data: 3	},
			{label: '#GGTALX', kind: CompletionItemKind.Interface, data: 3	},
			{label: '#GGTALY', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGTALZ', kind: CompletionItemKind.Interface, data: 3	},
			{label: '#GGTALKX', kind: CompletionItemKind.Interface, data: 3	},
			{label: '#GGTALKY', kind: CompletionItemKind.Interface, data: 3	},
			{label: '#GGTALKZ', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGTERMPROC', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGTEXTERR', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGTEXTERRALL', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGTLGANTRY', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGTOOL…', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGTPLCK', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGUSTAB', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGVOLKMU', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGVOLKMU', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGWRITEVIS', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGZLINKBREAK', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGZLINKERRMAP', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGZLINKERR', kind: CompletionItemKind.Interface, data: 3	},
			{label: 'GGZLINKSTAT', kind: CompletionItemKind.Interface, data: 3	},
			//Variabili ZZ
			{label: 'ZZUFAST', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZACINDEX', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZACMANTAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZACMAXCOMP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZACMAXTAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZACSATMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZACTOOL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZACTOOLPOINT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZASNKMU', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXER', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXERAL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXINCH', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXINDEX', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXJOG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXLIVE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXLIVERES', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXLOAD', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXMDIJOG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXMOVMIN', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZAXMOVS', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZAXMOVSINC', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZAXMOVT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXMOVTIME', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXNAME', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXNKMU', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXNOREP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXNOZERO', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXRIP', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZAXVEL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXVELMIN', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXVELTIME', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZAXVID', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZBLCOMPNM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZBUFPOS', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZBUFRIF', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCENTAV', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCENTAV', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCOMPNM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCOMPNMVEL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCONSIN-ZZCONSOUT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCORRTERM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCORRTERM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZCORS', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDATITAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDATITAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDDL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDDR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDGANTRY', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDIFFPOSNM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDIST', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDMARK', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDRYRUN', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDRYMOV', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZDZERO', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZERCODE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZERFLAG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZERNMK', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZERNM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZERRDPEMAIL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFAMTOOL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFEEDRG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFILTOOL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFJOGN', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFJOGP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFLAGFOR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFLAGML', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFLAGMOD', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFLAGMOD', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFMAX', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFPRG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFREAL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZFRIPS', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZGPHASE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZGIDATA', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZGANTOFFCOM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZGANTOFFSTAT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZHOLD', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZHOLDSTAT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZHWINPUTNUM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZHWMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZHWSTEPNM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZKVTAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZINCJOG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZLEFF', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZLIMFCMDI', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZLIMIT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZLIMITAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZLIMOBASE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZLIMOBASETAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZLINK', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMAPSIM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMESALARM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMESFLAG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMESHOLD', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMESSTOP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMAXVEL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMAXVEL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMAXVELMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMAXVELMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMDIJOGFILE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMDIJOGMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMDIJOGSTATUS', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMDIMDIFILE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMOVJOGZL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZMSG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZNAXTAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZNOHOMING', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZNOPOZMAN', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZNUMGANTRY', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZNUMDNC', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOBASE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFFJOG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFJOGNORES', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFSURF', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFSURFVEL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFSURFHW', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFSURFMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFSURFMAXI', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFSURFMOV', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOFSURFZERO', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOPRDISABLE', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZORG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZORGSUP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZOVEREFF', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPAL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPIECES', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPIECESFLAG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPIECESREF', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPLCFAST', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPLCZERO', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZPLR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPLS', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZPLT', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZPPR', kind: CompletionItemKind.Struct, data: 4	},
			{label: '#ZZPPT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPOZ', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPOZAUTO', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPROBEMAP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPROGN', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPWMFSTAT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZPZL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZQUOGANTRY', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZRAPIDTAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZREALCOMPNM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZREFNUM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZREFF', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSAUXT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSETZERO', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSMAX', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSMAXG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPACESYNC', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPEED', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPEEDPROG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPINDATA', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPINDATA', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPINDLEPOS', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPINDLEPOSREQ', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPINDLERPM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPINLOAD', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSPINTAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSTARTCOUNT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSTATO', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSTATOTAS', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSTOPCOUNT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSTOPFAST', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZSURVAX', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTACT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTLIFEAX', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTFK', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTLIFEFLAG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTLIFER', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTLIFERMEM', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTPROG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZTRANSTEP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZUADV', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZUFAST', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZVALG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZVALSYNC', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZVELMAXCOMP', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZVELMAXTAR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZVELMICR', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZVG', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZVMAXHW', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZWALL', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZWALLON', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZWALLSTAT', kind: CompletionItemKind.Struct, data: 4	},
			{label: 'ZZZNC', kind: CompletionItemKind.Struct, data: 4	},
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'Funzioni CNC';
			item.documentation = 'CNC Documentation';
		} else if (item.data === 2) {
			item.detail = 'Variabili ZSTAR';
			item.documentation = 'CNC Documentation';
		} else if (item.data === 3) {
			item.detail = 'Variabili Base GG';
			item.documentation = 'CNC Documentation';
		} else if (item.data === 4) {
			item.detail = 'Variabili Base ZZ';
			item.documentation = 'CNC Documentation';
		}
		
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
