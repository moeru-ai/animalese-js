import i18n from 'i18next'

import { initReactI18next } from 'react-i18next'

export const supportedLocales = ['zh-CN', 'en'] as const
export type Locale = typeof supportedLocales[number]

const zh = {
  nav: { speak: '说话', live: '实时', inventory: '词表', pipeline: '原理', pages: '页面', language: '界面语言' },
  common: {
    language: '语言',
    chinesePronunciation: '中文发音',
    voiceBank: '声库',
    personality: '性格',
    scale: '音阶',
    pitch: '音高',
    textRate: '打字速度',
    maxSpeechRate: '最快语速',
    range: '音域',
    liveliness: '起伏',
    glide: '尾音滑落',
    sustain: '连贯',
    auto: '自动',
    none: '无',
    stop: '停止',
    speak: '说话！',
    listen: '听',
    start: '开始',
    unitsPerSecond: '{{value}} 音/秒',
    charsPerSecond: '{{value}} 字/秒',
    steps: '级',
    semitones: '半音',
    loading: '加载中…',
    unvoiced: '清音',
  },
  language: { zh: '中文', ja: '日本語', ko: '한국어', en: 'English' },
  preset: { normal: '普通', peppy: '元气', cranky: '暴躁', lazy: '悠闲', snooty: '成熟', jock: '运动', smug: '自恋', sisterly: '大姐头' },
  layout: { bankLoadError: '声库加载失败：' },
  token: { result: '切分结果', weak: '轻读', skipped: '跳过' },
  speak: {
    textLabel: '要说的话',
    autoLanguage: '自动',
    chineseKana: '中文：假名（像游戏）',
    chineseSyllables: '中文：拼音音节',
    exportWav: '导出 WAV',
    tuneVoice: '调声线',
    voice: '声线',
    stats: '{{total}} 个字，念出 {{voiced}} 个音 · {{duration}} s',
    missing: '声库 {{bank}} 缺少 {{languages}}，这部分会静音。',
    autoBank: '自动 → {{bank}}',
  },
  live: {
    input: '输入',
    output: '输出',
    microphone: '语音识别',
    microphoneUnsupported: '语音识别（不支持）',
    typing: '打字',
    speaker: '扬声器',
    unsupported: '这个浏览器不支持语音识别，请改用打字。',
    recognitionError: '语音识别出错：{{error}}',
    idle: '点“开始”后说话或打字',
    typingActive: '边打字边听……',
    typingIdle: '先点“开始”',
    realtimeInput: '实时输入',
    micHint: '识别出的整句才会念出来；灰色字是识别器还没确定的部分。',
    typingHint: '只念新打的字；删改前面的内容不会撤回已经念出的音。',
    knobsHint: '说话过程中拖动滑块，后面的音会立刻跟着变。',
    kana: '假名',
    pinyinSyllables: '拼音音节',
  },
  inventory: {
    descriptions: {
      zh: '402 个无调音节，按声母 × 韵母排，只在“拼音音节”模式下使用。默认的“假名”模式像游戏一样，把每个音节映射到最接近的假名，用日文声库发声。',
      ja: '101 个假名拍，按五十音图排，拗音单独成行。',
      ko: '19 个初声 × 17 个中声的开音节，收音不发。',
      en: '',
    },
    chartHint: '虚线格是清音（没有基频），点一下可以试听。',
    englishLabel: '英文',
    englishListen: '听一下',
    englishDescription: '英文没有自己的声库。游戏录屏里英文大约一个音节一个音，所以先按拼写切音节，再把每个音节映射到最接近的假名，用日文声库发声。下面每一格上面是原文，下面是用到的假名单元。',
    duration: '时长',
    recordedPitch: '录音音高',
    flattenedTo: '拉平到',
    originalPitch: '原调',
    octaveUp: '升八度',
    octaveDown: '降八度',
    unitMissing: '这个声库里没有这个单元。',
    bankLoading: '加载声库中…',
  },
  pipeline: {
    steps: { record: '录音', trim: '切静音', consonant: '缩短辅音', flatten: '拉平音高', finish: '截长与响度', analyze: '切分', clocks: '两个时钟', melody: '旋律', play: '播放' },
    stepsLabel: '步骤',
    introBefore: '这是对',
    tutorial: '重轻的动森语音教程',
    introAfter: '的程序化复现：在 DAW 里手工做的处理都移到了离线烘焙，运行时只剩切分、排时间和改播放速率。数值来自对游戏录屏的测量，切分规则是合理的近似，不是游戏的原始算法。',
    offline: '离线烘焙',
    runtime: '运行时',
    exampleText: '示例文字',
    requiredBanks: '需要的声库：{{languages}}。虚线边框的是弱读字。',
    counts: '{{total}} 个字，念出 {{voiced}} 个，跳过 {{skipped}} 个。',
    newSeed: '换一个种子',
    textSeed: '用回文字种子',
    table: { text: '字', unit: '单元', start: '开始', targetPitch: '目标音高', playbackRate: '播放速率' },
    summaries: {
      analyze: '按文字系统分段：汉字用 pinyin-pro 按上下文注音（银行 → hang），假名、谚文各自拆开，英文按音节切再映射到假名。轻声字（的、了、吗）标成弱读。',
      clocks: '对话框按打字速度出字，声音按自己的节奏念：每一拍念刚出现的那个字，跟不上的字直接跳过，弱读字优先让位。对照游戏录屏，中文约 12 字/秒对 8–10 音/秒。',
      melody: '在音阶上随机游走（越靠边越容易往回走），整句慢慢往下沉，问句最后几个音上扬，感叹句整体抬高。每个音尾部再略往下滑。种子默认来自文字，同一句话每次一样。',
      play: '每个音的播放速率 = 目标音高 ÷ 声库参考音，音高和时长一起变（磁带式）。超出时间槽的部分在下一个音之前收掉。声库按音高自动挑：低音角色用低音录音，共振峰才自然。',
    },
    bake: {
      myVoice: '我的声音',
      recording: '录音中…',
      recordOwn: '录自己的声音（1.5 秒）',
      microphoneError: '麦克风不可用：{{error}}',
      recordSummary: '把载体字发给 TTS，拿回一段完整的发音。前后有静音，音高带着原来的声调。',
      trimSummary: '按 5 ms 一帧算响度，去掉首尾比最响处低 40 dB 的部分，相当于教程里的“把声音剪断”。',
      consonantSummary: '游戏里的单元几乎全是元音。找到开始有基频的地方，前面的辅音只留一小段，免得 s、sh 这样的噪声占满 100 ms 的时间槽。',
      flattenSummary: '用 TD-PSOLA 按基频周期切片，再以固定间隔重新叠加，把整条音高曲线拉成一条直线，时长和音色不变。这就是“每个字拉成平的一声”。',
      finishSummary: '截到最长长度，加 3 ms 淡入和余弦淡出，响度统一到 −18 dBFS。所有单元拼成一个 sprite.wav，manifest.json 记下每个单元的位置。',
      cut: '切掉',
      keepConsonant: '保留辅音',
      estimatedPitch: '录音基频约 {{pitch}} Hz',
      noPitch: '清音，没有基频，跳过',
      before: '之前',
      after: '之后',
      referencePitch: '参考音',
      referenceHint: '烘焙时取整个声库的中位基频，取整到半音。',
      maximum: '最长',
      listenOctaveUp: '升八度听',
    },
  },
  charts: { melody: '旋律', waveform: '{{duration}} 毫秒的波形', timeline: '文字时钟与声音时钟', text: '文字', voice: '声音' },
} as const

