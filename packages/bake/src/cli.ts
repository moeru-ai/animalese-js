#!/usr/bin/env node
import type { LanguageCode, VoicePreset } from '@animalese/core'

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

import { schedule, voicePresets } from '@animalese/core'
import { bankResolver, encodeWav, renderSchedule } from '@animalese/dsp'
import { analyze, frontends } from '@animalese/g2p'

import { bakeBank, readBank } from './bake.ts'
import { cachedRecorder, openAISpeechRecorder } from './recorder.ts'

const usage = `animalese-bake <command> [options]

Commands:
  bake        Record and preprocess voice banks through an OpenAI-compatible TTS endpoint
  say         Render text to a WAV file with baked banks
  inventory   Print the units and carrier texts of a language

bake options:
  --lang zh,ja,ko        Languages to bake (default: zh); English uses the ja bank
  --voice nova,onyx      TTS voices; one bank per language and voice (default: nova)
  --model <name>         TTS model (default: $ANIMALESE_TTS_MODEL or gpt-4o-mini-tts)
  --out <dir>            Bank directory (default: apps/playground/public/banks)
  --cache <dir>          Raw recording cache (default: .cache/tts)
  --env-file <path>      Load credentials from a dotenv file first
  --only <ids>           Comma-separated unit ids, for quick tests
  --concurrency <n>      Parallel TTS requests (default: 6)
  --max-ms <n>           Longest unit after retuning (default: 260)

say options:
  --bank <dir,...>       Bank directories (one per language used in the text)
  --text <text>          Text to speak
  --out <file>           Output WAV (default: animalese.wav)
  --preset <name>        ${Object.keys(voicePresets).join(', ')}
  --hz <pitch>           --speed <units/s>    --text-rate <chars/s>    --seed <n>

Credentials are read from ANIMALESE_TTS_BASE_URL / ANIMALESE_TTS_API_KEY,
falling back to TESTING_AUDIO_TTS_* and then OPENAI_BASE_URL / OPENAI_API_KEY.
`

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'lang': { type: 'string', default: 'zh' },
    'voice': { type: 'string', default: 'nova' },
    'model': { type: 'string' },
    'out': { type: 'string' },
    'cache': { type: 'string', default: '.cache/tts' },
    'env-file': { type: 'string' },
    'only': { type: 'string' },
    'concurrency': { type: 'string', default: '6' },
    'max-ms': { type: 'string', default: '260' },
    'bank': { type: 'string' },
    'text': { type: 'string' },
    'preset': { type: 'string', default: 'normal' },
    'hz': { type: 'string' },
    'text-rate': { type: 'string' },
    'speed': { type: 'string' },
    'seed': { type: 'string' },
    'help': { type: 'boolean', short: 'h' },
  },
})

const list = (value: string | undefined): string[] => value?.split(',').map(item => item.trim()).filter(Boolean) ?? []
const env = (...names: string[]): string | undefined => names.map(name => process.env[name]).find(Boolean)

async function bake(): Promise<void> {
  if (values['env-file'])
    process.loadEnvFile(values['env-file'])
  const baseUrl = env('ANIMALESE_TTS_BASE_URL', 'TESTING_AUDIO_TTS_API_BASE_URL', 'OPENAI_BASE_URL') ?? 'https://api.openai.com/v1/'
  const apiKey = env('ANIMALESE_TTS_API_KEY', 'TESTING_AUDIO_TTS_API_KEY', 'OPENAI_API_KEY')
  if (!apiKey)
    throw new Error('no TTS API key; set ANIMALESE_TTS_API_KEY or pass --env-file')
  const model = values.model ?? env('ANIMALESE_TTS_MODEL') ?? 'gpt-4o-mini-tts'
  const outDir = resolve(values.out ?? 'apps/playground/public/banks')

  for (const language of list(values.lang) as LanguageCode[]) {
    const frontend = frontends[language]
    if (!frontend)
      throw new Error(`unknown language ${language}`)
    if (frontend.inventory.length === 0) {
      process.stderr.write(`${language}: no units of its own (voiced with another language's bank), skipped\n`)
      continue
    }
    for (const voice of list(values.voice)) {
      const recorder = cachedRecorder(openAISpeechRecorder({ baseUrl, apiKey, model, voice }), resolve(values.cache))
      const started = Date.now()
      const manifest = await bakeBank({
        frontend,
        recorder,
        outDir,
        only: values.only ? list(values.only) : undefined,
        concurrency: Number(values.concurrency),
        prepare: { maxMs: Number(values['max-ms']) },
        onProgress: (done, total, unit) => process.stderr.write(`\r${language}-${voice} ${done}/${total} ${unit.id.padEnd(16)}`),
      })
      const voiced = Object.values(manifest.units).filter(unit => unit.f0 !== null).length
      process.stderr.write(`\r${manifest.id}: ${Object.keys(manifest.units).length} units (${voiced} voiced), reference ${manifest.referenceHz} Hz, ${((Date.now() - started) / 1000).toFixed(1)}s\n`)
    }
  }
}

async function say(): Promise<void> {
  if (!values.text)
    throw new Error('--text is required')
  const banks = await Promise.all(list(values.bank).map(directory => readBank(resolve(directory))))
  const tokens = analyze(values.text)
  const plan = schedule(tokens, {
    preset: values.preset as VoicePreset,
    ...(values.hz && { baseHz: Number(values.hz) }),
    ...(values['text-rate'] && { textRate: Number(values['text-rate']) }),
    ...(values.speed && { speed: Number(values.speed) }),
    ...(values.seed && { seed: Number(values.seed) }),
  })

  const resolveUnit = bankResolver(banks)
  const missing = new Set<string>()
  const sampleRate = 44100
  const samples = renderSchedule(plan, (unit) => {
    const source = resolveUnit(unit)
    if (!source)
      missing.add(unit)
    return source
  }, sampleRate)

  const out = resolve(values.out ?? 'animalese.wav')
  await writeFile(out, encodeWav({ samples, sampleRate }))
  if (missing.size)
    process.stderr.write(`missing units: ${[...missing].join(' ')}\n`)
  const voiced = plan.events.filter(event => event.type === 'unit').length
  const units = tokens.filter(token => token.kind === 'unit').length
  process.stderr.write(`${out}: ${plan.duration.toFixed(2)}s, ${voiced}/${units} units voiced\n`)
}

function inventory(): void {
  for (const language of list(values.lang) as LanguageCode[]) {
    const units = frontends[language].inventory
    console.log(`${language}: ${units.length} units`)
    console.log(units.map(unit => `${unit.id}=${unit.carrier}`).join('  '))
  }
}

const commands: Record<string, () => void | Promise<void>> = { bake, say, inventory }
const command = commands[positionals[0] ?? '']
if (!command || values.help) {
  process.stdout.write(usage)
  process.exit(command || values.help ? 0 : 1)
}
await command()
