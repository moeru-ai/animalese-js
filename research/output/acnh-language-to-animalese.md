# ACNH：14 个 locale 如何转换成 Animalese

研究日期：2026-10-06  
范围：只讨论 Nintendo Switch《Animal Crossing: New Horizons》（ACNH）。旧作专利和社区生成器只作背景或复现参考，不作为 ACNH 运行时代码的证据。

## 先说结论

公开资料足以确认 ACNH 的**外部结构**，但还不足以恢复 Nintendo 的逐语言转换表：

```text
该 locale 已经本地化完成的消息文本
  -> 尚未公开的 locale 感知读音归一化 / 切分
  -> 共用的 Kana / KanaEx / Loop 短语音单元
  -> 性格声线 bank + 角色节奏 / 停顿 + 消息延迟
  -> 与逐字显示同步的 Animalese
```

这不是“把所有语言先翻成日语再朗读”。比较稳妥的理解是：不同书写系统必须先被压缩成共用短声源能够表达的有限语音单位。**日语、英语、中文、韩语、俄语分别怎样做这一步，ACNH 的映射表和运行时函数目前都没有公开恢复。**

## 能从 ACNH 资源直接确认什么

### 1. 游戏有 14 套独立的消息 locale

提取出的消息树包含：

| locale | 语言/地区 |
|---|---|
| `JPja` | 日语 |
| `USen` | 美式英语 |
| `EUen` | 英式/欧洲英语 |
| `USfr` | 加拿大/北美法语 |
| `EUfr` | 欧洲法语 |
| `USes` | 拉丁美洲/北美西班牙语 |
| `EUes` | 欧洲西班牙语 |
| `EUde` | 德语 |
| `EUit` | 意大利语 |
| `EUnl` | 荷兰语 |
| `EUru` | 俄语 |
| `KRko` | 韩语 |
| `CNzh` | 简体中文 |
| `TWzh` | 繁体中文 |

