# 交付索引

## 主要文档

- `animal-crossing-speech-analysis.md`：中文与多语言 Animalese 风格语音的实现整理。
- `acnh-speech-research.md`：仅针对 Switch《集合啦！动物森友会》（ACNH）的资源结构、语音库、中文推断边界及可复现路线；这是回答“ACNH 如何工作”的主文档。
- `acnh-supported-languages.md`：任天堂官方列出的 ACNH 软件语言与地区变体，并说明它们和 Animalese 发声机制的区别。
- `acnh-language-to-animalese.md`：逐一整理 14 个 locale 如何进入共用 Animalese 声源；区分资源证据、合理前端假设和仍未恢复的原版规则。
- `github-animalese-research.md`：跨版本背景研究，其中 GameCube 反编译仅用于历史对照，不能证明 ACNH 的实现。
- 两份素材（3:30 的 B 站视频与一段 78 分钟的讨论录音）的逐字稿和截图只保留在本地，没有公开：它们是第三方内容。

## 素材与处理记录

- Bilibili 视频：[BV1Mf4y1S7Gs](https://www.bilibili.com/video/BV1Mf4y1S7Gs)。
- 第二份音频：一段关于动森语音和游戏拟声语言的长篇讨论录音，来源未公开。
- 参考工程：ChineseGibberish 的本地副本（与 GitHub 上的 `Xinqwq/Animalese_Converter` 同源）。

## Qwen3-ASR 部署

- Kubernetes namespace：`qwen3-asr-transcription`
- 活动 Pod：`qwen3-asr-hami-worker`
- GPU：RTX 4080 SUPER，HAMI 10 GiB 显存配额
- 模型：`Qwen/Qwen3-ASR-0.6B`
- 时间对齐：`Qwen/Qwen3-ForcedAligner-0.6B`
- 部署清单：`../k8s/qwen3-asr.yaml`

当前是批处理 worker，不对集群外暴露网络服务。全部资源均在任务专用 namespace 内；不再需要时可清理：

```bash
KUBECONFIG=<your kubeconfig> \
  kubectl delete namespace qwen3-asr-transcription
```

## 已知限制

- 两份文字均为机器转录；拟声、歌唱、多人抢话及英文专名最容易出错。
- 长音频末尾歌曲已用 English 模式单独重跑，但仍为低置信度结果。
- 文档对显著专名给出提示，同时保留 JSON 中的原始模型输出，便于继续人工校对。
