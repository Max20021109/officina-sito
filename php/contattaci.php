<?php
/**
 * Gestione dell'invio del form "Richiedi preventivo".
 *
 * Riceve i dati via POST da js/main.js (fetch), li valida, li pulisce e
 * prova a spedire una email all'officina con mail(). Risponde in JSON con
 * status HTTP corretto, cosi' il JS sa se mostrare successo o errore.
 *
 * IMPORTANTE per chi installa il sito (vedi anche README.md):
 * - Su Windows/Laragon la funzione mail() di PHP di default NON invia nulla
 *   perche' Windows non ha un sendmail locale: bisogna configurare un server
 *   SMTP reale in php.ini (sezione [mail function], sendmail_path o SMTP/
 *   smtp_port), oppure sostituire questa funzione con PHPMailer + SMTP
 *   (es. Gmail, Aruba, un provider qualsiasi). Su un hosting web vero, nella
 *   maggior parte dei casi mail() funziona gia' cosi' com'e'.
 * - Finche' l'invio email non e' configurato, il modulo salva comunque ogni
 *   richiesta in richieste.log (vedi sotto), cosi' nessuna richiesta si perde.
 */

declare(strict_types=1);

/* ---------- configurazione: da personalizzare ---------- */
const EMAIL_DESTINATARIO = 'autocar-service@libero.it';   // dove arrivano le richieste
const NOME_OFFICINA      = '[NOME OFFICINA]';
const LOG_RICHIESTE      = __DIR__ . '/richieste.log'; // registro di riserva

header('Content-Type: application/json; charset=utf-8');

function rispondi(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rispondi(405, ['ok' => false, 'errore' => 'Metodo non consentito.']);
}

/* Honeypot anti-spam: campo invisibile che un bot compila e una persona no.
   Se e' arrivato pieno, fingiamo un successo per non dare indizi al bot. */
if (!empty($_POST['sito_web'] ?? '')) {
    rispondi(200, ['ok' => true]);
}

function pulisci(string $valore): string
{
    return trim(strip_tags($valore));
}

$nome      = pulisci($_POST['nome'] ?? '');
$telefono  = pulisci($_POST['telefono'] ?? '');
$email     = pulisci($_POST['email'] ?? '');
$servizio  = pulisci($_POST['servizio'] ?? '');
$messaggio = pulisci($_POST['messaggio'] ?? '');
$privacy   = isset($_POST['privacy']);

$errori = [];
if (mb_strlen($nome) < 2) {
    $errori['nome'] = 'Inserisci nome e cognome.';
}
if (!preg_match('/^[0-9+\s().-]{6,}$/', $telefono)) {
    $errori['telefono'] = 'Numero di telefono non valido.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errori['email'] = 'Email non valida.';
}
if ($servizio === '') {
    $errori['servizio'] = 'Seleziona il tipo di servizio.';
}
if (!$privacy) {
    $errori['privacy'] = 'Devi accettare l\'informativa privacy.';
}

if ($errori) {
    rispondi(400, ['ok' => false, 'errori' => $errori]);
}

/* Registro di riserva: una riga per richiesta, cosi' nulla si perde anche
   se l'invio email fallisce o non e' ancora configurato. */
$rigaLog = sprintf(
    "[%s] %s | %s | %s | %s | %s\n",
    date('Y-m-d H:i:s'),
    $nome,
    $telefono,
    $email,
    $servizio,
    str_replace(["\r", "\n"], ' ', $messaggio)
);
@file_put_contents(LOG_RICHIESTE, $rigaLog, FILE_APPEND | LOCK_EX);

/* Email all'officina */
$oggetto = 'Richiesta preventivo dal sito: ' . $servizio;
$corpo = "Nuova richiesta dal sito di " . NOME_OFFICINA . "\n\n"
    . "Nome: {$nome}\n"
    . "Telefono: {$telefono}\n"
    . "Email: {$email}\n"
    . "Servizio: {$servizio}\n"
    . "Messaggio: " . ($messaggio !== '' ? $messaggio : '(nessuno)') . "\n";

$intestazioni = [
    'From' => 'sito@' . ($_SERVER['HTTP_HOST'] ?? 'tuodominio.it'),
    'Reply-To' => $email,
    'Content-Type' => 'text/plain; charset=UTF-8',
];
$intestazioniTesto = '';
foreach ($intestazioni as $chiave => $valore) {
    $intestazioniTesto .= "{$chiave}: {$valore}\r\n";
}

$inviata = @mail(EMAIL_DESTINATARIO, $oggetto, $corpo, $intestazioniTesto);

if ($inviata) {
    rispondi(200, ['ok' => true]);
}

/* L'email non e' partita (tipico in locale su Windows senza SMTP configurato):
   la richiesta e' comunque salvata nel log qui sopra, quindi rispondiamo con
   un errore "morbido" che il JS intercetta per proporre l'invio via email
   diretta come alternativa, invece di far perdere il contatto al cliente. */
rispondi(502, [
    'ok' => false,
    'errore' => 'Richiesta salvata ma invio email non riuscito (controlla la configurazione SMTP).',
]);
