import { Title } from 'animal-island-ui'

import { BakeSteps } from './BakeSteps'
import { RuntimeSteps } from './RuntimeSteps'

const steps = [
  ['record', '录音'],
  ['trim', '切静音'],
  ['consonant', '缩短辅音'],
  ['flatten', '拉平音高'],
  ['finish', '截长与响度'],
  ['analyze', '切分'],
  ['clocks', '两个时钟'],
  ['melody', '旋律'],
  ['play', '播放'],
] as const

/** The whole pipeline, one interactive step at a time. */
export function PipelinePage() {
  return (
    <div className="pipeline">
      <nav className="step-nav" aria-label="步骤">
        {steps.map(([id, label], index) => (
          <a key={id} href={`#${id}`}>
            <span className="step-nav-index">{index + 1}</span>
            {label}
          </a>
        ))}
      </nav>

      <div className="pipeline-body">
        <p className="lead">
          这是对
          <a href="https://www.bilibili.com/video/BV1Mf4y1S7Gs" target="_blank" rel="noreferrer">重轻的动森语音教程</a>
          的程序化复现：在 DAW 里手工做的处理都移到了离线烘焙，运行时只剩切分、排时间和改播放速率。数值来自对游戏录屏的测量，切分规则是合理的近似，不是游戏的原始算法。
        </p>

        <Title size="small" variant="layer" color="app-orange">离线烘焙</Title>
        <BakeSteps firstIndex={1} />

        <Title size="small" variant="layer" color="app-blue">运行时</Title>
        <RuntimeSteps firstIndex={6} />
      </div>
    </div>
  )
}
