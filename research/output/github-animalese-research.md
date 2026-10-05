# GitHub 源码研究：Animal Crossing 风格语音如何生成

研究日期：2026-10-06  
方法：通过 `gh` 搜索仓库与代码，随后固定到具体 commit 阅读源码。本文把证据分成三类：

- **原作实现证据**：GameCube 版的匹配式反编译源码；它很强，但仍不是任天堂官方文档，也不能自动代表《集合啦！动物森友会》（ACNH）。
- **复刻/实验实现**：开源作者自己的算法，只能说明“这种办法能做出相似听感”，不能反推原作一定如此。
- **推断/建议**：由上述源码归纳出的工程方案，明确不当作原作事实。

## 结论先行

1. **GameCube 版不是简单的“每个字母播放一个声音”**。反编译源码里存在：字符到 voice code 的映射、短/长元音表、二/三字符连接规则、两条交替声部、角色音域、问号升调、感叹号增益，以及按情绪改变音高/音量的状态机。
2. **但源码中“设计出来的语言规则”和游戏运行时真正走到的路径可能不同**。一个独立复刻项目对 PC port 做 runtime trace 后报告：一次实测对话 598 次调用中 589 次没有右侧 lookahead，约 600 字符只触发一个整词样本；因此大部分实际听感接近“单字符样本 + 角色音高/韵律”，复杂英语规则很少触发。这是作者可复现的观测，不是任天堂官方结论。
3. **中文必须先做一层语言前端**。现有中文项目普遍走“汉字 → 拼音 → 声母/韵母或 CV 单元 → 短音频/合成器 → 时序、音高与停顿”的管线。`ChineseGibberish` 的 GitHub 源仓库就是这一类；它还会对长句做压缩和声/韵母交替。
4. **“多数语言”并不存在一个通用字符表**。更稳健的抽象是：语言特定 G2P/分词器 → 小型音素或音节库存 → 统一的角色声线/韵律引擎。英语、日语、韩语、中文需要不同的分析器；后半段采样、音高、停顿和角色参数可以共用。
5. **ACNH 素材不能因为出现在 GitHub 就视为可用素材**。找到的 ACNH 项目明确写着音频由游戏中提取，且没有许可证；它只可作为社区做法的旁证，不适合再分发。

## 一、原作证据：GameCube 版的实际结构

### 1. 文本层先把显示字符映射成内部 voice code

`ACreTeam/ac-decomp` 在 `mMsg_sound_voice_get()` 中保存一张 `voice_array`，文本字节直接索引到内部 voice code；换行被单独映射成 `0x84`，控制码返回 `-1`。这说明语音事件与文字逐字显示紧密耦合，而不是先离线合成完整句子。

