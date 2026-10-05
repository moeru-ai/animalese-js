# Animalese

用 TypeScript 程序化复现动森风格的"动物语"（Animalese）。

思路来自[重轻的教程](https://www.bilibili.com/video/BV1Mf4y1S7Gs)：

1. 录声母、韵母这类最小的音。
2. 把录音切成单个音。
3. 随机触发这些音。
4. 把音高抬上去。
5. 把音高量化到音阶上。

教程里在 DAW 中手工做的处理，这里都放到了离线烘焙阶段。运行时只做三件事：切分文字、排好时间和旋律、改播放速率。参数按游戏录屏的测量结果校准。

研究材料（调研文档、转录、ASR 部署）保存在 `research/`，见 `research/output/README.md`。

## 用法

```ts
import { createAnimalese } from 'animalese'

const animalese = await createAnimalese({ banks: '/banks/index.json' })

// 浏览器要求先有用户操作，才能出声
button.onclick = () => animalese.say('哎呀，你来啦！', { voice: { preset: 'peppy' } })

// 只排计划，不碰音频：可以看到切分结果、哪些字被跳过、选中了哪个声库
const plan = animalese.plan('I would melt.', { voice: { preset: 'smug', baseHz: 330 } })

// 导出 WAV
const wav = await animalese.render('你好呀', { voice: { preset: 'cranky' } })
```

`voice` 可以只写一个预设，也可以在预设基础上覆盖个别字段，例如 `{ preset: 'cranky', speed: 7 }`。完整字段见 `VoiceOptions`。

`bank` 默认按 `voice.baseHz` 自动挑录音音高最接近的声库，也可以手动指定，例如 `{ bank: 'onyx' }`。

想自己组合流程时，可以直接用底层包：

```ts
import { schedule } from '@animalese/core'
import { analyze } from '@animalese/g2p'
import { BankLibrary, play } from '@animalese/web'

const tokens = analyze('今日はいい天気ですね')
const plan = schedule(tokens, { preset: 'lazy' })
const library = await BankLibrary.fromIndex('/banks/index.json')
play(new AudioContext(), await library.load('nova', ['ja']), plan)
```

在 Node 里渲染（不需要 Web Audio）：

```ts
import { readBank } from '@animalese/bake'
import { schedule } from '@animalese/core'
import { bankResolver, encodeWav, renderSchedule } from '@animalese/dsp'
import { analyze } from '@animalese/g2p'

const banks = [await readBank('banks/zh-nova')]
const samples = renderSchedule(schedule(analyze('你好'), { preset: 'peppy' }), bankResolver(banks), 44100)
const wav = encodeWav({ samples, sampleRate: 44100 })
```

## 包结构

| 包 | 内容 | 依赖 |
| --- | --- | --- |
| `animalese` | 总入口：`createAnimalese()` 把切分、调度、选声库、播放串起来，同时重新导出常用 API | core、g2p、web |
| `@animalese/core` | 类型、声线预设、语言节奏、文字和声音两个时钟（`revealTimes` / `voiceClock`）、旋律（`shapeMelody`）、`schedule()` | 无 |
| `@animalese/g2p` | 语言前端：中文用 pinyin-pro，日文用 wanakana，韩文用 es-hangul；英文按音节切分后映射到假名；还有混排路由和各语言的词表 | core |
| `@animalese/dsp` | 纯 TS 音频处理：WAV 读写、重采样、YIN 基频检测、TD-PSOLA 拉平音高、单元预处理、sprite 打包、离线混音、内存声库 | core |
| `@animalese/web` | `BankLibrary`（读取 index、按音高选声库、加载缓存）、`play()`、`render()`、`renderWav()` | core、dsp |
| `@animalese/bake` | 烘焙：OpenAI 兼容 TTS 录音（带磁盘缓存，会拒收静音）、`bakeBank()`、`readBank()`、`animalese-bake` CLI | core、dsp、g2p |

`apps/playground` 是演示站点，基于 Vite、React、React Router、Base UI 和 animal-island-ui，字体是 Chill Round M。包含三个页面：

- **说话**：输入文字，看对话框随声音逐字出现，也能导出 WAV。
- **词表**：按各语言自己的音节表展示全部单元：中文是声母 × 韵母，日文是五十音图，韩文是初声 × 中声。英文页演示音节到假名的映射。
- **原理**：逐步、可交互地讲解整条流程。离线部分直接在浏览器里跑 `dsp`，可以换内置录音，也可以录自己的声音；运行时部分实时显示两个时钟和旋律。

## 烘焙声库

```bash
pnpm install
pnpm bake --env-file ~/Git/github.com/moeru-ai/airi/packages/testing-audio/.env.local \
  --lang zh,ja,ko --voice nova,onyx
pnpm dev
```

凭据按以下顺序读取：

1. `ANIMALESE_TTS_BASE_URL`、`ANIMALESE_TTS_API_KEY`、`ANIMALESE_TTS_MODEL`
2. `TESTING_AUDIO_TTS_*`
3. `OPENAI_BASE_URL`、`OPENAI_API_KEY`

原始录音缓存在 `.cache/tts`。之后改参数重新烘焙，只会为缓存里没有的单元发请求；缓存里的静音录音会被重新录制。

| 语言 | 单元 | 载体 |
| --- | --- | --- |
| zh | 402 个无调音节 | 每个音节的载体字由 `packages/g2p/scripts/generate-zh-syllables.ts` 从 GB2312 一级字中挑选，优先单读音字，其次一声；有几个音节手动指定 |
| ja | 101 个假名拍（含拗音） | 假名本身 |
| ko | 323 个开音节（19 声母 × 17 韵母，丢弃收音） | 音节本身 |
| en | 没有独立单元，按音节映射到 ja 声库的假名 | — |

烘焙时，每个有基频的单元依次经过：

1. 切掉首尾静音。
2. 把起振前的辅音缩短到 30 ms 以内。
3. 用 TD-PSOLA 把单元内部的音高拉成一条直线，对齐到同一个参考音（声库的中位基频，取整到半音），时长和共振峰不变。
4. 截长，加淡入淡出，统一响度。
5. 所有单元打包成一个 `sprite.wav`，由 `manifest.json` 记录每个单元的位置。

## 和游戏录屏对照得出的参数

对照简中版 ACNH 录屏 `BV1pk4y1L7q5`、`BV1p94y1S76G`，以及英文版 YouTube `oMeQA38IVyo`：

- **中文**：对话框约 11–13 字/秒，声音约 8–10 音/秒，大约 0.6–0.8 的字被念出来。因此调度器让文字和声音各走各的时钟：每一拍念最新出现的字，并优先跳过轻声字（的、了、吗……）。录屏能确认"音比字少"，但区分不了游戏是刻意挑字，还是单纯跟不上。
- **英文**：对话框约 45–70 字母/秒，声音约 13–14 音/秒，大约一个音节一个音。
- **单个音**：约 70–140 ms，音高基本是平的，尾部略往下滑。
- **音高**：差别很大。暴躁型罗博约 114 Hz，Marshal（自恋）约 330 Hz，Derwin（悠闲）约 445 Hz，彼得约 400 Hz，小桃约 500 Hz。所以音高用绝对频率表示，低音角色用低音声线（onyx）烘焙的声库，而不是把高音声库放慢。
- **日文和韩文**：还没有测量，暂时沿用中文的节奏（见 `languagePacing`）。

## 已知限制

- 日文汉字还没有接词典，现在按哈希映射到一个固定的假名，所以节奏对、读音不对。
- 混排文本里，只要出现平假名，汉字就按日文读。只有汉字和片假名的日文（例如"東京タワー"）需要显式传入 `language: 'ja'`。
- 中文载体字单独朗读时，TTS 不一定读成我们想要的音。目前只靠规则挑字，没有逐个人工核对。
- 声库是未压缩的 16-bit WAV，每个声线三种语言约 9 MB。
- 切分规则是合理的近似，不是 ACNH 的原始算法（见 `research/output/acnh-speech-research.md`）。

## 开发

```bash
pnpm test:run    # vitest，覆盖所有包
pnpm typecheck   # tsc 7（src 开 isolatedDeclarations，测试单独配置）
pnpm lint        # @antfu/eslint-config；typescript-eslint 通过 @typescript/typescript6 别名运行
pnpm build       # tsdown 构建所有包
```
