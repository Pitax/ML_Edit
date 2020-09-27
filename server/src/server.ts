import { compileFunction } from 'vm';
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	Hover,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult, Range
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

//Import per Gestione onHover
import { CursorInfo} from './common/types'
const getCursorInfo = (
	text: string,
	start: number,
	end: number
  ): CursorInfo => {
	while (start >= 0 && /[a-zA-Z0-9_#@]/.test(text[start])) {
	  start--
	}
  
	while (end < text.length && /[a-zA-Z0-9_(]/.test(text[end])) {
	  end++
  
	  if (text.substr(end - 1, 1) === '(') {
		return {
		  type: 'function',
		  word: text.substr(start + 1, end - start - 1)
		}
	  }
	}
  
	return {
	  type: 'default',
	  word: text.substr(start + 1, end - start - 1)
	}
  }


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
			},
			hoverProvider: true
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
	let patternHH = /\b(?=HH)(?!(HHALARM|HHBOARDALARM|HHBOX|HHBRAKE|HHBRAKESTAT|HHCONTROL|HHCURR|HHCURRPERC|HHDCVOLT|HHDCVOLTOFF|HHENCMV|HHENCVERR|HHENCWARN|HHENDATN|HHENDATP|HHEVOALARM|HHEVOHW|HHEVORXER|HHEVOSTATUS|HHEVOTEMP|HHEVOTXER|HHEVOUPDSTATUS|HHEVOVERSION|HHIINTDTAR|HHIINTTAR|HHEVOWARNING|HHIMAXDTAR|HHIMAXTAR|HHIMOD|HHIMODPERC|HHIPROPDTAR|HHIPROPTAR|HHIREF|HHIREFPERC|HHIREFSET|HHISD|HHKVREFSET|HHMOTENC|HHMOTORSTATUS|HHMOTREF|HHMOTVEL|HHMOTVOLT|HHNOSMOOTHREF|HHPOLEPOS|HHPOSENC|HHPOWER|HHPOWERPERC|HHPOWEVOPOS|HHSAFESTAT|HHSLIP|HHSLSACTIVATE|HHSLSACTIVSTATUS|HHSLSSTATUS|HHSOSACTIVATE|HHSOSACTIVSTATUS|HHSOSSTATUS|HHSPEEDTOL|HHSPINLOAD|HHSTATUS|HHTEMPDRI|HHTEMPMOT|HHTIMES|HHTORQUE|HHTORQUEMODE|HHTURBOFREQ|HHTURBOMAP|HHTURNUNIT|HHVERS|HHVINTDTAR|HHVINTTAR|HHVPROPDTAR|HHVPROPTAR|HHVREFSET|HHVSD|HHVSQ|HHWARNING|HHZEROSTATUS|HHZEROTYPE)\b)\w+/g;
	let patternGG = /\b(?=(GG))(?!(GGEENKMU|GGAD|GGADMAP|GGAPAGVIS|GGAPLGANTRY|GGBITBB|GGBLACKBOX|GGBUFIN|GGBUFINW|GGBUFOUT|GGCLOCK|GGCLOCKT|GGCLOCKTON|GGCNTIME|GGCOUNT|GGCOUNTCMD|GGCOUNTON|GGCOUNTOUT|GGCOUNTREF|GGCOUNTSET|GGCOUNTPLC|GGCNTIMEOFF|GGCOUPLE|GGCOUPLES|GGCOUPLE|GGDCOUPLE|GGDCOUPLES|GGDGANTRY|GGEPS|GGERLINK|GGERRWFILE|GGFIRSTCYCLE|GGFLAGANTRY|GGFLAGMLK|GGKMUOFFS|GGLANGUAGE|GGLICOP|GGMES|GGMESDE|GGMLTYPE|GGMONTH|GGNOMOD|GGNTOOL|GGNUMSERIE|GGOPSOFT|GGOUTKMU|GGOUTKMU|GGPA|GGPALMIN|GGPALMINL|GGPALMOUT|GGPALMOUTL|GGPKTLOST|GGPRMFLAG|GGPROC|GGPROCMAP|GGPUB|GGPUB|GGPUL|GGPUL|GGPUW|GGPUW|GGQUOLGANTRY|GGRS|GGSCOPESLOW|GGSEC|GGSHUTDOWN|GGSK|#GGTALX|#GGTALY|GGTALZ|#GGTALKX|#GGTALKY|#GGTALKZ|GGTERMPROC|GGTEXTERR|GGTEXTERRALL|GGTLGANTRY|GGTOOL…|GGTPLCK|GGUSTAB|GGVOLKMU|GGVOLKMU|GGWRITEVIS|GGZLINKBREAK|GGZLINKERRMAP|GGZLINKERR|GGZLINKSTAT)\b)\w+/g;
	let patternZZ = /\b(?=ZZ)(?!(ZZR|ZZUFAST|ZZACINDEX|ZZACMANTAR|ZZACMAXCOMP|ZZACMAXTAR|ZZACSATMAP|ZZACTOOL|ZZACTOOLPOINT|ZZASNKMU|ZZAXER|ZZAXERAL|ZZAXINCH|ZZAXINDEX|ZZAXJOG|ZZAXLIVE|ZZAXLIVERES|ZZAXLOAD|ZZAXMAP|ZZAXMDIJOG|ZZAXMOVMIN|#ZZAXMOVS|#ZZAXMOVSINC|#ZZAXMOVT|ZZAXMOVTIME|ZZAXNAME|ZZAXNKMU|ZZAXNOREP|ZZAXNOZERO|ZZAXRIP|#ZZAXVEL|ZZAXVELMIN|ZZAXVELTIME|ZZAXVID|ZZBLCOMPNM|ZZBUFPOS|ZZBUFRIF|ZZCENTAV|ZZCENTAV|ZZCOMPNM|ZZCOMPNMVEL|ZZCONSIN-ZZCONSOUT|ZZCORRTERM|ZZCORRTERM|ZZCORS|ZZDATITAR|ZZDATITAR|ZZDDL|ZZDDR|ZZDGANTRY|ZZDIFFPOSNM|ZZDIST|ZZDMARK|ZZDRYRUN|ZZDRYMOV|ZZDZERO|ZZERCODE|ZZERFLAG|ZZERNMK|ZZERNM|ZZERRDPEMAIL|ZZFAMTOOL|ZZFEEDRG|ZZFILTOOL|ZZFJOGN|ZZFJOGP|ZZFLAGFOR|ZZFLAGML|ZZFLAGMOD|ZZFLAGMOD|ZZFMAX|ZZFPRG|ZZFREAL|ZZFRIPS|ZZGPHASE|ZZGIDATA|ZZGANTOFFCOM|ZZGANTOFFSTAT|ZZHOLD|ZZHOLDSTAT|ZZHWINPUTNUM|ZZHWMAP|ZZHWSTEPNM|ZZKVTAR|ZZINCJOG|ZZLEFF|ZZLIMFCMDI|ZZLIMIT|ZZLIMITAR|ZZLIMOBASE|ZZLIMOBASETAR|ZZLINK|ZZMAPSIM|ZZMESALARM|ZZMESFLAG|ZZMESHOLD|ZZMESSTOP|ZZMAXVEL|ZZMAXVEL|ZZMAXVELMAP|ZZMAXVELMAP|ZZMDIJOGFILE|ZZMDIJOGMAP|ZZMDIJOGSTATUS|ZZMDIMDIFILE|ZZMOVJOGZL|ZZMSG|ZZNAXTAR|ZZNOHOMING|ZZNOPOZMAN|ZZNUMGANTRY|ZZNUMDNC|ZZOBASE|ZZOFFJOG|ZZOFJOGNORES|ZZOFSURF|ZZOFSURFVEL|ZZOFSURFHW|ZZOFSURFMAP|ZZOFSURFMAXI|ZZOFSURFMOV|ZZOFSURFZERO|ZZOPRDISABLE|ZZORG|ZZORGSUP|ZZOVEREFF|ZZPAL|ZZPIECES|ZZPIECESFLAG|ZZPIECESREF|ZZPLCFAST|ZZPLCZERO|#ZZPLR|ZZPLS|#ZZPLT|#ZZPPR|#ZZPPT|ZZPOZ|ZZPOZAUTO|ZZPROBEMAP|ZZPROGN|ZZPWMFSTAT|ZZPZL|ZZQUOGANTRY|ZZRAPIDTAR|ZZREALCOMPNM|ZZREFNUM|ZZREFF|ZZSAUXT|ZZSETZERO|ZZSMAX|ZZSMAXG|ZZSPACESYNC|ZZSPEED|ZZSPEEDPROG|ZZSPINDATA|ZZSPINDATA|ZZSPINDLEPOS|ZZSPINDLEPOSREQ|ZZSPINDLERPM|ZZSPINLOAD|ZZSPINTAR|ZZSTARTCOUNT|ZZSTATO|ZZSTATOTAS|ZZSTOPCOUNT|ZZSTOPFAST|ZZSURVAX|ZZTACT|ZZTLIFEAX|ZZTFK|ZZTLIFEFLAG|ZZTLIFER|ZZTLIFERMEM|ZZTPROG|ZZTRANSTEP|ZZUADV|ZZUFAST|ZZVALG|ZZVALSYNC|ZZVELMAXCOMP|ZZVELMAXTAR|ZZVELMICR|ZZVG|ZZVMAXHW|ZZWALL|ZZWALLON|ZZWALLSTAT|ZZZNC)\b)\w+/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = patternHH.exec(text)) && problems < settings.maxNumberOfProblems) {
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
					message: 'Errore Variabile ZSTAR'
				}
			];
		}
		diagnostics.push(diagnostic);
	}
	while ((m = patternGG.exec(text)) && problems < settings.maxNumberOfProblems) {
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
					message: 'Errore Variabile GG'
				}
			];
		}
		diagnostics.push(diagnostic);
	}
	while ((m = patternZZ.exec(text)) && problems < settings.maxNumberOfProblems) {
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
					message: 'Errore Variabile ZZ'
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
		// 	{label: '', kind: CompletionItemKind.Text},
		// 	{label: 'HHALARM', kind: CompletionItemKind.Function, detail: 'prova', data: 1},
		//  {label: 'ABS', kind: CompletionItemKind.Function, data: 1	},	   
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {item.detail = 'Contiene gli allarmi diagnosticati dall’azionamento digitale  che  provocano  l’arresto immediato del moto';
			item.documentation = ('Bit0 : Allarme protezione termica it del motore\n\r Bit 1: Allarme sovratemperatura azionamento');
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

//Aggiunt

//Gestion di onHover
connection.onHover(
	(_textDocumentPosition: TextDocumentPositionParams): Hover | undefined => {
	  const document: TextDocument | undefined = documents.get(_textDocumentPosition.textDocument.uri)
 	  if (!document) {
		return {
		  contents: ''
		}
	  }
  
	  const text: string = document.getText()
	  const offset: number = document.offsetAt(_textDocumentPosition.position)
  
	  let start: number = offset
	  let end: number = offset + 1
  
	  const cursorInfo: CursorInfo = getCursorInfo(text, start, end)
	  
	  if (cursorInfo.word = 'HHCONTROL') 
	  {return { contents: 'Consente di controllare in tempo reale il funzionamento degli azionamenti digitali\n\rBit 0: 1= Comando di Reset allarmi azionamento'}}
	}
  )

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
