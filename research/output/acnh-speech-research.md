# ACNH（《集合啦！动物森友会》）语音系统源码与资源研究

研究日期：2026-10-06  
范围：只讨论 Nintendo Switch《Animal Crossing: New Horizons》（ACNH，含 Happy Home Paradise）。GameCube 等前作不作为 ACNH 实现证据。

## 结论

### 已证实

1. **ACNH 存在专门的 Animalese 音频档案 `doubutsugo_base.bars`。** 面向 ACNH 的 BARS 提取器把它直接用作命令行示例。BARS 内含 AMTA 元数据和 BWAV 音频条目；工具按 AMTA 名称导出各个 BWAV。因此社区中出现的 `Voice_*_Kana_*` 文件名不是生成器凭空设计的命名体系，而是从档案元数据保留下来的名称。[BARcSharp README（固定 commit）](https://github.com/K-E-R-A-D/BARcSharp/blob/e88339bb8f93c79c171d01c718bf1605c7e70819/README.md#L1-L24)、[AMTA 名称读取](https://github.com/K-E-R-A-D/BARcSharp/blob/e88339bb8f93c79c171d01c718bf1605c7e70819/Theprogram5.cs#L158-L221)、[按名称导出 BWAV](https://github.com/K-E-R-A-D/BARcSharp/blob/e88339bb8f93c79c171d01c718bf1605c7e70819/Theprogram5.cs#L386-L425)
2. **核心声源是大量预录的短语音单元，而不是仅靠实时振荡器生成。** 已提取资源的名字包括 `Voice_<声线>_Kana_<音节>`、`KanaEx`、`Loop`、`Voice_Dot`，另有软件键盘使用的 `Voice_Swkbd_*_Alph/Digit_*`。文件名显示 `Kana` 是日语式 CV/mora 单元；社区读取代码把 `KanaEx` 当作带前导元音的连接单元、把 `Loop` 当作可重复元音，但它们在游戏运行时的精确定义仍未恢复。这一结构由读取这些 ACNH 提取文件的两个独立项目交叉支持：[KatedaEoS 的资源读取与分类](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/voicehelper.py#L19-L49)、[ACNH 音频取得说明](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/README.md#L1-L6)、[另一项目中的真实文件名例子](https://github.com/graysonpike/animalese/blob/c127ba3ad63d8bc0fbd6559defe2a5332951633a/components/voice.cpp#L93-L119)。
3. **资源至少按多种基础声线分 bank。** 可核验的内部名包括 `Aneki`、`Bonyari`、`Futsu`、`Genki`、`Hakihaki`、`Kiza`、`Kowai`、`Otona`，以及特殊的 `Ghost`。这些名字与 ACNH 的八种村民性格日文内部称呼相符；一份资源镜像按这些名字构造文件路径，并逐项列出 Kana/KanaEx 库。[声线列表与文件前缀](https://github.com/RedrumRettan/perfect_acnh_animalese_generator/blob/e7aff4133a3add069cf575dd2c19c42f8df30514/index.html#L366-L399)、[按声线选择 Kana/KanaEx 文件](https://github.com/RedrumRettan/perfect_acnh_animalese_generator/blob/e7aff4133a3add069cf575dd2c19c42f8df30514/index.html#L575-L599)
4. **ACNH 的文本资源按 locale 分离。** 提取出的消息树包含 `JPja`、`USen`、`EUde`、`CNzh`、`TWzh` 等独立目录；因此游戏实际展示的中文不是由日文文本现场翻译而来。[简中 `TalkNNpc_CNzh`](https://github.com/frangb9815/acnh-message/tree/a0a08359a27d7eb7f5b89ba4ffee7240959ea57f/TalkNNpc_CNzh)、[日文 `TalkNNpc_JPja`](https://github.com/frangb9815/acnh-message/tree/a0a08359a27d7eb7f5b89ba4ffee7240959ea57f/TalkNNpc_JPja)、[英文 `TalkNNpc_USen`](https://github.com/frangb9815/acnh-message/tree/a0a08359a27d7eb7f5b89ba4ffee7240959ea57f/TalkNNpc_USen)
5. **ACNH 确实有角色级的语音节奏/停顿数据，以及消息级的性格延迟标签。** 对 ACNH BCSV 的逆向规格显示，`NmlNpcParam` 每个普通村民条目都有 `VmPauseType` 与 `VmRhythmType`；前者枚举为 `Stop / Tie`，后者为 `Normal / Shuffle / Random`。[村民参数字段](https://github.com/Treeki/CylindricalEarth/blob/bb09c0ee71a4aa6011de088b88ea55fdee0bf6e9/specs_200.py#L6366-L6406)、[节奏枚举](https://github.com/Treeki/CylindricalEarth/blob/bb09c0ee71a4aa6011de088b88ea55fdee0bf6e9/specs_200.py#L36-L40)、[停顿枚举](https://github.com/Treeki/CylindricalEarth/blob/bb09c0ee71a4aa6011de088b88ea55fdee0bf6e9/specs_200.py#L1885-L1888)。MSBT 标签还支持以帧数指定 `delay`，以及按八类性格分别指定 `delayByPersonality`。[消息延迟标签](https://github.com/Treeki/CylindricalEarth/blob/bb09c0ee71a4aa6011de088b88ea55fdee0bf6e9/msbt.py#L58-L97)。这证明 ACNH 的“说话节拍”不只是音频播放速度，而是数据驱动的停顿、节奏与消息延迟；它仍不能单独证明音素选择规则。
6. **EventFlow 只负责打开某条本地化消息，公开反编译结果中没有把文本逐字映射到语音单元的参数。** 例如村民对话流程只传入 `TalkNNpc/...:<编号>` 和一个布尔值；主、次 NPC 轮流调用同一 `OpenMessageWindow` 接口。[ACNH EventFlow 工具的适用范围](https://github.com/asteriation/acnh-eventflow-decompiler/blob/95f33afe29572649d94b820128d54b5026e1b191/README.md#L1-L3)、[实际双 NPC 对话流程](https://github.com/Rafacasari/acnh-eventflows/blob/78cbc66da4cfb7cb365be77651ed6acdc0b799e4/NNPC_AN_Conv_AN.evfl.txt#L1-L30)。这把映射逻辑的可能位置缩小到了消息/字体/音频运行时或其数据表，而不是 EventFlow 脚本本身。
7. **资源容器链条可以复现。** Switch Toolbox 识别 `BARS` 签名、读取其中的 AMTA 与音频条目，并区分 BWAV/FWAV；vgmstream 能解析 Nintendo BWAV 的声道数、采样率、采样数、循环点和 codec，并明确记录 ACNH DLC 的 BWAV 使用案例。[Switch Toolbox 的 BARS 读取](https://github.com/KillzXGaming/Switch-Toolbox/blob/9fe41401d246d31c99fcbfdd0a7fe4253a95b31f/File_Format_Library/FileFormats/Audio/BARS/BARS.cs#L19-L36)、[AMTA/BWAV 条目命名](https://github.com/KillzXGaming/Switch-Toolbox/blob/9fe41401d246d31c99fcbfdd0a7fe4253a95b31f/File_Format_Library/FileFormats/Audio/BARS/BARS.cs#L233-L277)、[vgmstream 的 BWAV 解析](https://github.com/vgmstream/vgmstream/blob/7dc938fa2f210943b37c7b6511852b516ef432ab/src/meta/bwav.c#L7-L75)

### 强推断，但尚未由 ACNH 运行时代码证明

综合上述资源，可以把 ACNH 的高层管线概括为：

```text
本地化消息文本
  → locale 特定的文本/读音处理
  → 选择 Kana / KanaEx / Loop / 标点等短单元
  → 选择基础声线 bank
  → 逐单元播放、衔接，并施加角色/情绪相关参数
  → 与消息框逐字显示及口型同步
```

其中前四项有资源命名和调用边界支持。角色数据已进一步证明存在 `Stop/Tie` 与 `Normal/Shuffle/Random` 两组控制，消息也能按性格指定延迟；但“具体分词规则、连接优先级、pitch/formant 数值、情绪曲线”仍然缺少 ACNH 可审计的运行时代码。

资源镜像固定 commit 的本地审计得到 1,926 个 WAV。完整声线通常含 144 个 `Kana`，另有 94 个左右 `KanaEx` 和少量 `Loop`；抽查的单元为 48 kHz、mono、约 0.12–0.16 秒。这与“快速串接短采样”的模型一致。该镜像本身经过整理与补文件，不能用它的目录数量反推原始 BARS 的精确布局。镜像中的代码也把速度、pitch、gap 当作用户可调参数；这些控件是社区实现，**不是 ACNH 原始参数的证据**。[社区资源索引与 locale fallback](https://github.com/RedrumRettan/perfect_acnh_animalese_generator/blob/e7aff4133a3add069cf575dd2c19c42f8df30514/index.html#L391-L444)、[社区播放时的 speed/pitch 处理](https://github.com/RedrumRettan/perfect_acnh_animalese_generator/blob/e7aff4133a3add069cf575dd2c19c42f8df30514/index.html#L718-L795)

## 中文：目前能说到哪一步

### 能证实的

- ACNH 有独立简体中文和繁体中文消息资源。
- 已知基础语音库使用 `Kana` / `KanaEx` 命名，并非一个按全部 Unicode 汉字录制的巨大字库。
- 因此中文必须在某处被压缩或映射到有限语音单元；否则有限 bank 无法覆盖任意汉字。

### 可运行的社区复现，但不是游戏原算法

`KatedaEoS/animalese-gen` 是目前 GitHub 上最贴近这个问题的中文实验：它明确要求使用 ACNH 提取音频，接受 `zh`/`ja`，然后把外部得到的拼音近似映射到 Kana bank。[语言入口](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/main.py#L8-L35)

它的中文近似规则包括：

- `l → r`、`ng → n`；
- `c* → ch*`；
- `zh → z`、`q → ch`、`x/sh → s`；
- `jiu → jo`、`jia → ja`、`ji → je`；
- `uo → o`、`yi → i`、`wu → u`；
- 再用现有 Kana 集做最长可用切分。

来源：[PinYinSlicer 映射](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/slicer.py#L82-L119)、[Kana 切分](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/slicer.py#L26-L79)、[KanaEx 与 fallback 选择](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/voicehelper.py#L51-L73)

这证明“拼音 → 日语式有限音节库”能用 ACNH 声源做出可信的中文 Animalese；它**不能证明 ACNH 本体采用相同替换表**。项目中的 `getpinyin.py` 使用第三方 `pypinyin`，而主程序实际上期待调用者传入已经罗马字化的内容；这也说明它是独立复现，不是从游戏中恢复出的中文前端。[pypinyin 辅助脚本](https://github.com/KatedaEoS/animalese-gen/blob/aa3f3ceedfe0dea446ef0ebbe2742c723648d019/getpinyin.py#L1-L13)

本地的 ChineseGibberish 副本 同样属于通用的“汉字 → 拼音 → 声母/韵母样本”实现。它适合做中文前端设计参考，但没有 ACNH 资源、符号名或运行时证据，不能用于描述 ACNH 本体。

## 仍然未知，不能写成事实

1. **ACNH 简中/繁中的精确字符或拼音映射表。** 目前没有找到 Nintendo 文档、ACNH 可审计源码，或从游戏二进制恢复的对应表。
2. **多音字、声调、轻声、变调是否参与。** 单凭成品声音和消息 CSV 无法区分“拼音规则”“汉字 hash”“译者写入隐藏读音标记”或其他算法。
3. **每位 NPC 的 pitch、speed、formant、envelope 数值及保存位置。** 已确认普通村民参数中有 pause/rhythm 控制，也有多套基础 bank，但还不能证明“性格 bank + 每角色 pitch”究竟如何组合，更不能从社区 UI 的 pitch 滑块反推游戏参数。
4. **KanaEx 的原始运行时选择规则。** 文件名显示有连接单元，但没有找到 ACNH 本体中决定何时选 `Kana`、`KanaEx`、`Loop` 的函数。
5. **中文和日文是否共享完全相同的 bank。** 现有提取材料强烈指向共享基础 bank，但公开镜像可能不完整，不能排除游戏包中还有 locale 专用表或资源。

## 对现有转录与实现工作的实际意义

如果目标是解释视频里 ACNH 中文语音，最稳妥的表述是：

> ACNH 使用从 `doubutsugo_base.bars` 取得的短语音单元库；资源按多种声线分组，包含 Kana、连接单元和循环单元。中文拥有独立本地化文本，运行时必然把中文压缩/映射到有限声源，但其官方映射规则尚未公开。把汉字转拼音、再近似到 Kana bank 是一个能工作的社区复现方案，不是已经证实的游戏算法。

转录视频时，ASR 听到的“近似中文”不应被当成隐藏的完整普通话朗读。更有价值的验证方式是对齐字幕时间轴，切出单字发声，再与同一声线 bank 的 Kana/KanaEx 波形做相似度或音高归一化比较；这样有机会反推出某个版本/locale 的实际映射，而不是依赖 ASR 猜词。

## 许可证与素材风险

| 来源 | 代码许可 | ACNH 提取素材 | 建议 |
|---|---|---|---|
| BARcSharp | Unlicense；许可正文见[固定 commit](https://github.com/K-E-R-A-D/BARcSharp/blob/e88339bb8f93c79c171d01c718bf1605c7e70819/LICENSE.md#L1-L22) | 仓库不附游戏档案 | 可使用代码；用户自行合法取得资源 |
| Switch Toolbox | GPL-3.0 | 不附 ACNH 资源 | 研究/提取工具与成品素材分开处理 |
| vgmstream | 宽松许可 | 不附 ACNH 资源 | 可用于解码自有文件 |
| `KatedaEoS/animalese-gen` | 仓库未见许可证 | 指引用户另行取得 ACNH 音频 | 未获作者许可前不要复制其代码；更不能随程序分发游戏声音 |
| `IronBit-0/AnimaleseSynthesis` | 仓库未见许可证 | README 明说音频从 ACNH 提取并致谢提取者，[见 L1–L6](https://github.com/IronBit-0/AnimaleseSynthesis/blob/64522e0d58bf9ba817b3303b8b55efd27dc6f183/README.md#L1-L6) | 只作研究旁证，不复用或再分发 WAV |
| `perfect_acnh_animalese_generator` | 仓库未见许可证 | 仓库直接包含大量疑似提取 WAV | 高风险；只核验命名与结构，不纳入可发布资产 |
| `CylindricalEarth` | GPL-3.0 | 逆向得到的 ACNH 数据规格 | 代码遵守 GPL；游戏数据本身仍单独处理 |
| `acnh-message` / `acnh-eventflows` | 仓库未见许可证 | 含游戏提取文本/流程 | 只作研究证据，不打包进产品 |

代码许可证不覆盖 Nintendo 的游戏音频、文本或其他提取内容。即使某个提取工具是 Unlicense/MIT/GPL，也不意味着用它导出的 ACNH 声音可以再分发。
