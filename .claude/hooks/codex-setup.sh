#!/bin/bash
#
# Codex setup — hook SessionStart
#
# Il container remoto e' effimero: sia l'installazione npm globale sia il token
# in ~/.codex spariscono a ogni riavvio. Il login via browser e quello a codice
# dispositivo sono interattivi e non automatizzabili, quindi l'autenticazione va
# ripristinata da una credenziale conservata fra le variabili d'ambiente
# dell'environment:
#
#   CODEX_AUTH_JSON  contenuto completo di ~/.codex/auth.json (abbonamento ChatGPT)
#   OPENAI_API_KEY   alternativa per chi ha una chiave API
#
# Se mancano, la CLI viene installata comunque e la sessione prosegue senza
# autenticare. Questo script non blocca mai l'avvio: ogni percorso di errore
# produce un avviso su stderr ed exit 0.
#
# In ambiente locale esce subito senza toccare nulla.

set -uo pipefail

# In locale non tocchiamo nulla: Codex e' gestito da chi lavora sulla macchina.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

log() { printf 'session-start: %s\n' "$1" >&2; }

# --------------------------------------------------------------------------- #
# 1. CLI Codex
# --------------------------------------------------------------------------- #

if command -v codex >/dev/null 2>&1; then
  log "Codex gia' presente ($(codex --version 2>/dev/null | head -1))."
elif command -v npm >/dev/null 2>&1; then
  log "installazione di @openai/codex in corso..."
  if npm install -g @openai/codex >/dev/null 2>&1; then
    log "Codex installato ($(codex --version 2>/dev/null | head -1))."
  else
    log "installazione di Codex fallita; la sessione prosegue senza."
  fi
else
  log "npm non disponibile; Codex non installato."
fi

# --------------------------------------------------------------------------- #
# 2. Autenticazione non interattiva
# --------------------------------------------------------------------------- #

if ! command -v codex >/dev/null 2>&1; then
  exit 0
fi

if codex login status >/dev/null 2>&1; then
  log "Codex gia' autenticato."
  exit 0
fi

# --- Percorso 1: abbonamento ChatGPT ---------------------------------------- #
#
# Il login con abbonamento produce access token, refresh token e id token in
# ~/.codex/auth.json. Ripristinare il file intero preserva il refresh token, che
# e' cio' che permette a Codex di rinnovarsi da solo: salvare il solo access
# token lo perderebbe, e l'accesso morirebbe alla sua scadenza.
#
# CODEX_AUTH_JSON deve contenere il JSON completo di ~/.codex/auth.json prodotto
# da un `codex login --device-auth` andato a buon fine.

if [ -n "${CODEX_AUTH_JSON:-}" ]; then
  auth_dir="${CODEX_HOME:-$HOME/.codex}"
  mkdir -p "$auth_dir"
  umask 077
  if printenv CODEX_AUTH_JSON > "$auth_dir/auth.json.tmp" 2>/dev/null \
     && python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$auth_dir/auth.json.tmp" 2>/dev/null; then
    chmod 600 "$auth_dir/auth.json.tmp"
    mv "$auth_dir/auth.json.tmp" "$auth_dir/auth.json"
    if codex login status >/dev/null 2>&1; then
      log "sessione Codex ripristinata dall'ambiente."
    else
      log 'CODEX_AUTH_JSON ripristinata ma non accettata: probabilmente scaduta. Rifai "codex login --device-auth" e aggiorna la variabile.'
    fi
  else
    rm -f "$auth_dir/auth.json.tmp"
    log "CODEX_AUTH_JSON non e' JSON valido; ignorata."
  fi
  exit 0
fi

# --- Percorso 2: chiave API -------------------------------------------------- #
#
# Nota: `codex login --with-api-key` registra la chiave senza contattare il
# server, quindi un esito positivo significa "chiave registrata", non "chiave
# valida". La validita' emerge alla prima chiamata reale.

if [ -n "${OPENAI_API_KEY:-}" ]; then
  if printenv OPENAI_API_KEY | codex login --with-api-key >/dev/null 2>&1; then
    log "chiave API registrata; la validita' viene verificata al primo uso di Codex."
  else
    log "registrazione della chiave fallita: controlla il formato di OPENAI_API_KEY."
  fi
  exit 0
fi

log "nessuna credenziale nell'ambiente: Codex installato ma non autenticato."
log "Imposta CODEX_AUTH_JSON (abbonamento ChatGPT) oppure OPENAI_API_KEY."
exit 0
