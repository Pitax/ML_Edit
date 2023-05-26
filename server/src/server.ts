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
	InitializeResult, Range, createClientPipeTransport
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

//Import per Gestione onHover
import { CursorInfo } from './Common/types'
const getCursorInfo = (
	text: string,
	start: number,
	end: number
  ): CursorInfo => {
	while (start >= 0 && /[a-zA-Z0-9_@]/.test(text[start])) {
	  start--
	}
  
	while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) {
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
	let patternHH = /\b(?=HH)(?!(HHCURRMPERC|HHALARM|HHBOARDALARM|HHBOX|HHBRAKE|HHBRAKESTAT|HHCONTROL|HHCURR|HHCURRPERC|HHDCVOLT|HHDCVOLTOFF|HHENCMV|HHENCVERR|HHENCWARN|HHENDATN|HHENDATP|HHEVOALARM|HHEVOHW|HHEVORXER|HHEVOSTATUS|HHEVOTEMP|HHEVOTXER|HHEVOUPDSTATUS|HHEVOVERSION|HHIINTDTAR|HHIINTTAR|HHEVOWARNING|HHIMAXDTAR|HHIMAXTAR|HHIMOD|HHIMODPERC|HHIPROPDTAR|HHIPROPTAR|HHIREF|HHIREFPERC|HHIREFSET|HHISD|HHKVREFSET|HHMOTENC|HHMOTORSTATUS|HHMOTREF|HHMOTVEL|HHMOTVOLT|HHNOSMOOTHREF|HHPOLEPOS|HHPOSENC|HHPOWER|HHPOWERPERC|HHPOWEVOPOS|HHSAFESTAT|HHSLIP|HHSLSACTIVATE|HHSLSACTIVSTATUS|HHSLSSTATUS|HHSOSACTIVATE|HHSOSACTIVSTATUS|HHSOSSTATUS|HHSPEEDTOL|HHSPINLOAD|HHSTATUS|HHTEMPDRI|HHTEMPMOT|HHTIMES|HHTORQUE|HHTORQUEMODE|HHTURBOFREQ|HHTURBOMAP|HHTURNUNIT|HHVERS|HHVINTDTAR|HHVINTTAR|HHVPROPDTAR|HHVPROPTAR|HHVREFSET|HHVSD|HHVSQ|HHWARNING|HHZEROSTATUS|HHZEROTYPE)\b)\w+/g;
	let patternGG = /\b(?=(GG))(?!(GGSISETPOS|GGSIPOSIN|GGSIPOS|GGSISETVEL|GGSISETINC|GSIPOS|GGSIVEL|GGSIRAP|GGSIOVR|GGSIFFW|GGSIINC|GGSIMOVP|GGSIMOVN|GGSIOVR|GGSIDISCRETE|GGSIFFW|GGSIDELAY|GGSIMAP|GGSIERRMAP|GGSIMOVING|GGSITYPE|GGSIAXES|GGSIDIST|GGSIERR|GGSIFLAG|GGFLWAXES|GGFLWDELTA|GGFLWERPOS|GGFLWERNEG|GGFLWPIVOT|GGSIMAP|GGSITYPE|GGSIAXES|ZZSIAXMAP|GGLIVEPHASE|GGZZTMP2U|GGZZDD|GGZZTMP5U|GGZZTMP0U|GGZZTT|GGZZTMP0U|GGPARFLAG|GGPAR24DE|GGPARFLAG|GGEENKMU|GGAD|GGADMAP|GGAPAGVIS|GGAPLGANTRY|GGBITBB|GGBLACKBOX|GGBUFIN|GGBUFINW|GGBUFOUT|GGCLOCK|GGCLOCKT|GGCLOCKTON|GGCNTIME|GGCOUNT|GGCOUNTCMD|GGCOUNTON|GGCOUNTOUT|GGCOUNTREF|GGCOUNTSET|GGCOUNTPLC|GGCNTIMEOFF|GGCOUPLE|GGCOUPLE3|GGCOUPLES|GGDCOUPLE|GGDCOUPLES|GGDGANTRY|GGEPS|GGERLINK|GGERRWFILE|GGFIRSTCYCLE|GGFLAGANTRY|GGFLAGMLK|GGKMUOFFS|GGLANGUAGE|GGLICOP|GGMES|GGMESDE|GGMLTYPE|GGMONTH|GGNOMOD|GGNTOOL|GGNUMSERIE|GGOPSOFT|GGOUTKMU|GGOUTKMU|GGPA|GGPALMIN|GGPALMINL|GGPALMOUT|GGPALMOUTL|GGPKTLOST|GGPRMFLAG|GGPROC|GGPROCMAP|GGPUB|GGPUB|GGPUL|GGPUL|GGPUW|GGPUW|GGQUOLGANTRY|GGRS|GGSCOPESLOW|GGSEC|GGSHUTDOWN|GGSK|GGTALX|GGTALY|GGTALZ|GGTALKX|GGTALKY|GGTALKZ|GGTERMPROC|GGTEXTERR|GGTEXTERRALL|GGTLGANTRY|GGTOOL…|GGTPLCK|GGUSTAB|GGVOLKMU|GGVOLKMU|GGWRITEVIS|GGZLINKBREAK|GGZLINKERRMAP|GGZLINKERR|GGZLINKSTAT)\b)\w+/g;
	let patternZZ = /\b(?=ZZ)(?!(ZZRTCPNUMREQ|ZZFEED|ZZJOGFLAG|ZZOVEREFFS|ZZMAPZERO|ZZSPLINDLEPOS|ZZG151PHASE|ZZFLAG142|ZZG142S|ZZSAUXU|ZZSAUXE|ZZRESETCOUNT|ZZL|ZZOB|ZZMDIJOGFLAGS|ZZLIMITJOG|ZZR|ZZRA|ZZRBZZUFAST|ZZACINDEX|ZZACMANTAR|ZZSIAXMAP|ZZAXVETL|ZZACMAXCOMP|ZZACMAXTAR|ZZACSATMAP|ZZACTOOL|ZZACTOOLPOINT|ZZASNKMU|ZZAXER|ZZAXERAL|ZZAXINCH|ZZAXINDEX|ZZAXJOG|ZZAXLIVE|ZZAXLIVERES|ZZAXLOAD|ZZAXMAP|ZZAXMDIJOG|ZZAXMOVMIN|ZZAXMOVS|ZZCORH|ZZAXMOVSINC|ZZAXMOVT|ZZAXMOVTIME|ZZAXNAME|ZZAXNKMU|ZZAXNOREP|ZZAXNOZERO|ZZAXRIP|ZZAXVEL|ZZAXVELMIN|ZZAXVELTIME|ZZAXVID|ZZBLCOMPNM|ZZBUFPOS|ZZBUFRIF|ZZCENTAV|ZZCENTAV|ZZCOMPNM|ZZCOMPNMVEL|ZZCONSIN-ZZCONSOUT|ZZCORRTERM|ZZCORRTERM|ZZCORS|ZZDATITAR|ZZDATITAR|ZZDDL|ZZDDR|ZZDDRA|ZZDDRB|ZZDGANTRY|ZZDIFFPOSNM|ZZDIST|ZZDMARK|ZZDRYRUN|ZZDRYMOV|ZZDZERO|ZZERCODE|ZZERFLAG|ZZERNMK|ZZERNM|ZZERRDPEMAIL|ZZFAMTOOL|ZZFEEDRG|ZZFILTOOL|ZZFJOGN|ZZFJOGP|ZZFLAGFOR|ZZFLAGML|ZZFLAGMOD|ZZFLAGMOD|ZZFMAX|ZZFPRG|ZZFREAL|ZZFRIPS|ZZGPHASE|ZZGIDATA|ZZGANTOFFCOM|ZZGANTOFFSTAT|ZZHOLD|ZZHOLDSTAT|ZZHWINPUTNUM|ZZHWMAP|ZZHWSTEPNM|ZZKVTAR|ZZINCJOG|ZZLEFF|ZZLIMFCMDI|ZZLIMIT|ZZLIMITAR|ZZLIMOBASE|ZZLIMOBASETAR|ZZLINK|ZZMAPSIM|ZZMESALARM|ZZMESFLAG|ZZMESHOLD|ZZMESSTOP|ZZMAXVEL|ZZMAXVEL|ZZMAXVELMAP|ZZMAXVELMAP|ZZMDIJOGFILE|ZZMDIJOGMAP|ZZMDIJOGSTATUS|ZZMDIMDIFILE|ZZMOVJOGZL|ZZMSG|ZZNAXTAR|ZZNOHOMING|ZZNOPOZMAN|ZZNUMGANTRY|ZZNUMDNC|ZZOBASE|ZZOFFJOG|ZZOFJOGNORES|ZZOFSURF|ZZOFSURFVEL|ZZOFSURFHW|ZZOFSURFMAP|ZZOFSURFMAXI|ZZOFSURFMOV|ZZOFSURFZERO|ZZOFSURFPLC|ZZOFSURFREQ|ZZOPRDISABLE|ZZORG|ZZORGSUP|ZZOVEREFF|ZZPAL|ZZPIECES|ZZPIECESFLAG|ZZPIECESREF|ZZPLCFAST|ZZPLCZERO|ZZPLR|ZZPLS|ZZPLT|ZZPPR|ZZPPT|ZZPOZ|ZZPOZAUTO|ZZPROBEMAP|ZZPROGN|ZZPWMFSTAT|ZZPZL|ZZQUOGANTRY|ZZRAPIDTAR|ZZREALCOMPNM|ZZREFNUM|ZZREFF|ZZSAUXT|ZZSETZERO|ZZSMAX|ZZSMAXG|ZZSPACESYNC|ZZSPEED|ZZSPEEDPROG|ZZSPINDATA|ZZSPINDATA|ZZSPINDLEPOS|ZZSPINDLEPOSREQ|ZZSPINDLERPM|ZZSPINLOAD|ZZSPINTAR|ZZSTARTCOUNT|ZZSTATO|ZZSTATOTAS|ZZSTOPCOUNT|ZZSTOPFAST|ZZSURVAX|ZZTACT|ZZTLIFEAX|ZZTFK|ZZTLIFEFLAG|ZZTLIFER|ZZTLIFERMEM|ZZTPROG|ZZTRANSTEP|ZZUADV|ZZUFAST|ZZVALG|ZZVALSYNC|ZZVELMAXCOMP|ZZVELMAXTAR|ZZVELMICR|ZZVG|ZZVMAXHW|ZZWALL|ZZWALLON|ZZWALLSTAT|ZZZNC)\b)\w+/g;
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
		//Variabili verso il CNC Zona E
		{label: 'STARTCNC', kind: CompletionItemKind.Field, detail:'START verso CNC'},
		{label: 'STOPCNC', kind: CompletionItemKind.Field, detail:'STOP verso CNC'},
		{label: 'JOGPCNC', kind: CompletionItemKind.Field, detail:'JOG Pos verso CNC'},
		{label: 'JOGNCNC', kind: CompletionItemKind.Field, detail:'Jog Neg verso CNC'},
		{label: 'RESETCNC', kind: CompletionItemKind.Field, detail:'RESET verso CNC'},
		{label: 'OVRFEED', kind: CompletionItemKind.Class, detail:'Override G1 G2 G3'},
		{label: 'OVRSPEED', kind: CompletionItemKind.Class, detail:'Override Speed MND'},
		{label: 'MOTOM', kind: CompletionItemKind.Field, detail:'Avvio Moto Mandrino'},
		{label: 'POSM', kind: CompletionItemKind.Field, detail:'Avvio Pos. Mandrino'},
		{label: 'SMAN', kind: CompletionItemKind.Field, detail:'Cambia Senso Rot. Mandrino'},
		{label: 'FATTO', kind: CompletionItemKind.Field, detail:'Continua dopo M'},
		{label: 'OVRRAP', kind: CompletionItemKind.Class, detail:'Override G0'},
		//Variabili dal CNC Zona U
		{label: 'CNCSTR', kind: CompletionItemKind.Function, detail:'START dal CNC'},
		{label: 'CNCNOALL', kind: CompletionItemKind.Function, detail:'Nessun Allarme dal CNC'},
		{label: 'CNCRST', kind: CompletionItemKind.Function, detail:'RESET dal CNC'},
		{label: 'BLOC', kind: CompletionItemKind.Function, detail:'STOP dal CNC'},
		{label: 'CNCAJOGP', kind: CompletionItemKind.Function, detail:'Asse in JOG Pos dal CNC'},
		{label: 'CNCAJOGN', kind: CompletionItemKind.Function, detail:'Asse in JOG neg dal CNC'},
		{label: 'CNCUTEST', kind: CompletionItemKind.Function, detail:'Tratatura in Corso dal CNC'},
		{label: 'CNCMOVAX', kind: CompletionItemKind.Function, detail:'Sblocco Asse dal CNC'},
		{label: 'TB', kind: CompletionItemKind.Function, detail:'Posto UT Programmato'},
		{label: 'TA', kind: CompletionItemKind.Function, detail:'Posto UT Mandrino'},
		{label: 'M5', kind: CompletionItemKind.Function, detail:'Stop Mandrino dal CNC'},
		{label: 'M19', kind: CompletionItemKind.Function, detail:'Posizionamento Mandrino dal CNC'},
		{label: 'M7', kind: CompletionItemKind.Function, detail:'Refrigerante 1 dal CNC'},
		{label: 'M8', kind: CompletionItemKind.Function, detail:'Refrigerante 2 dal CNC'},
		{label: 'RMOTOM', kind: CompletionItemKind.Function, detail:'Rich. Moto MND dal CNC'},
		{label: 'MRAMP', kind: CompletionItemKind.Function, detail:'MDN in Rampa'},
		{label: 'MANDINMOTO', kind: CompletionItemKind.Function, detail:'MND in Moto'},
		{label: 'MANDVELOK', kind: CompletionItemKind.Function, detail:'MND Velocita OK'},
		//Aiuti vari CNC
		{label: 'Module 24', kind: CompletionItemKind.Interface, detail:'Modulo 24ms'},
		{label: 'Module 2', kind: CompletionItemKind.Interface, detail:'Modulo 2ms'},
		{label: 'Function', kind: CompletionItemKind.Interface, detail:'Inzio Funzione'},
		{label: 'Include', kind: CompletionItemKind.Interface, detail:'Includi File'},
		{label: 'End Module', kind: CompletionItemKind.Interface, detail:'Modulo 2ms'},
		{label: 'End Function', kind: CompletionItemKind.Interface, detail:'Fine Funzione'},
		{label: 'if', kind: CompletionItemKind.Interface, detail:'Inizio if'},
		{label: 'elseif', kind: CompletionItemKind.Interface, detail:'Funzione elsif'},
		{label: 'else', kind: CompletionItemKind.Interface, detail:'Funzione Else'},
		{label: 'end if', kind: CompletionItemKind.Interface, detail:'Fine if'},
		{label: 'and', kind: CompletionItemKind.Interface, detail:'and'},
		{label: 'or', kind: CompletionItemKind.Interface, detail:'or'},
		// //Variabili Finecorsa e rilevatori
		{label: 'FCXPOS', kind: CompletionItemKind.Interface, detail:'Finecorsa X Positivo'},
		{label: 'FCXNEG', kind: CompletionItemKind.Interface, detail:'Finecorsa X Negativo'},
		{label: 'FCYPOS', kind: CompletionItemKind.Interface, detail:'Finecorsa Y Positivo'},
		{label: 'FCYNEG', kind: CompletionItemKind.Interface, detail:'Finecorsa Y Negativo'},
		{label: 'FCZPOS', kind: CompletionItemKind.Interface, detail:'Finecorsa Z Positivo'},
		{label: 'FCZNEG', kind: CompletionItemKind.Interface, detail:'Finecorsa Z Negativo'},
		{label: 'FCAPOS', kind: CompletionItemKind.Interface, detail:'Finecorsa A Positivo'},
		{label: 'FCANEG', kind: CompletionItemKind.Interface, detail:'Finecorsa A Negativo'},
		{label: 'FCCPOS', kind: CompletionItemKind.Interface, detail:'Finecorsa C Positivo'},
		{label: 'FCCNEG', kind: CompletionItemKind.Interface, detail:'Finecorsa C Negativo'},
		{label: 'FCDPOS', kind: CompletionItemKind.Interface, detail:'Finecorsa D Positivo'},
		{label: 'FCDNEG', kind: CompletionItemKind.Interface, detail:'Finecorsa D Negativo'},
		{label: 'FCXPOSTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat X Positivo'},
		{label: 'FCXNEGTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat X Negativo'},
		{label: 'FCYPOSTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat Y Positivo'},
		{label: 'FCYNEGTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat Y Negativo'},
		{label: 'FCZPOSTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat Z Positivo'},
		{label: 'FCZNEGTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat Z Negativo'},
		{label: 'FCAPOSTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat A Positivo'},
		{label: 'FCANEGTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat A Negativo'},
		{label: 'FCCPOSTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat C Positivo'},
		{label: 'FCCNEGTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat C Negativo'},
		{label: 'FCDPOSTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat D Positivo'},
		{label: 'FCDNEGTAR', kind: CompletionItemKind.Interface, detail:'FC Tarat D Negativo'},
		{label: 'ASSEXVIVO', kind: CompletionItemKind.Interface, detail:'FC Tarat D Negativo'},
		//Variabili Messaggi
		{label: 'HOLDMSG', kind: CompletionItemKind.Interface, detail:'Messaggio HOLD in corso'},
		{label: 'STOPMSG', kind: CompletionItemKind.Interface, detail:'Messaggio STOP in corso'},
		{label: 'ALARMMSG', kind: CompletionItemKind.Interface, detail:'Messaggio ALARM in corso'},
		//Variabili Stato CNC
		{label: 'CNCINJOG', kind: CompletionItemKind.Interface, detail:'Messaggio HOLD in corso'},
		{label: 'CNCINAUTO', kind: CompletionItemKind.Interface, detail:'Messaggio STOP in corso'},
		{label: 'CNCINMDI', kind: CompletionItemKind.Interface, detail:'Messaggio ALARM in corso'},		
		//Variabili Funzioni Generiche
		{label: 'CLOCK1S', kind: CompletionItemKind.Interface, detail:'Clock di 1 Secondo'},

		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {item.detail = 'Testo 1';
			item.documentation = ('Testo 2');
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
	  	//Variabili ZStar HH
		if (cursorInfo.word === 'HHCONTROL') 
			{return { contents: 'Consente di controllare in tempo reale il funzionamento degli azionamenti digitali.\n\rBit 0 : 1= Comando di Reset allarmi azionamento.\n\rBit 1 :1= Azionamento disattivato (da utilizzare solo per usi speciali) \n\rBit 2 : Riservato.\n\rBit 3 :1= Comando di Start per procedura di zero elettrico\n\rBit 4 : Riservato.\n\rBit 5 : 0 = Commutazione su collegamento a stella, 1 = Commutazione su collegamento a triangolo.\n\rBit 6: Attivazione lettura dati diversi 0 = lettura della corrente 1 = lettura corrente, ampiezze encoder, tensione etc.\n\rBit 7-12 : Riservati.\n\rBit 15 14 13 : Controllo della coppia e del moto:\n\r1 1 1 = Comando di attivazione della coppia.\n\r0 1 0 = Comando di frenata a gradino e di disattivazione della coppia\n\r0 1 1 = Comando di frenata con rampa azionamento e disattivazione della coppia al termine la frenata\n\r1 1 0 = Comando di frenata con rampa azionamento e mantenimento della coppia al termine della frenata\n\r0 0 0 = Comando di togliere coppia, senza la frenata controllata'}}
		else if (cursorInfo.word === 'HHEVOUPDSTATUS') 
		{return {contents: 'L’array attribuisce una word per ogni posizione del drive nei link secondoil seguente schema: HHEVOUPDSTATUS[X] = Stato aggiorn. per il drive sul Link 1 Nodo X\n\r0 = Verifica ancora da iniziare\n\r< 512 = Attesa stabilizzazione link\n\r512 = Verifica versione presente nell`az e nel sis\n\r513-514 = Verifica dello stato della flash\n\r515 = Attivazione modalità di aggiornamento\n\r516 = Cancellazione della flash\n\r517 = Verifica cancellazione della flash\n\rda 518 a 4096 Fasi scrittura della flash memory\n\r0x7FFF = Scrittura terminata, attesa della fine del reset del modulo\n\r0x8000 = Verifica fatta ma aggiornamento impossibile perché drive già inizializzato\n\r0x8200 = Verifica fatta ma aggiornamento non possibile per incompatibilità del loader\n\r0x8202 = Verifica fatta ma aggiornamento non possibile per limite di cancellazioni raggiunto\n\r0x8222 = Verifica fatta ma aggiornamento non possibile firmware non presente\n\r0xA000 = Verifica terminata, il drive era già aggiornato\n\r0xC000 = Verifica terminata e aggiornamento eseguito\n\r'}}
		else if (cursorInfo.word === 'HHSTATUS') 
			{return { contents: 'Contiene informazioni sullo stato di funzionamento degli azionamenti digitali.\n\rBit 2 1 0 : Stato macchina.\n\r0 0 0 = Azzeramento elettrico in corso o da fare\n\r0 0 1 = Funzionamento normale\n\r1 0 0 = Link ZSTAR non attivo\n\r1 1 1 = Allarme e frenata di emergenza in corso o finita.\n\rBit 3 : 1= Azionamento alimentato e abilitato\n\rBit 4 : Tipo di funzionamento 1 = Vettoriale 2 = Inverter\n\rBit 5 : 0 = Funzionamento a stella 1 = Funzionamento a triangolo\n\rBit 6 : 1 = Richiesta di coppia attivata, attesa stato di coppia\n\rBit 7 : Riservato\n\rBit 8 : 0 = Zero elettrico da fare 1 = zero elettrico completato\n\rBit 9 : 1= Zero elettrico Rotore riferito fine\n\rBit 10 : 1= Frenata di emergenza in corso\n\rBit 11 : 1= Comando di reset allarmi riconosciuto\n\rBit 12 : 1= Azionamento in condizione di PREALLARME\n\rBit 13 : 1= Azionamento in condizione di ALLARME\n\rBit 14 : 1= Azionamento PRONTO a ricevere il comando di coppia\n\rBit 15 : 1= Azionamento IN COPPIA\n\r'}}
		else if (cursorInfo.word === 'HHBRAKESTAT') 
			{return { contents: 'Stato di attivazione delle uscite dedicate ai freni motore (o di utilizzo generico).'}}
		else if (cursorInfo.word === 'HHMOTREF') 
			{return { contents: 'Contiene il riferimento comandato dal CN agli azionamenti, espresso in giri/min.'}}	
		//Funzioni	   
		else if (cursorInfo.word === 'GGAD') 
			{return { contents: 'Valore degli ingressi analogici allo Z-Link.'}}
		else if (cursorInfo.word === 'FFOVR') 
			{return { contents: 'Converte un valore percentuale per un override nel corrispondente valore per i bytes degli override 1EL, 1EH, BEL.'}}
		else if (cursorInfo.word === 'DDFLOINT') 
			{return { contents: 'Converte X da numero in virgola mobile a numero intero (da Float a Intero), se X non e’ un valore intero viene arrotondato all’intero piu’ vicino.'}}
		else if (cursorInfo.word === 'MOLDIV') 
			{return { contents: 'Ritorna il valore ottenuto facendo la moltiplicazione tra moltiplicando e moltiplicatore con precisione di 64 bit e dividendo il risultato a 64 bit per il divisore.'}}
		else if (cursorInfo.word === 'ABS') 
			{return { contents: 'Fa il valore assoluto del valore specificato.'}}	
		else if (cursorInfo.word === 'GGMES') 
			{return { contents: 'Consente di attivare i messaggi evoluti di logica.'}}	
		else if (cursorInfo.word === 'FFOUTRIFI') 
			{return { contents: 'La funzione consente di generare un riferimento, analogico o digitale, applicando un incremento.\n\rriferim = Valore del riferimento in uscita (+- 27594 max).\n\rnumout = Numero del canale di uscita su cui generare il riferimento:\n\rda 0 a 15 scrittura nell`area T dello Z-Link\n\rda 16 a 31 riferimenti analogici Z-Link\n\rda 32 a 63 scrittura da ZZLINK[160] a ZZLINK[191]\n\rda 64 a 79 scrittura nell`area S dello Z-Link\n\rda 80 a 96 scrittura da ZZLINK[208] a ZZLINK[224]\n\rda 100 a 114 numero asse ZSER (per assi da 0S a 14S)\n\rda 200 a 231 numero asse Z-STAR (per assi da 0H a 31H)\n\rda 300 a 315 numero asse Mechatrolink (per assi da 0M a 15M)\n\rincremento = Incremento del riferimento (valore assoluto sempre positivo)\n\r'}}	
		else if (cursorInfo.word === 'FFOUTVEL') 
			{return { contents: 'La funzione consente di generare un riferimento di velocità per un asse, deve essere messo nel modulo a 2ms\n\rVelocita = Valore del riferimento in uscita in mm/min.\n\rAccelerazione = valore di accelerazione in mm/s²\n\rnumlog = numero logico asse da 0 a 31\n\rnumproc = numero logico processo'}}	
		else if (cursorInfo.word === 'FFOUTVOLT') 
			{return { contents: 'La funzione consente di generare un riferimento analogico.\n\rvolt = Valore del riferimento in uscita da -11.5 a +11.5V.\n\rramp = rampa di accelerazione da applicare all uscita\n\rch = canale di uscita Z-Link da 0 a 15\n\r'}}	
		else if (cursorInfo.word === 'FFOUTRPM') 
			{return { contents: 'La funzione consente di generare un riferimento in giri/min\n\rRPM = Valore del riferimento in uscita in rpm.\n\rrampe = valore di accelerazione in mm/s²\n\rnumlog = numero logico asse\n\rch = numero logico dell azionamento ZSTAR2 da 0 a 31'}}	
		else if (cursorInfo.word === 'FFOVRA') 
			{return { contents: 'Converte un valore da 0-10V per un override nel corrispondente valore per i bytes degli override 1EL, 1EH, BEL.\n\ranalog = valore analogico tra 0-10\n\rtipo = tipo di conversione:\n\r0 = 0-120%\n\r1 = 0-150%\n\r2 = 0-100%'}}
		else if (cursorInfo.word === 'FFOUTANALOG') 
			{return { contents: 'La funzione consente di generare un riferimento analogico tra -12V e+12V.\n\rvolt = Valore del riferimento in uscita tra -32767 e +32767.\n\rch = canale di uscita Z-Link da 0 a 15\n\r'}}				
			else if (cursorInfo.word === 'WRPRM') 
			{return { contents: 'Consente di accedere in scrittura nell`array di parametri permanenti non di processo, con formato string long PRM[8192].'}}
		else if (cursorInfo.word === 'GGSK') 
			{return { contents: 'Contiene lo stato delle SOFTKEYS\n\rFormato "GGSK[MENU].TASTO"\n\rInput numerico viene messo nella variabile GGSK[2041] '}}   
		else if (cursorInfo.word === 'PRESS') 
			{return { contents: 'Simula la pressione (MDI) di tasti alfanumerici contenuti in "stringabyte" nel processo specificato.'}}   
		else if (cursorInfo.word === 'FFPRESS2') 
			{return { contents: 'Simula la pressione (MDI) di tasti alfanumerici contenuti in "stringabyte" nel processo specificato. Versione Evoluta di PRESS'}}   
		else if (cursorInfo.word === 'AXALARM') 
			{return { contents: 'Azzera il contatore hardware della scheda asse specificata e quindi mette la scheda in allarme.\n\rArgomento: 32–63 numero asee link ZSTAR.\n\rValori di ritorno:\n\r0 asse in allarme\n\r1 asse non ancora in allarme: attendere'}}   
		else if (cursorInfo.word === 'ZEROSPINDLE2') 
			{return { contents: 'Eegue la ripresa di zero del rilevatore mandrino quandola velocità di rotazione mandrino è inferiore al valore Speed*1.6'}}  
		else if (cursorInfo.word === 'FFCOUPLE') 
			{return { contents: 'Aggancia due assi in modalita gantry\n\rFFCOUPLE(nagg,nslave,pslave,nmast,pmast,qslave,qmast)\n\rnagg = numero di aggancio (da 0 a 31 oppure da 100 a 131)\n\rnslave = numero logico dell`asse slave (da 0 a 14, validi solo gli assi definiti)\n\rpslave = processo slave (da 0 a 5, validi solo i processi attivi)\n\rnmast = numero logico dell`asse master (da 0 a 14, validi solo gli assi definiti)\n\rpmast = processo master (da 0 a 5, validi solo i processi attivi)\n\rqslave e qmast = definiscono il rapporto di aggancio: se il master si sposta di qmaster lo slave si sposta di qslave.'}} 
		else if (cursorInfo.word === 'FFUNCOUPLE') 
			{return { contents: 'Sgancia due assi precedentemente agganciati in modalita gantry'}} 	
		else if (cursorInfo.word === 'GGCOUPLE') 
			{return { contents: 'Mappa degli assi agganciati con la funzione FFCOUPLE.\n\rGGCOUPLE[0] Mappa degli agganci in corso\n\rGGCOUPLE[1] Mappa degli agganci in errore perchè Slave vivo\n\rGGCOUPLE[2] Mappa degli agganci in errore di inseguimento\n\rGGCOUPLE[3] Mappa degli agganci in errore rilevatore\n\rGGCOUPLE[4] Mappa degli agganci con Slave in ripresa di zero\n\rGGCOUPLE[5] Mappa degli agganci con Master in ripresa di zero\n\rGGCOUPLE[6] Mappa degli agganci in modo offset\n\rGGCOUPLE[7] Mappa degli agganci nel modo FFCOUPLE2()\n\rGGCOUPLE[8] Numero logico e processo Slave per aggancio n.0\n\rGGCOUPLE[9] Numero logico e processo Master per aggancio n.0'}} 		
		else if (cursorInfo.word === 'FFSKCOLOR') 
			{return { contents: 'Colora tasto softkeys\n\rFFSKCOLOR(key,menu,color,processo\n\rColori: GRIGIO ROSSO VERDE GIALLO BLU MAGENTA CIANO ARANCIONE)'}} 
		else if (cursorInfo.word === 'GGLIVEPHASE') 
			{return { contents: 'Consente di monitorare una sequenza di attesa dovuta alla programmazione di FFG28 o FFG29)'}} 
		else if (cursorInfo.word === 'FFG28') 
			{return { contents: 'Consente di attivare un asse.\r\nAnalogo al funzionamento di ZZAXLIVE = 1)'}} 
		else if (cursorInfo.word === 'FFG29') 
			{return { contents: 'Consente di disattivare un asse.\r\nAnalogo al funzionamento di ZZAXLIVE = 0)'}} 
		else if (cursorInfo.word === 'CNCINJOG') 
			{return { contents: 'Variabile che indica lo stato di JOG\r\n Equivale a ZZSTATOTAS[0] = 4'}} 
		else if (cursorInfo.word === 'CNCINMDI') 
			{return { contents: 'Variabile che indica lo stato di MDI\r\n Equivale a ZZSTATOTAS[0] = 10'}} 
		else if (cursorInfo.word === 'CNCINAUTO') 
			{return { contents: 'Variabile che indica lo stato di AUTO\r\n Equivale a ZZSTATOTAS[0] = 1'}} 
		else if (cursorInfo.word === 'WRWORD') 
			{return { contents: 'Scrive il valore del secondo numero all indirizzo del primo numero'}} 		
		else if (cursorInfo.word === 'FFZEROH5R') 
			{return { contents: 'Consente di effettuare la ripresa di zero per assi con tipo di ricerca zero H5R'}} 			
		else if (cursorInfo.word === 'DDPOS') 
			{return { contents: 'Restituisce, in un valore DOUBLE, il la quota di un asse.\n\rTipo 0: Rispetto orgine Base\n\rTipo 1: Quota a video senza RTCP\n\rTipo 2: Quota a video con RTCPn\rTipo 3: Con correzzioni G117+G118+G122'}} 		
		//Variabili ZZ
		else if (cursorInfo.word === 'ZZSTATOTAS')
			{return { contents: 'Contiene informazioni sullo stato della tastiera ed in generale sull`attività in corso in Z32.'}}
		else if (cursorInfo.word === 'ZZPAL') 
			{return { contents: 'Stringa corrispondente all`array di ppg da PAL[0] a PAL[512] dedicato alla comunicazione con il plc.'}}
		else if (cursorInfo.word === 'ZZFMAX') 
			{return { contents: 'Permette di limitare la velocità degli assi in mm/min'}}
		else if (cursorInfo.word === 'ZZMDIJOGSTATUS') 
			{return { contents: 'Da interpretare come 4 bytes conteneti lo stato di MDIJOG che vengono azzerati da un ESC operativo ed al Reset.\n\rariabile di supporto alla prestazione MDIJOG'}}
		else if (cursorInfo.word === 'ZZMDIJOGMAP') 
			{return { contents: 'Contiene la mappa degli assi continui (distinti per direzione di movimento) a cui si vuole associare sottoprogrammi da eseguire automaticamente in MDI.\n\rariabile di supporto alla prestazione MDIJOG'}}
		else if (cursorInfo.word === 'ZZACMANTAR') 
			{return { contents: 'Consente di accedere alle tarature di “Rampa precisa” e “Jerk per rampa precisa” del mandrino principale ed ausiliario.\n\rZZACMANTAR[0] = Acmax mandrino principale in rpm/sec\n\rZZACMANTAR[1] = Acmax mandrino ausiliario in rpm/sec\n\rZZACMANTAR[2] = Numero di msec per raggiungere acmax per mandrino principale\n\rZZACMANTAR[3] = Numero di msec per raggiungere acmax per mandrino ausiliario\n\r'}}
		else if (cursorInfo.word === 'ZZBUFRIF') 
			{return { contents: 'Contiene i riferimenti di velocita’ da fornire agli assi (numlog da 0 a 15).'}}
		else if (cursorInfo.word === 'ZZSPEEDPROG') 
			{return { contents: 'Contiene il valore della speed programmata da part-program o da attività 12 quando il bit DED=1 o DEE=1.'}}	
		else if (cursorInfo.word === 'ZZSPINDLERPM') 
			{return { contents: 'È la velocità del mandrino, espressa in rpm, quando il bit DED=1 o DEE=1 e si comanda un moto mandrino 3E0=1.'}}	
		else if (cursorInfo.word === 'ZZSPEED') 
			{return { contents: 'Se bit 0 di ZZFLAGML è = 1 la speed visualizzata è contenuta in ZZSPEED.'}}	
		else if (cursorInfo.word === 'ZZFLAGML') 
			{return { contents: 'Contiene bits di flag di logica per attivare alcune funzionalità.'}}	
		else if (cursorInfo.word === 'ZZSPINLOAD') 
			{return { contents: 'Se bit =1 si ha che:la word 4U è divisa per 4 ela word 4E contiene numeri divisi per 4 , e viene moltiplicata per 4 dal CN prima di essere utilizzata\n\rSe bit 0 = 1 ordina allo Z32 di visualizzare la speed non in modo convenzionale ma prendendola dal contenuto della word ZZSPEED.\n\rSe bit 3 = 1 consente alle funzioni WBUFPOS( ) e WBUFTOOL( ), di aggiungere una nuova riga di descrizione dell’utensile comprensiva del commento utensile. \n\rSe bit 3 = 0 l`aggiunta della nuova riga di descrizione dell’utensile non comprende il commento.\n\rSe bit 4 = 1 consente di attivare la moltiplicazione per 4 della variabile ZZSPEED impostata plc prima di essere visualizzata, sull’interfaccia video.\n\r'}}	
		else if (cursorInfo.word === 'ZZACTOOL') 
			{return { contents: 'Fornisce il numero dell`utensile attivo, ossia lo stesso valore che la G104 di part-program restituisce in HX.'}}	
		else if (cursorInfo.word === 'ZZMDIJOGFILE') 
			{return { contents: 'Contiene il numero del file CMOS associato al bit di ZZMDIJOGMAP.'}}	
		else if (cursorInfo.word === 'ZZLIMIT') 
			{return { contents: 'Contengono i finecorsa degli assi continui del processo espressi in millesimi di micron riferiti allo Zero Rilevatore.'}}	
		else if (cursorInfo.word === 'ZZLIMITAR') 
			{return { contents: 'Contengono i finecorsa degli assi continui del processo espressi in millesimi di micron riferiti allo Zero Rilevatore impostati in TARAT'}}	
		else if (cursorInfo.word === 'ZZAXLIVE') 
			{return { contents: 'Mappa degli assi vivi in tempo reale.'}}	
		else if (cursorInfo.word === 'ZZBUFPOS') 
			{return { contents: 'Quote assi riferite allo zero rilevatore, espressi in millesimi di unità visualizzata.'}}	
		else if (cursorInfo.word === 'ZZMESFLAG') 
			{return { contents: 'Word per la gestione evoluta dei messagi.\r\nbit 0: Messagio di HOLD in corso\r\nbit 1: Messagio di STOP in corso\r\nbit 2: Messagio di ALARM in corso'}}
		else if (cursorInfo.word === 'ZZORGSUP') 
			{return { contents: 'Ogni elemento della stringa esprime, in millesimi di unità visualizzata, un offset che viene sommato all`origine supplementare contenuta nel file 126.'}}	
		else if (cursorInfo.word === 'ZZSAUXE') 
			{return { contents: 'Contiene i dati forniti dal PLC al CN per la gestione di un secondo mandrino ausiliario sullo stesso processo\n\rZZSAUXE[0].0 = 1 Mandrino Principale\n\rZZSAUXE[0].1 = 1 Mandrino Ausiliario\n\rZZSAUXE[1] = Riferimento di velocità del mandrino Principale.\n\rZZSAUXE[2] = Riferimento di velocità del mandrino Ausiliario'}}		   
		else if (cursorInfo.word === 'ZZSAUXU') 
			{return { contents: 'Contiene i dati forniti dal CN al PLC per la gestione di un secondo mandrino ausiliario sullo stesso processo.\n\rZZSAUXU[0].0 = 1 Mantiene Mandrino Principale Attivo\n\rZZSAUXU[0].1 = 1 Mantiene Mandrino Ausiliario Attivo\n\rZZSAUXU[1] = Riferimento di velocità del mandrino Principale.\n\rZZSAUXU[2] = Riferimento di velocità del mandrino Ausiliarion\n\rZZSAUXU[3] = Numero Mandrino Attivo 0=Principale 1=Ausiliario'}}	
		else if (cursorInfo.word === 'ZZTLIFEAX') 
			{return { contents: 'mapppa a bit degli assi che muovendosi provocano l aggiornamento automatico dei parametri TCT e TCM dell utensile attivo'}}
			else if (cursorInfo.word === 'ZZTLIFEFLAG') 
			{return { contents: 'Mappa a bit di impostazione e funzionamento per la prestazione TLIFE\n\rBit 1:Disabilita Aggiornamento TCT e TCM\n\rBit 1:Forza Aggiornamento TCT e TCM anche a condizioni non verificate'}}
		else if (cursorInfo.word === 'ZZTLIFER') 
			{return { contents: 'Contiene la prima causa d errore che rende impossibile l aggiornamento dei parametri TCT e TCM durante la prestazione TLIFE'}}
		else if (cursorInfo.word === 'ZZTLIFERMEM') 
			{return { contents: 'Contiene la quantita di memoria libera in CMOS per i files CMOS  quando si verifica un errore segnalatonella variabile ZZLIFER'}}
			else if (cursorInfo.word === 'ZZRTCPNUMREQ') 
		{return { contents: 'Consente di variare i numeri logici degli assi corrispondenti ai tre assi lineari di RTCP'}}
		//Variabili della memoria di Sistema	Verso il CNC   
		else if (cursorInfo.word === 'STARTCNC' || cursorInfo.word === '0E0') 
			{return { contents: 'Bit 0E0 - Richiesta si START'}}	
		else if (cursorInfo.word === 'STOPCNC' || cursorInfo.word === '0E1') 
			{return { contents: 'Bit 0E1 - Richiesta di STOP'}}	
		else if (cursorInfo.word === 'JOGPCNC' || cursorInfo.word === '0E2') 
			{return { contents: 'Bit 0E2 - Richiesta di JOG Positivo'}}	
		else if (cursorInfo.word === 'JOGNCNC' || cursorInfo.word === '0E3') 
			{return { contents: 'Bit 0E3 - Richiesta di JOG Negativo'}}	
		else if (cursorInfo.word === 'OPRCNC' || cursorInfo.word === '0E4') 
			{return { contents: 'Bit 0E4 - Richiesta di Trasferire i Comandi a Operatore'}}	
		else if (cursorInfo.word === 'BSINCNC' || cursorInfo.word === '0E5') 
			{return { contents: 'Bit 0E5 - Richiesta di Fermarsi alla fine del Blocco in Corso'}}	
		else if (cursorInfo.word === 'ETESTCNC' || cursorInfo.word === '0E6') 
			{return { contents: 'Bit 0E6 - Richiesta ciclo di Test, Ridurre il Rapido a 1/5'}}	
		else if (cursorInfo.word === 'FHOLDCNC' || cursorInfo.word === '0E7') 
			{return { contents: 'Bit 0E7 - Richiesta di FEED HOLD'}}	
		else if (cursorInfo.word === 'CONSM1CNC' || cursorInfo.word === '0E8') 
			{return { contents: 'Bit 0E8 - Abilita lo stop del Programma quando si incontra M1'}}	
		else if (cursorInfo.word === 'RESETCNC' || cursorInfo.word === '0E9') 
			{return { contents: 'Bit 0E9 - Richiesta di RESET'}}	
		else if (cursorInfo.word === 'OPZCNC' || cursorInfo.word === '0EA') 
			{return { contents: 'Bit 0EA - Richiesta di Blocco Opzionale'}}	
		else if (cursorInfo.word === 'CONGELACNC' || cursorInfo.word === '0EB') 
			{return { contents: 'Bit 0EB - Richiesta di congelare la tastira'}}	
		else if (cursorInfo.word === 'MOTOSTOPCNC' || cursorInfo.word === '0EC') 
			{return { contents: 'Bit 0EC - Richiesta di Stop in Traiettoria durante G62'}}	
		else if (cursorInfo.word === 'OVRFEED' || cursorInfo.word === '1EL') 
			{return { contents: 'Byte 1E Low - Override Feed (Non funziona sui blocchi G0)'}}	
		else if (cursorInfo.word === 'OVRSPEED' || cursorInfo.word === '1EH') 
			{return { contents: 'Byte 1E High - Override Speed Mandrino'}}	
		else if (cursorInfo.word === 'MOTOM' || cursorInfo.word === '3E0') 
			{return { contents: 'Bit 3E0 - Richista di Moto mandrino'}}	
		else if (cursorInfo.word === 'POSM' || cursorInfo.word === '3E1') 
			{return { contents: 'Bit 3E1 - Richista di Posizionamento Mandrino'}}	
		else if (cursorInfo.word === 'GAM1' || cursorInfo.word === '1EH') 
			{return { contents: 'Bit 1EH - Richista di Utilizzo Gamma Meccanica 2'}}	
		else if (cursorInfo.word === 'MX1' || cursorInfo.word === '3E4') 
			{return { contents: 'Bit 3E4 - Richista di Moto Asse Indexato nLog 14'}}	
		else if (cursorInfo.word === 'PSX1' || cursorInfo.word === '3E5') 
			{return { contents: 'Bit 3E5 - Richista di Posizionamento Asse Indexato nLog 14'}}	
		else if (cursorInfo.word === 'MX2' || cursorInfo.word === '3E6') 
			{return { contents: 'Bit 3E6 - Richista di Moto Asse Indexato nLog 13'}}	
		else if (cursorInfo.word === 'PSX2' || cursorInfo.word === '3E7') 
			{return { contents: 'Bit 3E7 - Richista di Moto Asse Indexato nLog 13'}}	
		else if (cursorInfo.word === 'SMAN' || cursorInfo.word === '4EF') 
			{return { contents: 'Bit 4EF - Invio Senso di Rotazione Mandrino 0=oraria 1=antioraria'}}	
		else if (cursorInfo.word === 'DRYRUN' || cursorInfo.word === '7E3') 
			{return { contents: 'Bit 7E3 - Obsoleta sostuita con ZZDRYRUN.'}}	
		else if (cursorInfo.word === 'FATTO' || cursorInfo.word === '7E4') 
			{return { contents: 'Bit 7E4 - Invio il Comando di proseguire dopo funzione ausiliaria (FAN)'}}	
		else if (cursorInfo.word === 'MISLOG' || cursorInfo.word === '7E7') 
			{return { contents: 'Bit 7E7 - Ferma la rotazione dei messaggi di logica'}}	
		else if (cursorInfo.word === 'MISURA' || cursorInfo.word === '7E8') 
			{return { contents: 'Bit 7E8 - Invia l`informazione di contatto durante ciclo di misura'}}	
		else if (cursorInfo.word === 'M19SI' || cursorInfo.word === '7E9') 
			{return { contents: 'Bit 7E9 - Richeide l`invio di M19 anche non decodificata'}}	
		else if (cursorInfo.word === 'SBINARIO' || cursorInfo.word === '7EA') 
			{return { contents: 'Bit 7EA - Abilita la S dalla WORD 4E in binario'}}	
		else if (cursorInfo.word === 'TASTIMIS' || cursorInfo.word === '7EC') 
			{return { contents: 'Bit 7EC - Presenza Del tastatore analogico - Ignora il valore del bit in taratura'}}	
		else if (cursorInfo.word === 'CAMMES' || cursorInfo.word === '7ED') 
			{return { contents: 'Bit 7ED - Abilita Interpolazione per Camme cilindriche'}}	
		else if (cursorInfo.word === 'MICROZER' || cursorInfo.word === '7EE') 
			{return { contents: 'Bit 7EE - Inibisce l`entrata del micro di zero'}}
		else if (cursorInfo.word === 'ESCMDI' || cursorInfo.word === '7EF') 
			{return { contents: 'Bit 7EF - Impesice l`interruzione del funzionamento MDI con ESC'}}
		else if (cursorInfo.word === 'OVRRAP' || cursorInfo.word === '7EF') 
			{return { contents: 'Bit 7EF - Override Rapido Agisce su G0 con TEST attivo'}}
		///Variabili della memoria di Sistema Dal CNC  
		else if (cursorInfo.word === 'CNCESEC' || cursorInfo.word === '0U0') 
			{return { contents: 'Bit 0U0 - Esecuzione programma in Corso'}}
		else if (cursorInfo.word === 'CNCSTR' || cursorInfo.word === '0U1') 
			{return { contents: 'Bit 0U1 - Operazione con START selezionato'}}
		else if (cursorInfo.word === 'CNCPRNT' || cursorInfo.word === '0U2') 
			{return { contents: 'Bit 0U2 - Operazione in Attesa di START'}}
		else if (cursorInfo.word === 'CNCNOALL' || cursorInfo.word === '0U3') 
			{return { contents: 'Bit 0U3 - Nessun Allarme Presente'}}	
		else if (cursorInfo.word === 'CNCRST' || cursorInfo.word === '0U4') 
			{return { contents: 'Bit 0U4 - Richiesta di RESET dal CNC'}}	
		else if (cursorInfo.word === 'FAN' || cursorInfo.word === '0U5') 
			{return { contents: 'Bit 0U5 - Nuova Funzione Ausiliaria (M, MA, MB, MC, S, T)'}}	
		else if (cursorInfo.word === 'CNCNEWM' || cursorInfo.word === '0U6') 
			{return { contents: 'Bit 0U6 - Nuova Funzione M'}}	
		else if (cursorInfo.word === 'CNCNEWMA' || cursorInfo.word === '0U7') 
			{return { contents: 'Bit 0U7 - Nuova Funzione MA'}}	
		else if (cursorInfo.word === 'CNCNEWMB' || cursorInfo.word === '0U8') 
			{return { contents: 'Bit 0U8 - Nuova Funzione MB'}}	
		else if (cursorInfo.word === 'CNCNEWMC' || cursorInfo.word === '0U9') 
			{return { contents: 'Bit 0U9 - Nuova Funzione MC'}}	
		else if (cursorInfo.word === 'NS' || cursorInfo.word === '0UA') 
			{return { contents: 'Bit 0UA - Nuova Funzione S'}}	
		else if (cursorInfo.word === 'RICBLOC' || cursorInfo.word === '0UC') 
			{return { contents: 'Bit 0UC - Ricerca Blocco in Corso'}}	
		else if (cursorInfo.word === 'CNCSEMIAUTO' || cursorInfo.word === '0UE') 
			{return { contents: 'Bit 0UE - Operazione Semiautomatica in Corso'}}	
		else if (cursorInfo.word === 'BLOC' || cursorInfo.word === '0UF') 
			{return { contents: 'Bit 0UF - Operazione Bloccata da STOP'}}	
		else if (cursorInfo.word === 'CNCG84' || cursorInfo.word === '1U0') 
			{return { contents: 'Bit 1U0 - Maschiatura in Corso'}}	
		else if (cursorInfo.word === 'CNCG61' || cursorInfo.word === '1U1') 
			{return { contents: 'Bit 1U1 - Movimento in G61'}}	
		else if (cursorInfo.word === 'CNCG62' || cursorInfo.word === '1U2') 
			{return { contents: 'Bit 1U2 - Movimento in G62'}}	
		else if (cursorInfo.word === 'CNCG63' || cursorInfo.word === '1U3') 
			{return { contents: 'Bit 1U3 - Filettatura in Corso'}}	
		else if (cursorInfo.word === 'CNCASTZ' || cursorInfo.word === '1U4') 
			{return { contents: 'Bit 1U4 - Tutti gli Assi sono Fermi'}}	
		else if (cursorInfo.word === 'CNCALAV' || cursorInfo.word === '1U5') 
			{return { contents: 'Bit 1U5 - Gli assi sono in Lavoro con G1 G2 G3'}}	
		else if (cursorInfo.word === 'CNCAJOGP' || cursorInfo.word === '1U6') 
			{return { contents: 'Bit 1U6 - Assi in JOG Positivo'}}	
		else if (cursorInfo.word === 'CNCAJOGN' || cursorInfo.word === '1U7') 
			{return { contents: 'Bit 1U7 - Assi in JOG Negativo'}}	
		else if (cursorInfo.word === 'CNCUTEST' || cursorInfo.word === '1U8') 
			{return { contents: 'Bit 1U8 - Zero o Taratura Automatico in Corso'}}	
		else if (cursorInfo.word === 'CNCDATI' || cursorInfo.word === '1U9') 
			{return { contents: 'Bit 1U9 - Programma di trasmissione datin in corso'}}	
		else if (cursorInfo.word === 'CNCDNC' || cursorInfo.word === '1UA') 
			{return { contents: 'Bit 1UA - Programma con calcolatore esterno'}}	
		else if (cursorInfo.word === 'INVMAN' || cursorInfo.word === '1UB') 
			{return { contents: 'Bit 1UB - Ritorno da maschiatura rapida'}}	
		else if (cursorInfo.word === 'CNCJOG' || cursorInfo.word === '1UC') 
			{return { contents: 'Bit 1UC - Attività di JOG in corso'}}	
		else if (cursorInfo.word === 'CNCG39' || cursorInfo.word === '1UD') 
			{return { contents: 'Bit 1UD - Sospensione del ciclo i cambio utensile'}}	
		else if (cursorInfo.word === 'CNCMOVAX0' || cursorInfo.word === '2U0') 
			{return { contents: 'Bit 2U0 - Sblocco Asse Nlog 0'}}	
		else if (cursorInfo.word === 'CNCMOVAX1' || cursorInfo.word === '2U1') 
			{return { contents: 'Bit 2U1 - Sblocco Asse Nlog 1'}}	
		else if (cursorInfo.word === 'CNCMOVAX2' || cursorInfo.word === '2U2') 
			{return { contents: 'Bit 2U2 - Sblocco Asse Nlog 2'}}	
		else if (cursorInfo.word === 'CNCMOVAX3' || cursorInfo.word === '2U3') 
			{return { contents: 'Bit 2U3 - Sblocco Asse Nlog 3'}}	
		else if (cursorInfo.word === 'CNCMOVAX4' || cursorInfo.word === '2U4') 
			{return { contents: 'Bit 2U4 - Sblocco Asse Nlog 4'}}	
		else if (cursorInfo.word === 'CNCMOVAX5' || cursorInfo.word === '2U5') 
			{return { contents: 'Bit 2U5 - Sblocco Asse Nlog 5'}}	
		else if (cursorInfo.word === 'CNCMOVAX6' || cursorInfo.word === '2U6') 
			{return { contents: 'Bit 2U6 - Sblocco Asse Nlog 6'}}	
		else if (cursorInfo.word === 'CNCMOVAX7' || cursorInfo.word === '2U7') 
			{return { contents: 'Bit 2U7 - Sblocco Asse Nlog 7'}}	
		else if (cursorInfo.word === 'CNCMOVAX15' || cursorInfo.word === '2UF') 
			{return { contents: 'Bit 2UF - Sblocco Asse Nlog 15'}}	
		else if (cursorInfo.word === 'TB' || cursorInfo.word === '3UL') 
			{return { contents: 'Bit 3UL - Posto Utensile Programmato'}}	
		else if (cursorInfo.word === 'TA' || cursorInfo.word === '3UH') 
			{return { contents: 'Bit 3UH - Posto utensile Mandrino'}}	
		else if (cursorInfo.word === 'WORD5UL' || cursorInfo.word === '5UL') 
			{return { contents: 'Bit 5UL - Codice M Programmato'}}	
		else if (cursorInfo.word === 'M5' || cursorInfo.word === '5U8') 
			{return { contents: 'Bit 5U8 - STOP Mandrino'}}	
		else if (cursorInfo.word === 'M19' || cursorInfo.word === '5U9') 
			{return { contents: 'Bit 5U9 - Posizionamento Mandrino'}}
		else if (cursorInfo.word === 'M7' || cursorInfo.word === '5UA') 
			{return { contents: 'Bit 5UA - Eroga Refrigerante 1'}}	
		else if (cursorInfo.word === 'M8' || cursorInfo.word === '5UB') 
			{return { contents: 'Bit 5UB - Eroga Refrigerante 2'}}	
		else if (cursorInfo.word === 'SPRGM' || cursorInfo.word === '5UC') 
			{return { contents: 'Bit 5UC - Sottoprogramma Speciale in Corso'}}	
		else if (cursorInfo.word === 'RMOTOM' || cursorInfo.word === '5UD') 
			{return { contents: 'Bit 5UD - Richiesta Moto Mandrino M3 o M4'}}		
		else if (cursorInfo.word === 'MMIN' || cursorInfo.word === '5UE') 
			{return { contents: 'Bit 5UE - Velocità di taglio costante in corso'}}	
		else if (cursorInfo.word === 'WORD8U' || cursorInfo.word === '8U') 
			{return { contents: 'Contiene il codice del parametro MC programmato, BCD, 4 cifre.'}}	
		else if (cursorInfo.word === 'CNCZEROAX0' || cursorInfo.word === '9U0') 
			{return { contents: 'Bit 9U0 - Zero in Corso Asse Nlog 0'}}	
		else if (cursorInfo.word === 'CNCZEROAX1' || cursorInfo.word === '9U1') 
			{return { contents: 'Bit 9U1 - Zero in Corso Asse Nlog 1'}}	
		else if (cursorInfo.word === 'CNCZEROAX2' || cursorInfo.word === '9U2') 
			{return { contents: 'Bit 9U2 - Zero in Corso Asse Nlog 2'}}	
		else if (cursorInfo.word === 'CNCZEROAX3' || cursorInfo.word === '9U3') 
			{return { contents: 'Bit 9U3 - Zero in Corso Asse Nlog 3'}}	
		else if (cursorInfo.word === 'CNCZEROAX4' || cursorInfo.word === '9U4') 
			{return { contents: 'Bit 9U4 - Zero in Corso Asse Nlog 4'}}	
		else if (cursorInfo.word === 'CNCZEROAX5' || cursorInfo.word === '9U5') 
			{return { contents: 'Bit 9U5 - Zero in Corso Asse Nlog 5'}}	
		else if (cursorInfo.word === 'CNCZEROAX6' || cursorInfo.word === '9U6') 
			{return { contents: 'Bit 9U6 - Zero in Corso Asse Nlog 6'}}	
		else if (cursorInfo.word === 'CNCZEROAX7' || cursorInfo.word === '9U7') 
			{return { contents: 'Bit 9U7 - Zero in Corso Asse Nlog 7'}}	
		else if (cursorInfo.word === 'POSMOK' || cursorInfo.word === 'EU4') 
			{return { contents: 'Bit EU1 - Mandrino in Posizione'}}	
		else if (cursorInfo.word === 'MRAMP' || cursorInfo.word === 'EU4') 
			{return { contents: 'Bit EU4 - Mandrino in Rampa'}}	
		else if (cursorInfo.word === 'MANDINMOTO' || cursorInfo.word === 'EUB') 
			{return { contents: 'Bit EUB - Mandrino in Moto'}}	
		else if (cursorInfo.word === 'MANDVELOK' || cursorInfo.word === 'EUC') 
			{return { contents: 'Bit EUC - Mandrino a velocità richiesta'}}			
		//Varibili Limiti Rilevatori
		else if (cursorInfo.word === 'FCXPOS') 
			{return { contents: 'Finecrosa Asse X Positivo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCXNEG') 
			{return { contents: 'Finecrosa Asse X Negativo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCYPOS') 
			{return { contents: 'Finecrosa Asse Y Positivo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCYNEG') 
			{return { contents: 'Finecrosa Asse Y Negativo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCZPOS') 
			{return { contents: 'Finecrosa Asse Z Positivo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCZNEG') 
			{return { contents: 'Finecrosa Asse Z Negativo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCAPOS') 
			{return { contents: 'Finecrosa Asse A Positivo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCANEG') 
			{return { contents: 'Finecrosa Asse A Negativo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCCPOS') 
			{return { contents: 'Finecrosa Asse C Positivo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCCNEG') 
			{return { contents: 'Finecrosa Asse C Negativo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCDPOS') 
			{return { contents: 'Finecrosa Asse D Positivo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCDNEG') 
			{return { contents: 'Finecrosa Asse D Negativo in millesimi di micron riferito allo zero rilevatore'}}	
		else if (cursorInfo.word === 'FCXPOSTAR') 
			{return { contents: 'Finecrosa Asse X Positivo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCXNEGTAR') 
			{return { contents: 'Finecrosa Asse X Negativo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCYPOSTAR') 
			{return { contents: 'Finecrosa Asse Y Positivo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCYNEGTAR') 
			{return { contents: 'Finecrosa Asse Y Negativo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCZPOSTAR') 
			{return { contents: 'Finecrosa Asse Z Positivo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCZNEGTAR') 
			{return { contents: 'Finecrosa Asse Z Negativo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCAPOSTAR') 
			{return { contents: 'Finecrosa Asse A Positivo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCANEGTAR') 
			{return { contents: 'Finecrosa Asse A Negativo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCCPOSTAR') 
			{return { contents: 'Finecrosa Asse C Positivo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCCNEGTAR') 
			{return { contents: 'Finecrosa Asse C Negativo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCDPOSTAR') 
			{return { contents: 'Finecrosa Asse D Positivo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'FCDNEGTAR') 
			{return { contents: 'Finecrosa Asse D Negativo in millesimi di micron riferito allo zero rilevatore impostato in taratura'}}	
		else if (cursorInfo.word === 'ASSEXVIVO') 
			{return { contents: 'Informazioni sullo stato dell`asse X vivo.'}}	
		else if (cursorInfo.word === 'ASSEYVIVO') 
			{return { contents: 'Informazioni sullo stato dell`asse Y vivo.'}}	
		else if (cursorInfo.word === 'ASSEZVIVO') 
			{return { contents: 'Informazioni sullo stato dell`asse Z vivo.'}}	
		else if (cursorInfo.word === 'ASSEAVIVO') 
			{return { contents: 'Informazioni sullo stato dell`asse A vivo.'}}	
		else if (cursorInfo.word === 'ASSECVIVO') 
			{return { contents: 'Informazioni sullo stato dell`asse C vivo.'}}	
		else if (cursorInfo.word === 'ASSEDVIVO') 
			{return { contents: 'Informazioni sullo stato dell`asse D vivo.'}}	
		else if (cursorInfo.word === 'QUOTAXRIL') 
			{return { contents: 'Quota Asse X attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'QUOTAYRIL') 
			{return { contents: 'Quota Asse Y attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'QUOTAZRIL') 
			{return { contents: 'Quota Asse Z attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'QUOTAARIL') 
			{return { contents: 'Quota Asse A attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'QUOTACRIL') 
			{return { contents: 'Quota Asse C attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'QUOTADRIL') 
			{return { contents: 'Quota Asse D attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'QUOTAURIL') 
			{return { contents: 'Quota Asse U attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'QUOTAVRIL') 
			{return { contents: 'Quota Asse V attuale riferita allo zero rilevatore'}}	
		else if (cursorInfo.word === 'HOLDMSG') 
			{return { contents: 'Messagio di HOLD in corso sul CNC'}}	
		else if (cursorInfo.word === 'STOPMSG') 
			{return { contents: 'Messagio di STOP in corso sul CNC'}}	
		else if (cursorInfo.word === 'ALARMMSG') 
			{return { contents: 'Messagio di ALARM in corso sul CNC'}}	
		else if (cursorInfo.word === 'CLOCK1S') 
			{return { contents: 'Clock di 1s - equivalente GGCLOCK.0 vedere dichirazione in UTILITY()'}}	
		else if (cursorInfo.word === 'AIMISC') 
			{return { contents: 'Ingresso Analogico Scheda Misc'}}	
		else if (cursorInfo.word === 'AIRIK') 
			{return { contents: 'Ingresso Analogico Scheda RIK'}}		
		//Variabili Mandrino Ausiliario
		else if (cursorInfo.word === 'ABILITAMNDAUS') 
			{return { contents: 'Abilita Mandrino Ausiliario 12 = Mandrino Ausiliario Attivo'}}	
		else if (cursorInfo.word === 'MAINSPINDLEKEEP') 
			{return { contents: 'Mantiene riferimento a Mandrino Principale Quando Disattivato'}}	
		else if (cursorInfo.word === 'AUSSPINDLEKEEP') 
			{return { contents: 'Mantiene riferimento a Mandrino Ausiliario Quando Disattivato'}}	
		else if (cursorInfo.word === 'MAINSPINDLEACT') 
			{return { contents: 'Il Mandrino Principale è comandato in Velocità quando non attivo'}}	
		else if (cursorInfo.word === 'AUSSPINDLEACT') 
			{return { contents: 'Il Mandrino Ausiliario è comandato in Velocità quando non attivo'}}	
		else if (cursorInfo.word === 'MAINSPINDLERPM') 
			{return { contents: 'Riferimento Comando Velocità Mandrino Principale\n\rZZSAUXE[1]'}}	
		else if (cursorInfo.word === 'MAINSPEEDREF') 
			{return { contents: 'Riferimento del CNC Velocità Mandrino Principale\n\rZZSAUXU[1]'}}	
		else if (cursorInfo.word === 'AUSSPINDLERPM') 
			{return { contents: 'Riferimento Comando Velocità Mandrino Ausiliario\n\rZZSAUXE[2]'}}	
		else if (cursorInfo.word === 'AUSSPEEDREF') 
			{return { contents: 'Riferimento del CNC Velocità Mandrino Ausiliario\n\rZZSAUXU[2]'}}	
		//Variabili modulo DEM
		else if (cursorInfo.word === 'CCSPIENAUX')
			{return { contents: 'Mappa a bit per processo di segnale per abilitazione alla coppia per il mandrino ausiliario..\n\rDopo la funzione FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPIENPRI')
			{return { contents: 'Mappa a bit per processo di segnale per abilitazione alla coppia per il mandrino principale.\n\rDopo la funzione FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPEEDERR')
			{return { contents: 'La variabile contiene il valore % utilizzato per il calcolo dell’errore di inseguimento tollerato in rpm per il mandrino attivo sul processo.\n\rPrima la funzione FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCHOLDSPI')
			{return { contents: 'La  variabile  contiene  bit  di  segnalazione  per  specifiche  condizioni  mandrino  che  l’utente  puó ulizzare per impostare un HOLD di macchina (bit 0E7).\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCZEROSEQ')
			{return { contents: 'Numero di sequenza attiva durante un ciclo di orientamento mandrino.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CC3E1')
			{return { contents: 'Mappa a bit dei processi con comando di posizionamento mandrino attivo.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CC3E0')
			{return { contents: 'Mappa a bit dei processi con comando di moto mandrino attivo.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPEED')
			{return { contents: 'Valore della speed in rpm proposta dal modulo DEM.ML.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCZEROSPEED')
			{return { contents: 'Valore della speed in rpm con cui il modulo DEM.ML esegue la ripresa di zero mandrino.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPICONFIG')
			{return { contents: 'Mappe a bit per la configurazione di specifici comportamenti del mandrino.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPIJOGS')
			{return { contents: 'Velocità di rotazione del mandrino attivo quando siamo in JOG, espressa in rpm.\n\Dopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPIJOG')
			{return { contents: 'Mappa a bit dei processi per i quali attualmente il mandrino sta ruotando in JOG.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPIJOGP')
			{return { contents: 'Mappa a bit per processo dei comandi operativi per rotazione mandrino attivo in senso orario mentre siamo in JOG\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCSPIJOGN')
			{return { contents: 'Mappa a bit per processo dei comandi operativi per rotazione mandrino attivo in senso antiorario mentre siamo in JOG\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCHHZERO')
			{return { contents: 'Mappe per numero logico degli assi per i quali non è stato eseguito lo zero elettrico del corrispettivo motore.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDIFFUNBLK')
			{return { contents: 'Mappe per numero logico degli assi per i quali è stata richiesta una  procedura di sblocco ma sono ancora in attesa del consenso esterno per poterla avviare.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDIFFBLK')
			{return { contents: 'Mappe per numero logico degli assi per i quali e’ stata richiesta una procedura di blocco ma sono ancora in attesa del consenso esterno per poterla avviare.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVDIFF')
			{return { contents: 'Mappe per numero logico degli assi con stato del drive non allineato alla richiesta di coppia.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVAXALARM')
			{return { contents: 'Mappe per numero logico di asse in allarme.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVFORCEOFF')
			{return { contents: 'Mappa a bit per numero logico dei drive richiesti OFF da plc.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVFORCEON')
			{return { contents: 'Mappa a bit per numero logico dei drive richiesti ON da plc.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVCONSBLK')
			{return { contents: 'Mappe per numero logico dei consensi esterni per avviare una procedura di blocco di un asse.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVBLK')
			{return { contents: 'Mappe per numero logico degli assi per i quali è stata richiesta una procedura di blocco asse.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVTOFFP0')
			{return { contents: 'Tempi in ms per ogni asse del Processo, della durata della procedura di blocco.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVCONSUNBLK')
			{return { contents: 'Mappe per numero logico dei consensi esterni per avviare una procedura di sblocco di un asse.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVUNBLK')
			{return { contents: 'Mappe per numero logico degli assi per i quali è stata richiesta una procedura di sblocco asse.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVBRAKE')
			{return { contents: 'Mappe per numero logico dei comandi per i freni.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVTONP0')
			{return { contents: 'Tempi in ms per ogni asse del Processo, della durata della procedura di sblocco.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCHHCONTROL')
			{return { contents: 'Proposta per la variabile HHCONTROL per il comando della coppia dei drives ZSTAR.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVRDY')
			{return { contents: 'Mappe per numero logico di drive pronto alla coppia.\n\rSolo Driver Analogici'}}
		else if (cursorInfo.word === 'CCDRVONREQ')
			{return { contents: 'Mappe per numero logico delle richieste di assi in coppia.\n\rSolo Driver Analogici'}}
		else if (cursorInfo.word === 'CCDRVON')
			{return { contents: 'Mappe per numero logico di drive in coppia.\n\rSolo Driver Analogici'}}
		else if (cursorInfo.word === 'CCDRVALARM')
			{return { contents: 'Mappe per numero logico dei drive in allarme.\n\rSolo driver Analogici'}}
		else if (cursorInfo.word === 'CCDRVCONSEXT')
			{return { contents: 'Mappe per numero logico di assi che necessitano di un consenso esterno per avviare la procedura di sblocco/blocco asse.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVSRCOFF')
			{return { contents: 'Mappe per numero logico degli assi a cui togliere coppia in ricerca blocco.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCDRVAXNO')
			{return { contents: 'Mappe per numero logico degli assi che non devono essere gestiti da questo modulo, ma sono lasciati alla libera gestione da parte del PLC utente.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCBRKVELP')
			{return { contents: 'Velocità in mm/min per ogni asse del Processo, al di sotto della quale il freno CCDRVBRAKE[nproc].nlog viene attivato durante una procedura di emergenza.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCAXCONFIG')
			{return { contents: 'Mappe a bit per la configurazione di specifici comportamenti degli assi.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCEMERGG142')
			{return { contents: 'Mappa a bit dei processi con durata eccessiva di una procedura di Retract G142.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCEMERGDRV')
			{return { contents: 'Mappa a bit per numero logico, degli assi e/o mandrino con frenata di emergenza in corso.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCEMERG')
			{return { contents: 'Mappa a bit dei processi con procedura di frenata di emergenza in corso.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCEMERGMEM')
			{return { contents: 'Mappa a bit dei processi per i quali è terminata la procedura di frenata di emergenza.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCEMERGTSPI')
			{return { contents: 'Tempo in ms, per ogni processo, della durata della frenata di emergenza per il mandrino attivo.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCEMERGTAX')
			{return { contents: 'Tempo in ms, per ogni processo, della durata della frenata di emergenza per tutti gli assi in coppia.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCEMERGSET')
			{return { contents: 'Mappa a bit dei processi sui quali avviare la procedura di frenata di emergenza, comandata da plc.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCRSTALARM')
			{return { contents: 'Quando questo bit è ad 1, viene comandato il reset degli allarmi ZSTAR per tutti i drives.\n\rDopo la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCRSTMEM')
			{return { contents: 'Riarmo della macchina quando CCEMERGMEM va a 1.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'CCAUXOK')
			{return { contents: 'Abilitazione del processo a dare coppia.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
	  	//Variabili modulo HOME
		else if (cursorInfo.word === 'PPHOME_AXORDER')
		  {return { contents: 'Ordine sequenza degli assi da azzerare, per numero logico.'}}
		else if (cursorInfo.word === 'PPHOME_MAPHOME')
		  {return { contents: 'Mappa temporanea di assi da azzerare.\n\rPrima la funzione FFAXENABLE() o FFSPIENABLE()'}}
		else if (cursorInfo.word === 'PPHOME_TIME')
		  {return { contents: 'Tempo di attesa in millisecondi alla fine di ogni azzeramento  prima di proseguire con azzeramento asse successivo'}}
		else if (cursorInfo.word === 'PPHOME_MAPPOS')
		  {return { contents: 'Mappa a bit, per numero logico, degli assi per i quali dopo l azzeramento è richiesto il posizionamento alle quote impostate in PPHOME_AXPOS[0-12]'}}
		else if (cursorInfo.word === 'PPHOME_AXPOS')
		  {return { contents: 'Quota, in unita visualizzate a cui effettuare il posizionamento assi dopo l azzeramento'}}
		else if (cursorInfo.word === 'PPHOME_GO')
		  {return { contents: 'Varibile BIT che abilita la prestazione di homing automatico'}}
		else if (cursorInfo.word === 'PPHOME_ML')
		  {return { contents: 'Bit 0 - Richiesta di mantenimento START premuto dalla procedura di homing automatico\n\rBit 1 - Informazione procedura di homing automatico in corso\n\rBit 2 - Informazione procedura di homing automatico in corso con asse in movimento\n\rBit 3 - Informazione procedura di homing automatico terminata con successo'}}
	  	//Variabili modulo CTP
		else if (cursorInfo.word === 'FFWRAX')
		  {return { contents: 'Cambio Taratura Asse Continuo FFWRAX(NumsSet,Nlog,Processo)\n\rNumSet = Numero del set di tarature, da 1 a 20 che si vuole impostare\n\rNlog = Numero logico dell asse, da 0 a 12, su cui impostare il set\n\rProcesso = Numero del processo, da 0 a 5, a cui appartiene l asse'}}
		else if (cursorInfo.word === 'FFWRSPI')
		  {return { contents: 'Cambio Taratura Mandrino FFWRSPI(NumSet,Processo)\n\rNumSet = Numero del set di tarature, da 1 a 5 che si vuole impostare\n\rProcesso = Numero del processo, da 0 a 5, a cui appartiene il mandrino'}}
		else if (cursorInfo.word === 'FFRESTAX')
		  {return { contents: 'Ripristino Taratura Asse Continuo FFRESTAX(MappaRipristino,Nlog,Processo)\n\rMappaRipristino = Mappa a bit dei parametri da ripristinare\n\rNlog = Numero logico dell asse, da 0 a 12, di cui ripristinare le tarature\n\rProcesso = Numero del processo, da 0 a 5, a cui appartiene l asse'}}
		else if (cursorInfo.word === 'FFRESTSPI')
		  {return { contents: 'Ripristino Taratura Mandrino principale FFRESTSPI(MappaRipristino,Processo)\n\rMappaRipristino = Mappa a bit dei parametri da ripristinare per il mandrino\n\rProcesso = Numero del processo, da 0 a 5, a cui appartiene il mandrino'}}
		else if (cursorInfo.word === 'CCSPISET')
			{return { contents: '[0]IPROP Guadagno proporzionale maglia di corrente ZSTAR\n\r[1]IINT Guadagno integrale maglia di corrente ZSTAR\n\r[2]VPROP Guadagno proporzionale maglia di velocità ZSTAR\n\r[3]VINT  Guadagno integrale maglia di velocità ZSTAR\n\r[4]IMAX Corrente massima al motore in mAmpere ZSTAR\n\r[5]VMAX Velocità massima dell asse in micron/minuto PROCESSO\n\r[6]VRAP  Velocità di rapido in mm/minuto PROCESSO\n\r[7]ACMAX Accelerazione masisma in mm/sec2 PROCESSO\n\r[8]KV Guadagno proporzionale in sec 1/sec PROCESSO\n\r[9]N  Jerk dell asse PROCESSO'}}
		else if (cursorInfo.word === 'CCAXSET')
		  {return { contents: '[0]IPROP Guadagno proporzionale maglia di corrente ZSTAR\n\r[1]IINT Guadagno integrale maglia di corrente ZSTAR\n\r[2]VPROP Guadagno proporzionale maglia di velocità ZSTAR\n\r[3]VINT  Guadagno integrale maglia di velocità ZSTAR\n\r[4]IMAX Corrente massima al motore in mAmpere ZSTAR\n\r[5]Rampa del mandrino in rpm/sec PROCESSO\n\r[6]Jerk per rampa precisa in msec PROCESSO\n\r[7]ACMAX Accelerazione masisma in mm/sec2 PROCESSO\n\r[8]KV Guadagno proporzionale in sec 1/sec PROCESSO\n\r[9]ZZSMAX[0]Limitazione massima Speed Gamma1 in rpm'}}
	  	//Variabili modulo AFI
		else if (cursorInfo.word === 'CCNEWM')
		  {return { contents: 'STRING WORD, contenente il codice M intercettato a 24mSec del provesso [X] '}}
		else if (cursorInfo.word === 'CCNEWMA')
		  {return { contents: 'STRING WORD, contenente il codice MA intercettato a 24mSec del provesso [X] '}}
		else if (cursorInfo.word === 'CCNEWMB')
		  {return { contents: 'STRING WORD, contenente il codice MB intercettato a 24mSec del provesso [X] '}}
		else if (cursorInfo.word === 'CCNEWMC')
		  {return { contents: 'STRING WORD, contenente il codice MC intercettato a 24mSec del provesso [X] '}}
		else if (cursorInfo.word === 'CCNEWM2')
		  {return { contents: 'STRING WORD, contenente il codice M intercettato a 2mSec del provesso [X] '}}
		else if (cursorInfo.word === 'CCNEWMA2')
		  {return { contents: 'STRING WORD, contenente il codice MA intercettato a 2mSec del provesso [X] '}}
		else if (cursorInfo.word === 'CCNEWMB2')
		  {return { contents: 'STRING WORD, contenente il codice MB intercettato a 2mSec del provesso [X] '}}
		else if (cursorInfo.word === 'CCNEWMC2')
		  {return { contents: 'STRING WORD, contenente il codice MC intercettato a 2mSec del provesso [X] '}}
		//Variabili modulo IDC
		else if (cursorInfo.word === 'CCIDCSTART')
			{return { contents: 'Variabile per avviare il check driver IDC'}}
		else if (cursorInfo.word === 'CCIDCRST')
			{return { contents: 'Reset del test del driver in corso o precedentemente effettuato'}}
		else if (cursorInfo.word === 'CCIDCOK')
			{return { contents: 'Test IDC dei driver andato a buon fine'}}
		else if (cursorInfo.word === 'CCIDCPRE')
			{return { contents: 'Segnale di precarica drive raggiunta in modulo IDC'}}
		//Variabili interpolatore secondario
		else if (cursorInfo.word === 'GGSISETVEL')
			{return { contents: 'Abilita interpolatore secondario in velocita sul canale .x'}}
		else if (cursorInfo.word === 'GGSISETPOS')
			{return { contents: 'Abilita interpolatore secondario in posizione sul canale .x'}}
		else if (cursorInfo.word === 'GGSISETINC')
			{return { contents: 'Abilita interpolatore secondario in incrementale sul canale .x'}}
		else if (cursorInfo.word === 'GGSIMOVP')
			{return { contents: 'Movimento positivo in modlaita velocita o incrementale su interpolatore secondario canale .x'}}
		else if (cursorInfo.word === 'GGSIMOVN')
			{return { contents: 'Movimento negatico in modlaita velocita o incrementale su interpolatore secondario canale .x'}}
		else if (cursorInfo.word === 'GGSIRAP')
			{return { contents: 'Mette la velocita uguale al valore del rapido su interpolatore secondario'}}
		else if (cursorInfo.word === 'GGSIOVR')
			{return { contents: 'Override durante movimenti MOVE interpolatore secondario'}}
		else if (cursorInfo.word === 'GGSIVEL')
			{return { contents: 'Valore velocita interpolatore secondario'}}
			else if (cursorInfo.word === 'GGSIPOS')
		{return { contents: 'Valore posizione intepolatore secondario modalita posizionamento'}}
		else if (cursorInfo.word === 'GGSIINC')
			{return { contents: 'Valore incremento intepolatore secondario modalita incrementale'}}

		else 
			{return {contents: ''}}
	});
  
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
