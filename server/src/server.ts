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
import { CursorInfo} from './common/types'
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
	let patternHH = /\b(?=HH)(?!(HHALARM|HHBOARDALARM|HHBOX|HHBRAKE|HHBRAKESTAT|HHCONTROL|HHCURR|HHCURRPERC|HHDCVOLT|HHDCVOLTOFF|HHENCMV|HHENCVERR|HHENCWARN|HHENDATN|HHENDATP|HHEVOALARM|HHEVOHW|HHEVORXER|HHEVOSTATUS|HHEVOTEMP|HHEVOTXER|HHEVOUPDSTATUS|HHEVOVERSION|HHIINTDTAR|HHIINTTAR|HHEVOWARNING|HHIMAXDTAR|HHIMAXTAR|HHIMOD|HHIMODPERC|HHIPROPDTAR|HHIPROPTAR|HHIREF|HHIREFPERC|HHIREFSET|HHISD|HHKVREFSET|HHMOTENC|HHMOTORSTATUS|HHMOTREF|HHMOTVEL|HHMOTVOLT|HHNOSMOOTHREF|HHPOLEPOS|HHPOSENC|HHPOWER|HHPOWERPERC|HHPOWEVOPOS|HHSAFESTAT|HHSLIP|HHSLSACTIVATE|HHSLSACTIVSTATUS|HHSLSSTATUS|HHSOSACTIVATE|HHSOSACTIVSTATUS|HHSOSSTATUS|HHSPEEDTOL|HHSPINLOAD|HHSTATUS|HHTEMPDRI|HHTEMPMOT|HHTIMES|HHTORQUE|HHTORQUEMODE|HHTURBOFREQ|HHTURBOMAP|HHTURNUNIT|HHVERS|HHVINTDTAR|HHVINTTAR|HHVPROPDTAR|HHVPROPTAR|HHVREFSET|HHVSD|HHVSQ|HHWARNING|HHZEROSTATUS|HHZEROTYPE)\b)\w+/g;
	let patternGG = /\b(?=(GG))(?!(GGEENKMU|GGAD|GGADMAP|GGAPAGVIS|GGAPLGANTRY|GGBITBB|GGBLACKBOX|GGBUFIN|GGBUFINW|GGBUFOUT|GGCLOCK|GGCLOCKT|GGCLOCKTON|GGCNTIME|GGCOUNT|GGCOUNTCMD|GGCOUNTON|GGCOUNTOUT|GGCOUNTREF|GGCOUNTSET|GGCOUNTPLC|GGCNTIMEOFF|GGCOUPLE|GGCOUPLES|GGCOUPLE|GGDCOUPLE|GGDCOUPLES|GGDGANTRY|GGEPS|GGERLINK|GGERRWFILE|GGFIRSTCYCLE|GGFLAGANTRY|GGFLAGMLK|GGKMUOFFS|GGLANGUAGE|GGLICOP|GGMES|GGMESDE|GGMLTYPE|GGMONTH|GGNOMOD|GGNTOOL|GGNUMSERIE|GGOPSOFT|GGOUTKMU|GGOUTKMU|GGPA|GGPALMIN|GGPALMINL|GGPALMOUT|GGPALMOUTL|GGPKTLOST|GGPRMFLAG|GGPROC|GGPROCMAP|GGPUB|GGPUB|GGPUL|GGPUL|GGPUW|GGPUW|GGQUOLGANTRY|GGRS|GGSCOPESLOW|GGSEC|GGSHUTDOWN|GGSK|#GGTALX|#GGTALY|GGTALZ|#GGTALKX|#GGTALKY|#GGTALKZ|GGTERMPROC|GGTEXTERR|GGTEXTERRALL|GGTLGANTRY|GGTOOL…|GGTPLCK|GGUSTAB|GGVOLKMU|GGVOLKMU|GGWRITEVIS|GGZLINKBREAK|GGZLINKERRMAP|GGZLINKERR|GGZLINKSTAT)\b)\w+/g;
	let patternZZ = /\b(?=ZZ)(?!(ZZL|ZZOB|ZZMDIJOGFLAGS|ZZLIMITJOG|ZZR|ZZUFAST|ZZACINDEX|ZZACMANTAR|ZZACMAXCOMP|ZZACMAXTAR|ZZACSATMAP|ZZACTOOL|ZZACTOOLPOINT|ZZASNKMU|ZZAXER|ZZAXERAL|ZZAXINCH|ZZAXINDEX|ZZAXJOG|ZZAXLIVE|ZZAXLIVERES|ZZAXLOAD|ZZAXMAP|ZZAXMDIJOG|ZZAXMOVMIN|#ZZAXMOVS|#ZZAXMOVSINC|#ZZAXMOVT|ZZAXMOVTIME|ZZAXNAME|ZZAXNKMU|ZZAXNOREP|ZZAXNOZERO|ZZAXRIP|ZZAXVEL|ZZAXVELMIN|ZZAXVELTIME|ZZAXVID|ZZBLCOMPNM|ZZBUFPOS|ZZBUFRIF|ZZCENTAV|ZZCENTAV|ZZCOMPNM|ZZCOMPNMVEL|ZZCONSIN-ZZCONSOUT|ZZCORRTERM|ZZCORRTERM|ZZCORS|ZZDATITAR|ZZDATITAR|ZZDDL|ZZDDR|ZZDGANTRY|ZZDIFFPOSNM|ZZDIST|ZZDMARK|ZZDRYRUN|ZZDRYMOV|ZZDZERO|ZZERCODE|ZZERFLAG|ZZERNMK|ZZERNM|ZZERRDPEMAIL|ZZFAMTOOL|ZZFEEDRG|ZZFILTOOL|ZZFJOGN|ZZFJOGP|ZZFLAGFOR|ZZFLAGML|ZZFLAGMOD|ZZFLAGMOD|ZZFMAX|ZZFPRG|ZZFREAL|ZZFRIPS|ZZGPHASE|ZZGIDATA|ZZGANTOFFCOM|ZZGANTOFFSTAT|ZZHOLD|ZZHOLDSTAT|ZZHWINPUTNUM|ZZHWMAP|ZZHWSTEPNM|ZZKVTAR|ZZINCJOG|ZZLEFF|ZZLIMFCMDI|ZZLIMIT|ZZLIMITAR|ZZLIMOBASE|ZZLIMOBASETAR|ZZLINK|ZZMAPSIM|ZZMESALARM|ZZMESFLAG|ZZMESHOLD|ZZMESSTOP|ZZMAXVEL|ZZMAXVEL|ZZMAXVELMAP|ZZMAXVELMAP|ZZMDIJOGFILE|ZZMDIJOGMAP|ZZMDIJOGSTATUS|ZZMDIMDIFILE|ZZMOVJOGZL|ZZMSG|ZZNAXTAR|ZZNOHOMING|ZZNOPOZMAN|ZZNUMGANTRY|ZZNUMDNC|ZZOBASE|ZZOFFJOG|ZZOFJOGNORES|ZZOFSURF|ZZOFSURFVEL|ZZOFSURFHW|ZZOFSURFMAP|ZZOFSURFMAXI|ZZOFSURFMOV|ZZOFSURFZERO|ZZOPRDISABLE|ZZORG|ZZORGSUP|ZZOVEREFF|ZZPAL|ZZPIECES|ZZPIECESFLAG|ZZPIECESREF|ZZPLCFAST|ZZPLCZERO|#ZZPLR|ZZPLS|#ZZPLT|#ZZPPR|#ZZPPT|ZZPOZ|ZZPOZAUTO|ZZPROBEMAP|ZZPROGN|ZZPWMFSTAT|ZZPZL|ZZQUOGANTRY|ZZRAPIDTAR|ZZREALCOMPNM|ZZREFNUM|ZZREFF|ZZSAUXT|ZZSETZERO|ZZSMAX|ZZSMAXG|ZZSPACESYNC|ZZSPEED|ZZSPEEDPROG|ZZSPINDATA|ZZSPINDATA|ZZSPINDLEPOS|ZZSPINDLEPOSREQ|ZZSPINDLERPM|ZZSPINLOAD|ZZSPINTAR|ZZSTARTCOUNT|ZZSTATO|ZZSTATOTAS|ZZSTOPCOUNT|ZZSTOPFAST|ZZSURVAX|ZZTACT|ZZTLIFEAX|ZZTFK|ZZTLIFEFLAG|ZZTLIFER|ZZTLIFERMEM|ZZTPROG|ZZTRANSTEP|ZZUADV|ZZUFAST|ZZVALG|ZZVALSYNC|ZZVELMAXCOMP|ZZVELMAXTAR|ZZVELMICR|ZZVG|ZZVMAXHW|ZZWALL|ZZWALLON|ZZWALLSTAT|ZZZNC)\b)\w+/g;
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
		{label: 'OVRSPEED', kind: CompletionItemKind.Class, detail:'Override Speed'},
		{label: 'MOTOM', kind: CompletionItemKind.Field, detail:'Avvio Moto Mandrino'},
		{label: 'POSM', kind: CompletionItemKind.Field, detail:'Avvio Pos. Mandrino'},
		{label: 'SMAN', kind: CompletionItemKind.Field, detail:'Cambia Senso Rot. Mandrino'},
		{label: 'FATTO', kind: CompletionItemKind.Field, detail:'Continua dopo M'},
		{label: 'OVRRAP', kind: CompletionItemKind.Class, detail:'Override G0'},
		//Variabili dal CNC Zona U
		{label: 'CNCSTR', kind: CompletionItemKind.Function, detail:'START dal CNC'},
		{label: 'CNCNOALL', kind: CompletionItemKind.Function, detail:'Nessun Allarme dal CNC'},
		{label: 'CNCRST', kind: CompletionItemKind.Function, detail:'RESET dal CNC'},
		{label: 'CNCNEWM', kind: CompletionItemKind.Function, detail:'Nuova Funzione M dal CNC'},
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
		{label: 'End Module', kind: CompletionItemKind.Interface, detail:'Modulo 2ms'},
		{label: 'Function', kind: CompletionItemKind.Interface, detail:'Inzio Funzione'},
		{label: 'End Function', kind: CompletionItemKind.Interface, detail:'Fine Funzione'},
		{label: 'Include', kind: CompletionItemKind.Interface, detail:'Includi File'},
		{label: 'if', kind: CompletionItemKind.Interface, detail:'Inizio if'},
		{label: 'elseif', kind: CompletionItemKind.Interface, detail:'Funzione elsif'},
		{label: 'end if', kind: CompletionItemKind.Interface, detail:'Fine if'},
		{label: 'and', kind: CompletionItemKind.Interface, detail:'and'},
		{label: 'or', kind: CompletionItemKind.Interface, detail:'or'},
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
	   else if (cursorInfo.word === 'WRPRM') 
	   {return { contents: 'Consente di accedere in scrittura nell`array di parametri permanenti non di processo, con formato string long PRM[8192].'}}
	   //Variabili ZZ
	   else if (cursorInfo.word === 'ZZSTATOTAS') 
	   {return { contents: 'Contiene informazioni sullo stato della tastiera ed in generale sull`attività in corso in Z32.'}}
	   else if (cursorInfo.word === 'ZZPAL') 
	   {return { contents: 'Stringa corrispondente all`array di ppg da PAL[0] a PAL[512] dedicato alla comunicazione con il plc.'}}
	   else if (cursorInfo.word === 'ZZFMAX') 
	   {return { contents: 'Permette di limitare la velocità degli assi in mm/min'}}
	   else if (cursorInfo.word === 'ZZMDIJOGSTATUS') 
	   {return { contents: 'Da interpretare come 4 bytes conteneti lo stato di MDIJOG che vengono azzerati da un ESC operativo ed al Reset.'}}
	   else if (cursorInfo.word === 'ZZMDIJOGMAP') 
	   {return { contents: 'La funzione consente di generare un riferimento, analogico o digitale, applicando un incremento.\n\rriferim = Valore del riferimento in uscita (+- 27594 max).\n\rnumout = Numero del canale di uscita su cui generare il riferimento:\n\rda 0 a 15 scrittura nell`area T dello Z-Link\n\rda 16 a 31 riferimenti analogici Z-Link\n\rda 32 a 63 scrittura da ZZLINK[160] a ZZLINK[191]\n\rda 64 a 79 scrittura nell`area S dello Z-Link\n\rda 80 a 96 scrittura da ZZLINK[208] a ZZLINK[224]\n\rda 100 a 114 numero asse ZSER (per assi da 0S a 14S)\n\rda 200 a 231 numero asse Z-STAR (per assi da 0H a 31H)\n\rda 300 a 315 numero asse Mechatrolink (per assi da 0M a 15M)\n\rincremento = Incremento del riferimento (valore assoluto sempre positivo)\n\rContiene la mappa degli assi continui (distinti per direzione di movimento) a cui si vuole associare sottoprogrammi da eseguire automaticamente in MDI.'}}
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
	   //Variabili della memoria di Sistema	Verso il CNC   
	   else if (cursorInfo.word === 'STARTCNC') 
	   {return { contents: 'Bit 0E0 - Richiesta si START'}}	
	   else if (cursorInfo.word === 'STOPCNC') 
	   {return { contents: 'Bit 0E1 - Richiesta di STOP'}}	
	   else if (cursorInfo.word === 'JOGPCNC') 
	   {return { contents: 'Bit 0E2 - Richiesta di JOG Positivo'}}	
	   else if (cursorInfo.word === 'JOGNCNC') 
	   {return { contents: 'Bit 0E3 - Richiesta di JOG Negativo'}}	
	   else if (cursorInfo.word === 'OPRCNC') 
	   {return { contents: 'Bit 0E4 - Richiesta di Trasferire i Comandi a Operatore'}}	
	   else if (cursorInfo.word === 'BSINCNC') 
	   {return { contents: 'Bit 0E5 - Richiesta di Fermarsi alla fine del Blocco in Corso'}}	
	   else if (cursorInfo.word === 'ETESTCNC') 
	   {return { contents: 'Bit 0E6 - Richiesta ciclo di Test, Ridurre il Rapido a 1/5'}}	
	   else if (cursorInfo.word === 'FHOLDCNC') 
	   {return { contents: 'Bit 0E7 - Richiesta di FEED HOLD'}}	
	   else if (cursorInfo.word === 'CONSM1CNC') 
	   {return { contents: 'Bit 0E8 - Abilita lo stop del Programma quando si incontra M1'}}	
	   else if (cursorInfo.word === 'RESETCNC') 
	   {return { contents: 'Bit 0E9 - Richiesta di RESET'}}	
	   else if (cursorInfo.word === 'OPZCNC') 
	   {return { contents: 'Bit 0EA - Richiesta di Blocco Opzionale'}}	
	   else if (cursorInfo.word === 'CONGELACNC') 
	   {return { contents: 'Bit 0EB - Richiesta di congelare la tastira'}}	
	   else if (cursorInfo.word === 'MOTOSTOPCNC') 
	   {return { contents: 'Bit 0EC - Richiesta di Stop in Traiettoria durante G62'}}	
	   else if (cursorInfo.word === 'OVRFEED') 
	   {return { contents: 'Byte 1E Low - Override Feed (Non funziona sui blocchi G0)'}}	
	   else if (cursorInfo.word === 'OVRSPEED') 
	   {return { contents: 'Byte 1E High - Override Speed'}}	
	   else if (cursorInfo.word === 'MOTOM') 
	   {return { contents: 'Bit 3E0 - Richista di Moto mandrino'}}	
	   else if (cursorInfo.word === 'POSM') 
	   {return { contents: 'Bit 3E1 - Richista di Posizionamento Mandrino'}}	
	   else if (cursorInfo.word === 'GAM1') 
	   {return { contents: 'Bit 1EH - Richista di Utilizzo Gamma Meccanica 2'}}	
	   else if (cursorInfo.word === 'MX1') 
	   {return { contents: 'Bit 3E4 - Richista di Moto Asse Indexato nLog 14'}}	
	   else if (cursorInfo.word === 'PSX1') 
	   {return { contents: 'Bit 3E5 - Richista di Posizionamento Asse Indexato nLog 14'}}	
	   else if (cursorInfo.word === 'MX2') 
	   {return { contents: 'Bit 3E6 - Richista di Moto Asse Indexato nLog 13'}}	
	   else if (cursorInfo.word === 'PSX2') 
	   {return { contents: 'Bit 3E7 - Richista di Moto Asse Indexato nLog 13'}}	
	   else if (cursorInfo.word === 'SMAN') 
	   {return { contents: 'Bit 4EF - Invio Senso di Rotazione Mandrino 0=oraria 1=antioraria'}}	
	   else if (cursorInfo.word === 'DRYRUN') 
	   {return { contents: 'Bit 7E3 - Obsoleta sostuita con ZZDRYRUN.'}}	
	   else if (cursorInfo.word === 'FATTO') 
	   {return { contents: 'Bit 7E4 - Invio il Comando di proseguire dopo funzione ausiliaria (FAN)'}}	
	   else if (cursorInfo.word === 'MISLOG') 
	   {return { contents: 'Bit 7E7 - Ferma la rotazione dei messaggi di logica'}}	
	   else if (cursorInfo.word === 'MISURA') 
	   {return { contents: 'Bit 7E8 - Invia l`informazione di contatto durante ciclo di misura'}}	
	   else if (cursorInfo.word === 'M19SI') 
	   {return { contents: 'Bit 7E9 - Richeide l`invio di M19 anche non decodificata'}}	
	   else if (cursorInfo.word === 'SBINARIO') 
	   {return { contents: 'Bit 7EA - Abilita la S dalla WORD 4E in binario'}}	
	   else if (cursorInfo.word === 'TASTIMIS') 
	   {return { contents: 'Bit 7EC - Presenza Del tastatore analogico - Ignora il valore del bit in taratura'}}	
	   else if (cursorInfo.word === 'CAMMES') 
	   {return { contents: 'Bit 7ED - Abilita Interpolazione per Camme cilindriche'}}	
	   else if (cursorInfo.word === 'MICROZER') 
	   {return { contents: 'Bit 7EE - Inibisce l`entrata del micro di zero'}}
	   else if (cursorInfo.word === 'ESCMDI') 
	   {return { contents: 'Bit 7EF - Impesice l`interruzione del funzionamento MDI con ESC'}}
	   else if (cursorInfo.word === 'OVRRAP') 
	   {return { contents: 'Bit 7EF - Override Rapido Agisce su G0 con TEST attivo'}}
	   ///Variabili della memoria di Sistema Dal CNC  
	   else if (cursorInfo.word === 'CNCESEC') 
	   {return { contents: 'Bit 0U0 - Esecuzione programma in Corso'}}
	   else if (cursorInfo.word === 'CNCSTR') 
	   {return { contents: 'Bit 0U1 - Operazione con START selezionato'}}
	   else if (cursorInfo.word === 'CNCPRNT') 
	   {return { contents: 'Bit 0U2 - Operazione in Attesa di START'}}
	   else if (cursorInfo.word === 'CNCNOALL') 
	   {return { contents: 'Bit 0U3 - Nessun Allarme Presente'}}	
	   else if (cursorInfo.word === 'CNCRST') 
	   {return { contents: 'Bit 0U4 - Richiesta di RESET dal CNC'}}	
	   else if (cursorInfo.word === 'FAN') 
	   {return { contents: 'Bit 0U5 - Nuova Funzione Ausiliaria (M, MA, MB, MC, S, T)'}}	
	   else if (cursorInfo.word === 'CNCNEWM') 
	   {return { contents: 'Bit 0U6 - Nuova Funzione M'}}	
	   else if (cursorInfo.word === 'CNCNEWMA') 
	   {return { contents: 'Bit 0U7 - Nuova Funzione MA'}}	
	   else if (cursorInfo.word === 'CNCNEWMB') 
	   {return { contents: 'Bit 0U8 - Nuova Funzione MB'}}	
	   else if (cursorInfo.word === 'CNCNEWMC') 
	   {return { contents: 'Bit 0U9 - Nuova Funzione MC'}}	
	   else if (cursorInfo.word === 'NS') 
	   {return { contents: 'Bit 0UA - Nuova Funzione S'}}	
	   else if (cursorInfo.word === 'RICBLOC') 
	   {return { contents: 'Bit 0UC - Ricerca Blocco in Corso'}}	
	   else if (cursorInfo.word === 'CNCSEMIAUTO') 
	   {return { contents: 'Bit 0UE - Operazione Semiautomatica in Corso'}}	
	   else if (cursorInfo.word === 'BLOC') 
	   {return { contents: 'Bit 0UF - Operazione Bloccata da STOP'}}	
	   else if (cursorInfo.word === 'CNCG84') 
	   {return { contents: 'Bit 1U0 - Maschiatura in Corso'}}	
	   else if (cursorInfo.word === 'CNCG61') 
	   {return { contents: 'Bit 1U1 - Movimento in G61'}}	
	   else if (cursorInfo.word === 'CNCG62') 
	   {return { contents: 'Bit 1U2 - Movimento in G62'}}	
	   else if (cursorInfo.word === 'CNCG63') 
	   {return { contents: 'Bit 1U3 - Filettatura in Corso'}}	
	   else if (cursorInfo.word === 'CNCASTZ') 
	   {return { contents: 'Bit 1U4 - Tutti gli Assi sono Fermi'}}	
	   else if (cursorInfo.word === 'CNCALAV') 
	   {return { contents: 'Bit 1U5 - Gli assi sono in Lavoro con G1 G2 G3'}}	
	   else if (cursorInfo.word === 'CNCAJOGP') 
	   {return { contents: 'Bit 1U6 - Assi in JOG Positivo'}}	
	   else if (cursorInfo.word === 'CNCAJOGN') 
	   {return { contents: 'Bit 1U7 - Assi in JOG Negativo'}}	
	   else if (cursorInfo.word === 'CNCUTEST') 
	   {return { contents: 'Bit 1U8 - Zero o Taratura Automatico in Corso'}}	
	   else if (cursorInfo.word === 'CNCDATI') 
	   {return { contents: 'Bit 1U9 - Programma di trasmissione datin in corso'}}	
	   else if (cursorInfo.word === 'CNCDNC') 
	   {return { contents: 'Bit 1UA - Programma con calcolatore esterno'}}	
	   else if (cursorInfo.word === 'INVMAN') 
	   {return { contents: 'Bit 1UB - Ritorno da maschiatura rapida'}}	
	   else if (cursorInfo.word === 'CNCJOG') 
	   {return { contents: 'Bit 1UC - Attività di JOG in corso'}}	
	   else if (cursorInfo.word === 'CNCG39') 
	   {return { contents: 'Bit 1UD - Sospensione del ciclo i cambio utensile'}}	
	   else if (cursorInfo.word === 'CNCMOVAX0') 
	   {return { contents: 'Bit 2U0 - Sblocco Asse nlog 0'}}	
	   else if (cursorInfo.word === 'CNCMOVAX1') 
	   {return { contents: 'Bit 2U1 - Sblocco Asse nlog 1'}}	
	   else if (cursorInfo.word === 'CNCMOVAX2') 
	   {return { contents: 'Bit 2U2 - Sblocco Asse nlog 2'}}	
	   else if (cursorInfo.word === 'CNCMOVAX3') 
	   {return { contents: 'Bit 2U3 - Sblocco Asse nlog 3'}}	
	   else if (cursorInfo.word === 'CNCMOVAX4') 
	   {return { contents: 'Bit 2U4 - Sblocco Asse nlog 4'}}	
	   else if (cursorInfo.word === 'CNCMOVAX5') 
	   {return { contents: 'Bit 2U5 - Sblocco Asse nlog 5'}}	
	   else if (cursorInfo.word === 'CNCMOVAX6') 
	   {return { contents: 'Bit 2U6 - Sblocco Asse nlog 6'}}	
	   else if (cursorInfo.word === 'CNCMOVAX7') 
	   {return { contents: 'Bit 2U7 - Sblocco Asse nlog 7'}}	
	   else if (cursorInfo.word === 'CNCMOVAX15') 
	   {return { contents: 'Bit 2UF - Sblocco Asse nlog 15'}}	
	   else if (cursorInfo.word === 'TB') 
	   {return { contents: 'Bit 3UL - Posto Utensile Programmato'}}	
	   else if (cursorInfo.word === 'TA') 
	   {return { contents: 'Bit 3UH - Posto utensile Mandrino'}}	
	   else if (cursorInfo.word === 'WORD5UL') 
	   {return { contents: 'Bit 5UL - Codice M Programmato'}}	
	   else if (cursorInfo.word === 'M5') 
	   {return { contents: 'Bit 5U8 - STOP Mandrino'}}	
	   else if (cursorInfo.word === 'M19') 
	   {return { contents: 'Bit 5U9 - Posizionamento Mandrino'}}
	   else if (cursorInfo.word === 'M7') 
	   {return { contents: 'Bit 5UA - Eroga Refrigerante 1'}}	
	   else if (cursorInfo.word === 'M8') 
	   {return { contents: 'Bit 5UB - Eroga Refrigerante 2'}}	
	   else if (cursorInfo.word === 'SPRGM') 
	   {return { contents: 'Bit 5UC - Sottoprogramma Speciale in Corso'}}	
	   else if (cursorInfo.word === 'RMOTOM') 
	   {return { contents: 'Bit 5UD - Richiesta Moto Mandrino M3 o M4'}}		
	   else if (cursorInfo.word === 'MMIN') 
	   {return { contents: 'Bit 5UE - Velocità di taglio costante in corso'}}	
	   else if (cursorInfo.word === 'WORD8U') 
	   {return { contents: 'Word 8U - Word Assi Con Zeri in Corso'}}	
	   else if (cursorInfo.word === 'CNCZEROAX0') 
	   {return { contents: 'Bit 9U0 - Zero in Corso Asse nLog 0'}}	
	   else if (cursorInfo.word === 'CNCZEROAX1') 
	   {return { contents: 'Bit 9U1 - Zero in Corso Asse nLog 1'}}	
	   else if (cursorInfo.word === 'CNCZEROAX2') 
	   {return { contents: 'Bit 9U2 - Zero in Corso Asse nLog 2'}}	
	   else if (cursorInfo.word === 'CNCZEROAX3') 
	   {return { contents: 'Bit 9U3 - Zero in Corso Asse nLog 3'}}	
	   else if (cursorInfo.word === 'CNCZEROAX4') 
	   {return { contents: 'Bit 9U4 - Zero in Corso Asse nLog 4'}}	
	   else if (cursorInfo.word === 'CNCZEROAX5') 
	   {return { contents: 'Bit 9U5 - Zero in Corso Asse nLog 5'}}	
	   else if (cursorInfo.word === 'CNCZEROAX6') 
	   {return { contents: 'Bit 9U6 - Zero in Corso Asse nLog 6'}}	
	   else if (cursorInfo.word === 'CNCZEROAX7') 
	   {return { contents: 'Bit 9U7 - Zero in Corso Asse nLog 7'}}	
	   else if (cursorInfo.word === 'MRAMP') 
	   {return { contents: 'Bit EU4 - Mandrino in Rampa'}}	
	   else if (cursorInfo.word === 'MANDINMOTO') 
	   {return { contents: 'Bit EUB - Mandrino in Moto'}}	
	   else if (cursorInfo.word === 'MANDVELOK') 
	   {return { contents: 'Bit EUC - Mandrino a velocità richiesta'}}	
	   else 
	   {return {contents: ''}}
	});
  
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
