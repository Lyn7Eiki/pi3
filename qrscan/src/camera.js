import { CAMERA_FORMATS } from './decode.js';
import { fitWithin } from './image.js';

/** 释放摄像头轨道；已经停过的轨道再 stop 一次也无害。 */
function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

/**
 * 把 getUserMedia 的错误翻译成用户能看懂的中文。
 * 浏览器给的英文原文不直接丢到界面上。
 */
export function mapCameraError(error) {
  const name = String(error?.name ?? '');
  const message = String(error?.message ?? '');

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || /permission|denied/i.test(message)) {
    return '摄像头权限被拒绝，请在地址栏的权限设置里允许后重试。';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '没有找到可用的摄像头。';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '摄像头被其他程序占用了，关掉占用的程序后重试。';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return '摄像头不支持请求的分辨率，换一个摄像头试试。';
  }
  if (name === 'NotSupportedError' || /not supported|mediaDevices/i.test(message)) {
    return '当前浏览器不支持摄像头，或页面不是 https / localhost。';
  }
  return `摄像头打开失败：${message || '未知错误'}`;
}

/**
 * 打开摄像头并持续抽帧识别，命中一次就停。
 * 帧的像素、检测框坐标与画布尺寸保持一致，页面拿到 onResult 的 frame 就能直接画 overlay。
 *
 * @param {{
 *   video: HTMLVideoElement,
 *   canvas: HTMLCanvasElement,
 *   decode: (imageData: ImageData, options: object) => Promise<{results: any[], elapsedMs?: number}>,
 *   onResult: (result: any, frame: {canvas: HTMLCanvasElement, width: number, height: number, elapsedMs: number}) => void,
 *   onStatus?: (kind: 'ready'|'error', detail?: any) => void,
 *   mediaDevices?: MediaDevices,
 *   signal?: AbortSignal,
 *   interval?: number,
 *   maxSide?: number,
 * }} options
 * @returns {Promise<{stop: () => void}>}
 */
export async function startCameraScan({
  video,
  canvas,
  decode,
  onResult,
  onStatus = () => {},
  mediaDevices = globalThis.navigator?.mediaDevices,
  signal,
  interval = 220,
  maxSide = 1280,
} = {}) {
  if (!video || !canvas || typeof decode !== 'function' || typeof onResult !== 'function') {
    throw new TypeError('startCameraScan 缺少 video / canvas / decode / onResult');
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器没有提供 2D 画布');

  if (!mediaDevices?.getUserMedia) {
    const error = new Error('mediaDevices.getUserMedia is not supported');
    error.name = 'NotSupportedError';
    throw error;
  }

  const stream = await mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  if (signal?.aborted) {
    stopStream(stream);
    return { stop() {} };
  }

  video.srcObject = stream;
  try {
    await video.play();
  } catch (error) {
    stopStream(stream);
    video.srcObject = null;
    throw error;
  }

  let stopped = false;
  let timer = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    stopStream(stream);
    if (video.srcObject === stream) video.srcObject = null;
  };

  const tick = async () => {
    if (stopped || signal?.aborted) {
      stop();
      return;
    }

    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const { width, height } = fitWithin(video.videoWidth, video.videoHeight, maxSide);
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);

        const decoded = await decode(imageData, {
          formats: CAMERA_FORMATS,
          deep: false,
          maxSymbols: 1,
        });

        if (stopped) return;
        if (decoded?.results?.length) {
          const [result] = decoded.results;
          stop();
          onResult(result, { canvas, width, height, elapsedMs: decoded.elapsedMs ?? 0 });
          return;
        }
      }
    } catch (error) {
      if (stopped) return;
      onStatus('error', error);
      stop();
      return;
    }

    if (!stopped) timer = setTimeout(tick, interval);
  };

  onStatus('ready', { width: video.videoWidth, height: video.videoHeight });
  tick();
  return { stop };
}