来源：[字符映射与特殊码（ACreTeam/ac-decomp，commit `09ca8e8`）](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/game/m_msg_sound.c_inc#L1-L50)

消息层还保留了 `voice_idx / voice2_idx / voice3_idx`。当已有 voice entry 时，它会读取下一文本字符作为第三个 code；随后绘字代码把这三个 code 传到 `sAdo_VoiceSe()`。也就是说，源码中确实有“一到三个字符、带右侧上下文”的入口，而不是只有单字符接口。

来源：[voice entry 的组装逻辑](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/game/m_msg_sound.c_inc#L85-L118)、[绘字时传递三个 voice code](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/game/m_msg_draw_font.c_inc#L83-L108)、[最终调用音频层](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/game/m_font_main.c_inc#L951-L970)

### 2. 音频层包含英语式规则，但是否触发取决于消息层提供的上下文

音频层至少有三组明显的语言规则：

- `Sou_TanboinHenkan()`：单字符/短元音到样本槽的映射；数字也有各自槽位。
- `Sou_ChouboinHenkan()`：长元音版本。
- `Sou_ConnectCheck()`：二字符（以及少数三字符）连接规则，用于 `ch/sh/th/ng/oo/...` 和一些整词/音节组合。

来源：[短元音映射](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2146-L2229)、[长元音映射](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2231-L2314)、[连接规则入口](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2316-L2390)

`Na_VoiceSe()` 会先尝试连接规则，再根据上下文选择长/短元音，并把第二个单元放进延迟队列；若下一帧没有新字符，`Sou_SpecialRoutine10()` 才冲刷该队列。这是一个流式、小单元、与帧同步的合成器，而不是传统的整句 TTS。

来源：[上下文、长短元音和延迟第二单元](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2598-L2703)、[idle frame 冲刷](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L1708-L1715)

### 3. “角色感”主要来自采样库选择、双声部、音高/音量和情绪曲线

连续音节在两个 voice subtrack 之间交替，允许相邻短音重叠；不同 `spec` 设置不同基础音高与音量。问号把正在响的两条声部升调，感叹号提升音量；消息情绪状态再用随机周期改变两条声部的 frequency/volume scale。音频参数每帧写入 subtrack，因此标点和情绪可以弯曲已经开始播放的短音。

来源：[双 subtrack 与角色基础参数](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2752-L2808)、[问号升调、感叹号增益](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2825-L2865)、[情绪调制](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2877-L2991)、[每帧写入音量/频率](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L1174-L1181)

### 4. Animalese 与“点击/Beebese”是两条不同路径

同一函数的 mode 分支表明：Animalese 模式进入样本/音节逻辑；内部注释称作 `bebese` 的 click 模式，则对非空格/非换行事件触发固定 `NA_SE_BEBE`。因此“哔哔声”不能和完整 Animalese 的小音节采样混为一谈。

来源：[mode 选择与 Bebe 声](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L2735-L2750)、[click mode 的逐事件触发](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/src/static/jaudio_NES/game/game64.c_inc#L3013-L3025)

### 5. 重要反证：复杂规则在一次 runtime trace 中几乎没有被用到

`kidGodzilla/animalese` 把上述引擎抽成独立 C99 库，并提供 PC port tracing patch、trace replay 和 diff 工具。作者报告：一次捕获中 598 次 `Na_VoiceSe` 调用有 589 次 `b == 0xFF`；约 600 个字符只触发一次整词样本；其 replay 对捕获输入复现了 491/491 subtrack assignments 和 489/491 syllables。

这是目前 GitHub 上最有价值的“源码 + 运行观测”组合，但结论仍应表述为**该作者对该版本/该对话的实测**，不能无条件外推到所有地区版或 ACNH。

来源：[trace 结论与复现工具说明（commit `5a4b02b`）](https://github.com/kidGodzilla/animalese/blob/5a4b02b779cb85042e537bc3ce70ef403481e798/README.md#L19-L34)、[原始规则、双 subtrack 与连续参数说明](https://github.com/kidGodzilla/animalese/blob/5a4b02b779cb85042e537bc3ce70ef403481e798/README.md#L112-L129)

## 二、中文：GitHub 上能看到的两种路线

### 路线 A：汉字转拼音，再播放声母/韵母样本（`ChineseGibberish`）

本地的 ChineseGibberish 副本 与 GitHub 上的 `Xinqwq/Animalese_Converter` 共享同一套核心文件、拼音表和播放架构；逐文件比较表明 GitHub 版加入了压缩发音、输入过滤和构建兼容性改动，因此它应视为公开的扩展版本，而不是本地目录的逐字镜像。其核心流程是：

1. `PreProcess()` 把句读替换成 `_` 停顿标记，并保留非 ASCII 字符。
2. `MakePinYin()` 用 GB2312/CP936 表查出拼音；字典项已经拆成诸如 `b a`、`zh ang` 的小单元。
3. `PronounceCore` 只需约 49 个声母、韵母和停顿 clip；播放时逐单元查表、裁剪并串接。
4. 新增的“压缩发音”对不超过 6 个汉字采用声母/韵母交替；更长内容只保留前 6 个和最后 1 个字，再做交替。这是为了形成短促、非完整朗读的 Animalese 风格，不是语言学上的标准中文合成。

来源：[项目对管线的自述（commit `25525a1`）](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/README.md#L5-L22)、[拼音小单元表](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/Assets/ChineseGibberish/Scripts/PinYinSpell.cs#L21-L66)、[GB2312 查表转换](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/Assets/ChineseGibberish/Scripts/PinYinSpell.cs#L218-L234)、[49 个 clip 单元](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/Assets/ChineseGibberish/Scripts/PronounceCore.cs#L76-L109)、[压缩规则](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/Assets/ChineseGibberish/Scripts/PronounceCore.cs#L399-L453)、[顺序播放与停顿](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/Assets/ChineseGibberish/Scripts/PronounceCore.cs#L456-L493)

它的局限很明确：表驱动汉字转拼音没有上下文消歧，源码也没有声调轮廓或变调处理；GB2312 不可用时直接返回原文，随后找不到 clip。因而“行/重/长”等多音字、轻声、三声变调、儿化都不能指望正确。

### 路线 B：中文近似音素化，再用纯程序 formant 合成

`vguria/procedural-animalese` 不依赖录音，而是把语音拆成 CV(C) token，使用 saw/sine + noise 激励、多组 band-pass formant、ADSR、pitch jitter、vibrato、问句升调和陈述句降调来合成。

它的中文前端会去掉拼音声调，把 `zh/ch/sh/q/c/ng` 做粗略替换，仅对少量常用汉字写死拼音；未知 CJK 字符按 Unicode code point 取模，映射成 20 个任意音节。因此它是“生成拟声”的好例子，却不是准确中文 G2P。

来源：[中文归一化、常用字表和未知字 hash fallback（commit `7b34747`）](https://github.com/vguria/procedural-animalese/blob/7b3474775c15cc27007788a58fd4e170ee2e1505/addons/procedural_animalese/runtime/chinese_processor.gd#L13-L145)、[中文 CV(C) tokenization](https://github.com/vguria/procedural-animalese/blob/7b3474775c15cc27007788a58fd4e170ee2e1505/addons/procedural_animalese/runtime/chinese_processor.gd#L147-L205)、[token→formant 合成与 pitch jitter](https://github.com/vguria/procedural-animalese/blob/7b3474775c15cc27007788a58fd4e170ee2e1505/addons/procedural_animalese/runtime/procedural_animalese.gd#L1013-L1096)、[声线与韵律参数](https://github.com/vguria/procedural-animalese/blob/7b3474775c15cc27007788a58fd4e170ee2e1505/addons/procedural_animalese/runtime/animalese_voice.gd#L9-L68)

## 三、其他语言复刻给出的共通抽象

`izure1/animalese-tts` 把系统明确拆成 `TextAnalyzer → Sampler → AudioEffect → Player`：

- 英语 analyzer 识别 `sh/ch/th/...` 等 digraph，并把辅音到元音、连续元音或双写辅音分组。
- 日语 analyzer 用假名/拗音字典映射到 romaji-like 小单元。
- 韩语 analyzer 按 Unicode 公式拆成初声、中声、终声。
- sampler 从一条 audio sprite 按显式时间表或静音自动切片。
- engine 对可合并 token 叠加 buffer，逐单元加 pitch/melody/randomness，并为标点和空格插入静音。

来源：[总体架构与语言列表（commit `befec7b`）](https://github.com/izure1/animalese-tts/blob/befec7bb8545a7ecc2b72164cf9d04b6359a5f3f/readme.md#L6-L19)、[英语分组规则](https://github.com/izure1/animalese-tts/blob/befec7bb8545a7ecc2b72164cf9d04b6359a5f3f/src/analyzers/EnglishAnalyzer.ts#L3-L79)、[日语字典](https://github.com/izure1/animalese-tts/blob/befec7bb8545a7ecc2b72164cf9d04b6359a5f3f/src/analyzers/JapaneseAnalyzer.ts#L4-L66)、[韩语 Unicode 分解](https://github.com/izure1/animalese-tts/blob/befec7bb8545a7ecc2b72164cf9d04b6359a5f3f/src/analyzers/KoreanAnalyzer.ts#L4-L37)、[静音切片 sampler](https://github.com/izure1/animalese-tts/blob/befec7bb8545a7ecc2b72164cf9d04b6359a5f3f/src/core/BaseSampler.ts#L121-L200)、[pitch/melody/randomness](https://github.com/izure1/animalese-tts/blob/befec7bb8545a7ecc2b72164cf9d04b6359a5f3f/src/effects/PitchManager.ts#L21-L38)、[合并、停顿与逐单元输出](https://github.com/izure1/animalese-tts/blob/befec7bb8545a7ecc2b72164cf9d04b6359a5f3f/src/core/TTSSpeaker.ts#L24-L130)

更简单的韩语复刻 `PyAnimalese` 只取每个韩文字的初声，播放预录的“辅音 + 模糊元音”clip，再随机升高 pitch。这说明做出“像”的最低门槛甚至不需要完整音素序列；但可懂度会明显低于完整 G2P。

来源：[项目原理自述（commit `01c2145`）](https://github.com/hwi-middle/PyAnimalese/blob/01c214590895899c6a78780408c8d75f7ec82934/README.md#L14-L19)、[初声选择、随机 pitch 与串接](https://github.com/hwi-middle/PyAnimalese/blob/01c214590895899c6a78780408c8d75f7ec82934/pyanimalese_cli.py#L6-L41)

经典 `Acedio/animalese.js` 则是最小的拉丁字母版本：一条 WAV 中每个字母占 150 ms，输出只取 75 ms，并通过改变取样步长改变 pitch；可选 `shorten` 会把每个词压缩为首尾字母。这是“字母采样拼接”路线的清晰基线。

来源：[固定字母切片、缩词与 pitch resampling（commit `6f18a90`）](https://github.com/Acedio/animalese.js/blob/6f18a909df12cdddab59438640ac8019b78fac2f/animalese.js#L5-L52)

## 四、对中文/多语言实现的建议（推断，不是原作事实）

建议使用以下可替换管线：

```text
Unicode 文本
  → 语言检测/显式 locale
  → 语言专用 normalization + G2P
  → 可控压缩（保留句首、关键词、句尾；不要直接按 Unicode hash）
  → 统一 token（音素、声母/韵母、mora 或 CV）
  → 小型自录/合成音色库
  → 双声部短音重叠 + 每 token pitch jitter
  → 句调/标点/情绪曲线 + 与打字机动画同步
```

中文前端至少应处理分词、多音字消歧、`ü`、轻声、儿化和基本变调。声调不宜完全删除；为了保留“动物语”而非普通 TTS，可以把完整声调压缩为很浅的 F0 contour，再叠加角色的基础音域与随机抖动。声线身份应来自“同一套 token 录音/同一合成器参数 + pitch/formant/envelope”，不要为每个角色复制一套语言逻辑。

如果目标是“像游戏但可安全发布”，最稳妥的资产策略是：自录音素/音节、使用有明确商用许可的 CC 素材并保留署名，或完全使用 formant/procedural 合成；不要从游戏文件抽取 WAV。

## 五、许可证与素材风险

| 项目 | 代码许可 | 音频/来源判断 | 使用建议 |
|---|---|---|---|
| `ACreTeam/ac-decomp` | CC0 | 匹配式反编译；CC0 只表达贡献者对其权利的处理，不能替任天堂放弃原游戏版权 | 用作研究证据；商用前单独法务评估 |
| `kidGodzilla/animalese` | CC0 | 仓库内替代 bank 来自 Acedio 的 CC BY 4.0；原 Nintendo bank 不随仓库分发 | 代码与替代 bank 分开管理；分发 bank 时署名 |
| `Acedio/animalese.js` | 代码 MIT | `animalese.wav` 明确 CC BY 4.0 | 可用，但音频衍生物须保留署名 |
| `Xinqwq/Animalese_Converter` | 仓库 MIT | README 说明改编自知乎工程；仓库未给 `PinYinAudio` 单独来源/授权链 | 代码可研究；音频在来源核清前不要再分发 |
| `izure1/animalese-tts` | MIT | 仓库带 audio sprites，但 README/许可证未单列样本来源 | 代码可用；样本需另行核验 |
| `PyAnimalese` | MIT | 内含 `.padata` 录音，未找到单独素材来源说明 | 同上 |
| `vguria/procedural-animalese` | MIT | 程序 formant 合成，不需要录音 bank | 在这些候选里素材风险最低 |
| `IronBit-0/AnimaleseSynthesis` | 未找到许可证 | README 明说 WAV 从 ACNH 提取并由他人协助导出 | 不复用、不再分发，仅作为社区做法旁证 |

许可证来源：[ACreTeam CC0](https://github.com/ACreTeam/ac-decomp/blob/09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c/LICENSE)、[kidGodzilla 对代码、替代 bank 与 Nintendo 素材边界的说明](https://github.com/kidGodzilla/animalese/blob/5a4b02b779cb85042e537bc3ce70ef403481e798/NOTICE.md#L1-L38)、[Acedio 的代码/音频双许可证](https://github.com/Acedio/animalese.js/blob/6f18a909df12cdddab59438640ac8019b78fac2f/LICENSE.md#L1-L13)、[ChineseGibberish MIT](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/LICENSE)、[ChineseGibberish 改编来源与可替换音频](https://github.com/Xinqwq/Animalese_Converter/blob/25525a1ba64c2fb5a34f6eda34b84f340c14a731/README.md#L254-L290)、[ACNH 提取音频声明](https://github.com/IronBit-0/AnimaleseSynthesis/blob/64522e0d58bf9ba817b3303b8b55efd27dc6f183/README.md#L1-L6)

## 六、仍然不能从 GitHub 证明的部分

- 没有找到 Nintendo 对 ACNH 中文语音生成算法的官方技术说明或公开源码。
- GameCube 反编译能证明该版本的实现结构，不能直接证明 Wii/3DS/Switch 各代完全沿用。
- ACNH 社区仓库中的 A–Z/数字 WAV 只能证明“有人从游戏提取并按字符拼接”，不能证明游戏本体 runtime 就只做这一层。
- 视频/ASR 可以帮助观察听感与时间同步，但无法仅凭波形区分“预录音素库”“字母库”“formant 合成”或更复杂的内部规则；应把它当交叉验证，不当源码证据。