每个 locale 都有对应的 `TalkNNpc_*` 村民对话树，而不是运行时把日文即时翻译成其他语言。[ACNH 消息树，固定 commit](https://github.com/frangb9815/acnh-message/tree/a0a08359a27d7eb7f5b89ba4ffee7240959ea57f)；目录命名、消息类型和 locale 含义也由 [ACNH Modding Wiki 的资源说明](https://acmods.org/wiki/New_Horizons:Dialog#Region_Types)交叉验证。

公开 CSV 只有 `label,text` 两列以及保留下来的控制码，没有逐条附带一列拼音、IPA、罗马字或音节序列。这只能说明公开转储中没有现成的读音列，**不能排除**原始 MSBT 属性、其他表或程序内部存在额外规则。

日语是一个重要例外：`JPja` 消息中能看到 ruby（振假名）控制标签携带的读音，例如同一段中出现 `かんさつ／観察`、`いし／石`、`おおむかし／大昔`。[日文消息实例，固定 commit](https://github.com/frangb9815/acnh-message/blob/a0a08359a27d7eb7f5b89ba4ffee7240959ea57f/TalkNNpc_JPja/G2_Ge/Spot/GE_Spot_Museum_Fossil.csv#L3-L18)；逆向解析器把消息标签 `(0,0)` 明确识别为 `ruby`，[见固定 commit](https://github.com/Treeki/CylindricalEarth/blob/bb09c0ee71a4aa6011de088b88ea55fdee0bf6e9/msbt.py#L58-L66)。这证明日文消息携带部分汉字读音注释，使“先得到 kana 再选 Kana 声源”更可信；但仅凭标签仍不能证明语音模块一定使用该字段，也不能补齐未标注文本的规则。

### 2. 普通对话使用不带 locale 后缀的共用短声源

ACNH 的语音档案名是 `doubutsugo_base.bars`。提取工具从 BARS 的 AMTA 元数据读取条目名，再按该名称导出 BWAV，所以 `Voice_*` 名称不是网页生成器随意创造的。[BARcSharp 的 ACNH 示例](https://github.com/K-E-R-A-D/BARcSharp/blob/e88339bb8f93c79c171d01c718bf1605c7e70819/README.md#L1-L24)、[AMTA 名称读取代码](https://github.com/K-E-R-A-D/BARcSharp/blob/e88339bb8f93c79c171d01c718bf1605c7e70819/Theprogram5.cs#L158-L221)

提取出的普通对话资源名采用下列形式：

- `Voice_<personality>_Kana_<unit>`
- `Voice_<personality>_KanaEx_<unit>`
- `Voice_<personality>_Loop_<vowel>`

读取这些 ACNH 音频的代码按上述三类建库，而且普通 bank 名本身没有 `USen`、`CNzh` 等 locale 后缀。[资源分类代码，固定 commit](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/voicehelper.py#L19-L49)；另一份提取资源镜像列出了 `ba/byu/cha/fa/gwa/kwe/sha/tsa/wi/zwi` 等宽于基础日语五十音的 CV/mora 单元和大量元音连接单元，[见固定 commit 目录](https://github.com/marusheik/AnimalCrossing_TypingSounds_Chrome_Extension/tree/b1fb339d2fa79862297446917d6255e13d02171c/Animalese)。

因此，最有证据支持的架构是“locale 各自处理文本，随后复用按性格划分的有限声源库”。但公开镜像可能不完整，所以不能据此断言游戏包里绝不存在其他语言表。

### 3. 键盘读字母资源不能当作 NPC 对话规则

部分镜像还出现 `Voice_Swkbd_*_Alph_Eng_*`、`..._Ger_*` 和数字资源。`Swkbd` 指软件键盘；它们能证明键盘场景存在英语/德语字母或数字读音，却不能证明普通村民对话也逐字母朗读。[固定 commit 的 `swkbd_en` / `swkbd_de` 资源树](https://github.com/RedrumRettan/perfect_acnh_animalese_generator/tree/e7aff4133a3add069cf575dd2c19c42f8df30514/acnh_talking_sounds)

## 逐语言能说到什么程度

下表中的“最合理前端”是为了描述**复刻时最合理的工程模型**，不是声称已经恢复了 Nintendo 的实现。

| locale | ACNH 直接证据 | 最合理前端（假设） | 仍未知 |
|---|---|---|---|
| `JPja` 日语 | 独立日文消息；声源以 `Kana` 命名；部分汉字带 ruby 读音注释 | 假名最接近直接映射到 mora/CV；带 ruby 的汉字已有显式读音候选 | ruby 是否供语音模块使用；未标注汉字、数字和拉丁字母处理；KanaEx 选择规则 |
| `USen` 美式英语 | 独立北美文本；共用普通 voice bank | 英文正字法经过简化 G2P/字母组合规则，再量化到 CV/mora | 是否查词典、重音、`th/r/l`、静音字母和专名规则 |
| `EUen` 英式英语 | 独立欧洲英文文本 | 与 `USen` 同类型的英文前端很合理；不同拼写会自然产生不同输入 | 是否与 `USen` 共用完全相同代码；英美发音差异是否参与 |
| `EUfr` 欧洲法语 | 独立欧洲法文文本 | 法语正字法/G2P 近似到共用 CV 单元 | 连音、鼻化元音、静音尾辅音、`r` 的具体近似 |
| `USfr` 加拿大/北美法语 | 独立北美法文文本 | 可能复用法语前端，由本地化拼写和文本差异影响输出 | 是否有加拿大法语专属发音分支；无专属普通声源证据 |
| `EUes` 欧洲西班牙语 | 独立欧洲西文文本 | 西语字母/二合字母规则近似到 CV | `c/z/s`、`ll/y`、重音及方言差异怎样处理 |
| `USes` 拉美/北美西班牙语 | 独立北美西文文本 | 可能复用西语前端 | 是否实现拉美发音分支，还是只让不同文本进入同一规则 |
| `EUde` 德语 | 独立德文文本；另有德语 **键盘**字母资源 | 德语正字法/G2P 近似到 CV | 复合词、元音长度、变音符、`ch/r` 的规则；键盘样本不能回答普通对话 |
| `EUit` 意大利语 | 独立意大利文文本 | 相对规则的正字法映射，再量化到 CV | 重音、双辅音、`c/g` 软硬音和外来词规则 |
| `EUnl` 荷兰语 | 独立荷兰文文本 | 荷兰语正字法/G2P 近似到 CV | 双元音、`g/ch/r` 和复合词规则 |
| `EUru` 俄语 | 独立西里尔字母文本 | 西里尔字母求近似读音或先转写，再映射到 CV | 重音未知时的元音弱化、软硬辅音、`ь/ъ`、`ы/щ` 等怎样量化 |
| `KRko` 韩语 | 独立 Hangul 文本 | 音节块拆成声母/韵母/韵尾或等价读音单位，再近似到 CV | 받침（韵尾）、连音、紧音/送气音、复合元音的规则 |
| `CNzh` 简体中文 | 独立简中消息；有限 Kana/CV bank 无法逐汉字录满 | 汉字求普通话读音或查字符映射，再量化到共用 CV；“拼音式中间层”是可行方案 | 多音字、声调、轻声、儿化；是否真的生成拼音，还是直接查内部字符表 |
| `TWzh` 繁体中文 | 独立繁中消息 | 汉字求当地使用的普通话/国语读音或查字符映射，再量化到 CV | 是否与 `CNzh` 共用读音前端；注音/拼音都只是可能的中间表示，资源未证明其中之一 |

### 地区变体的关键限制

`USen/EUen`、`USfr/EUfr`、`USes/EUes` 的**文本资源确实分开**；普通 Animalese 声源却没有发现对应的六套 locale bank。这支持“地区文本不同，但可能复用同语种前端和共用声源”的解释。它仍不是运行时代码证明：地区分支也可能藏在程序或未公开的数据表里。

### 中文尤其不能把“拼音方案”写成官方事实

社区项目 `KatedaEoS/animalese-gen` 会将已经罗马字化的中文近似到 ACNH Kana bank，例如做 `l -> r`、`ng -> n`、`q -> ch`、`x/sh -> s` 等替换，再作最长匹配切分。[中文近似表](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/slicer.py#L82-L119)、[切分实现](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/slicer.py#L26-L79)

这证明“汉字读音/拼音 -> 有限 CV bank”可以工作；但项目使用第三方 `pypinyin` 辅助脚本，而且作者没有声称该替换表来自游戏二进制。[pypinyin 辅助脚本](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/getpinyin.py#L1-L13) 所以它是复刻方案，不是 ACNH 原算法。

## 为什么能合理推断存在“音节化”，却不能认定具体规则

Nintendo 的旧专利 JP4651168B2 明确讨论：外语可使用“一个或多个辅音加一个元音”构成的音节并将相邻波形重叠，还特别提到可用相同思路生成动物角色的“animal language”。[专利第 0098–0100 段](https://patents.google.com/patent/JP4651168B2/en#p-0098)

这与 ACNH 的 `Kana/KanaEx/Loop` 资源结构相容，但专利优先权日是 2000 年，早于 ACNH 约二十年。它只能说明 Nintendo 历史上拥有这种设计，**不能证明 ACNH 沿用了同一字符表、同一前端或同一波形拼接算法**。

## 目前缺失的决定性证据

要把上表的“假设”升级成“ACNH 已证实”，至少需要以下一种材料：

1. ACNH executable 中从 Unicode 文本到 `Kana/KanaEx/Loop` ID 的反编译函数；
2. 包含各 locale 字符、字母组合或读音到单元 ID 的数据表；
3. 保留全部属性的原始 MSBT，加上能证明某个标签控制读音的运行时分析；
4. 对同一可控文本在 14 个 locale 下录音，并和原始 BWAV 做音高/时间归一化匹配，反推出稳定规则。

在这些证据出现以前，最准确的回答是：

> ACNH 为 14 个 locale 准备独立文本；普通角色语音看起来复用一套按性格划分、以 CV/mora 为主的短采样库。游戏中间存在语言感知的归一化/切分层，但公开资料尚未恢复它的逐语言规则。因此可以描述各语言合理的 G2P/读音前端，却不能给出 Nintendo 原版的精确转换表。

## 素材与许可证说明

- `acnh-message`、提取 WAV 镜像和事件/数据转储包含 Nintendo 游戏内容，仓库也未必声明覆盖这些内容的许可；仅适合作研究证据，不应随实现再分发。
- 工具代码的许可证不授予 ACNH 文本或音频素材的版权许可。
- 若要实现可发布生成器，建议自行录制声源或取得明确授权，仅借鉴经独立验证的高层结构。