type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationShape<T[Key]>
}

const en = {
  nav: { speak: 'Speak', live: 'Live', inventory: 'Inventory', pipeline: 'How it works', pages: 'Pages', language: 'Interface language' },
  common: { language: 'Language', chinesePronunciation: 'Chinese pronunciation', voiceBank: 'Voice bank', personality: 'Personality', scale: 'Scale', pitch: 'Pitch', textRate: 'Text speed', maxSpeechRate: 'Maximum speech rate', range: 'Range', liveliness: 'Liveliness', glide: 'Ending glide', sustain: 'Sustain', auto: 'Auto', none: 'none', stop: 'Stop', speak: 'Speak!', listen: 'Listen', start: 'Start', unitsPerSecond: '{{value}} units/s', charsPerSecond: '{{value}} chars/s', steps: 'steps', semitones: 'semitones', loading: 'Loading…', unvoiced: 'Unvoiced' },
  language: { zh: 'Chinese', ja: 'Japanese', ko: 'Korean', en: 'English' },
  preset: { normal: 'Normal', peppy: 'Peppy', cranky: 'Cranky', lazy: 'Lazy', snooty: 'Snooty', jock: 'Jock', smug: 'Smug', sisterly: 'Sisterly' },
  layout: { bankLoadError: 'Failed to load voice banks: ' },
  token: { result: 'Segmentation result', weak: 'weak', skipped: 'skipped' },
  speak: { textLabel: 'Text to speak', autoLanguage: 'Auto', chineseKana: 'Chinese: kana (game-like)', chineseSyllables: 'Chinese: pinyin syllables', exportWav: 'Export WAV', tuneVoice: 'Tune voice', voice: 'Voice', stats: '{{total}} characters, {{voiced}} sounds spoken · {{duration}} s', missing: 'Voice bank {{bank}} does not contain {{languages}}; this part will be silent.', autoBank: 'Auto → {{bank}}' },
  live: { input: 'Input', output: 'Output', microphone: 'Speech recognition', microphoneUnsupported: 'Speech recognition (unsupported)', typing: 'Typing', speaker: 'Speakers', unsupported: 'This browser does not support speech recognition. Use typing instead.', recognitionError: 'Speech recognition error: {{error}}', idle: 'Speak or type after selecting Start', typingActive: 'Type and listen…', typingIdle: 'Select Start first', realtimeInput: 'Live input', micHint: 'Only finalized recognition results are spoken; gray text has not been finalized yet.', typingHint: 'Only newly typed text is spoken; edits to earlier text cannot take back audio already played.', knobsHint: 'Move the sliders while it speaks to change the following sounds immediately.', kana: 'Kana', pinyinSyllables: 'Pinyin syllables' },
  inventory: {
    descriptions: { zh: '402 toneless syllables arranged by initial × final, used only in Pinyin syllables mode. The default Kana mode maps each syllable to its nearest kana and uses the Japanese bank, like the game.', ja: '101 kana morae arranged as a gojūon chart, with yōon on separate rows.', ko: 'Open syllables made from 19 initials × 17 vowels; final consonants are silent.', en: '' },
    chartHint: 'Dashed cells are unvoiced (no fundamental frequency). Select a cell to listen.',
    englishLabel: 'English',
    englishListen: 'Listen',
    englishDescription: 'English has no bank of its own. Recordings of the game use roughly one sound per English syllable, so words are split by spelling and each syllable maps to its nearest kana in the Japanese bank. Each cell below shows the source text above the kana unit it uses.',
    duration: 'Duration',
    recordedPitch: 'Recorded pitch',
    flattenedTo: 'Flattened to',
    originalPitch: 'Original',
    octaveUp: 'Octave up',
    octaveDown: 'Octave down',
    unitMissing: 'This voice bank does not contain this unit.',
    bankLoading: 'Loading voice bank…',
  },
  pipeline: {
    steps: { record: 'Record', trim: 'Trim silence', consonant: 'Shorten consonant', flatten: 'Flatten pitch', finish: 'Length & loudness', analyze: 'Segment', clocks: 'Two clocks', melody: 'Melody', play: 'Playback' },
    stepsLabel: 'Steps',
    introBefore: 'This is a programmatic version of ',
    tutorial: 'Zhongqing\'s Animalese tutorial',
    introAfter: '. Processing that was done by hand in a DAW is moved to the offline bake; runtime only segments text, schedules it, and changes playback rate. Values were measured from game recordings. The segmentation rules are a reasonable approximation, not the original game algorithm.',
    offline: 'Offline bake',
    runtime: 'Runtime',
    exampleText: 'Example text',
    requiredBanks: 'Required voice banks: {{languages}}. Dashed tokens are weak.',
    counts: '{{total}} characters, {{voiced}} spoken, {{skipped}} skipped.',
    newSeed: 'New seed',
    textSeed: 'Use text seed',
    table: { text: 'Text', unit: 'Unit', start: 'Start', targetPitch: 'Target pitch', playbackRate: 'Playback rate' },
    summaries: { analyze: 'Runs are split by script: Han characters use pinyin-pro with context, kana and Hangul are decomposed separately, and English syllables map to kana. Neutral-tone Chinese characters are marked as weak.', clocks: 'The dialogue box reveals text at typing speed while the voice has its own pace. Each beat speaks the newest visible character; anything it cannot keep up with is skipped, with weak tokens yielding first.', melody: 'Pitch walks randomly over a scale, tending back toward the center. Sentences drift down, questions rise at the end, and exclamations shift up. A text-derived seed keeps the same sentence repeatable.', play: 'Playback rate is target pitch ÷ bank reference pitch, changing pitch and duration together like tape. Sounds are cut before the next slot. The closest-pitched recording is selected automatically so formants stay natural.' },
    bake: { myVoice: 'My voice', recording: 'Recording…', recordOwn: 'Record my voice (1.5 seconds)', microphoneError: 'Microphone unavailable: {{error}}', recordSummary: 'Send a carrier to TTS and receive its complete pronunciation, including surrounding silence and the original pitch contour.', trimSummary: 'Measure loudness in 5 ms frames and remove the leading and trailing parts more than 40 dB below the peak.', consonantSummary: 'Game units are almost entirely vowels. Keep only a short lead before voicing starts so noise such as s and sh does not fill the 100 ms slot.', flattenSummary: 'TD-PSOLA slices at pitch periods and overlaps them at fixed intervals, flattening the pitch while preserving duration and timbre.', finishSummary: 'Cap the length, add a 3 ms fade-in and cosine fade-out, and normalize to −18 dBFS. Units are packed into sprite.wav and indexed by manifest.json.', cut: 'Cut', keepConsonant: 'Keep consonant', estimatedPitch: 'Estimated recording pitch: {{pitch}} Hz', noPitch: 'Unvoiced; no pitch to flatten', before: 'Before', after: 'After', referencePitch: 'Reference pitch', referenceHint: 'The bake uses the median pitch of the bank, rounded to a semitone.', maximum: 'Maximum length', listenOctaveUp: 'Listen an octave up' },
  },
  charts: { melody: 'Melody', waveform: '{{duration}} ms waveform', timeline: 'Text and voice clocks', text: 'Text', voice: 'Voice' },
} satisfies TranslationShape<typeof zh>

const stored = globalThis.localStorage?.getItem('animalese-locale')
const browser = globalThis.navigator?.language.toLowerCase()
const initial = stored === 'en' || stored === 'zh-CN' ? stored : browser?.startsWith('zh') ? 'zh-CN' : 'en'

void i18n.use(initReactI18next).init({
  resources: { 'zh-CN': { translation: zh }, 'en': { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLocale(locale: Locale): void {
  globalThis.localStorage?.setItem('animalese-locale', locale)
  document.documentElement.lang = locale
  void i18n.changeLanguage(locale)
}

document.documentElement.lang = initial

export default i18n
