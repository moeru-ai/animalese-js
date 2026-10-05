import { convertSampleRate, decodeWav } from '@animalese/dsp'

export const sampleRate = 24000

export interface DemoClip {
  id: string
  carrier: string
  reading: string
  file: string
}

/** Raw TTS recordings shipped with the playground, as they came out of the API. */
export async function loadDemoClips(): Promise<DemoClip[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo/index.json`)
  return response.ok ? await response.json() as DemoClip[] : []
}

export async function loadDemoClip(clip: DemoClip): Promise<Float32Array> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo/${clip.file}`)
  const { samples, sampleRate: rate } = decodeWav(await response.arrayBuffer())
  return convertSampleRate(samples, rate, sampleRate)
}

/** Records the microphone for `seconds` and returns mono samples at the demo sample rate. */
export async function recordMicrophone(context: AudioContext, seconds = 1.5): Promise<Float32Array> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
  try {
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }))
    recorder.start()
    await new Promise(resolve => setTimeout(resolve, seconds * 1000))
    recorder.stop()
    await stopped
    const decoded = await context.decodeAudioData(await new Blob(chunks).arrayBuffer())
    return convertSampleRate(decoded.getChannelData(0), decoded.sampleRate, sampleRate)
  }
  finally {
    for (const track of stream.getTracks())
      track.stop()
  }
}
