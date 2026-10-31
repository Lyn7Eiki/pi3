import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCameraError, startCameraScan } from '../src/camera.js';

test('C1 摄像头错误翻译成中文', () => {
  const cases = [
    [{ name: 'NotAllowedError' }, /权限被拒绝/],
    [{ name: 'PermissionDeniedError' }, /权限被拒绝/],
    [{ name: 'NotFoundError' }, /没有找到/],
    [{ name: 'NotReadableError' }, /占用/],
    [{ name: 'OverconstrainedError' }, /分辨率/],
    [{ name: 'NotSupportedError' }, /不支持/],
    [{ message: 'Something odd' }, /摄像头打开失败：Something odd/],
  ];

  for (const [error, pattern] of cases) {
    assert.match(mapCameraError(error), pattern, JSON.stringify(error));
  }
});

test('C2 命中一帧后停止轨道并回调结果', async () => {
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  const stream = { getTracks: () => [track] };

  const video = {
    srcObject: null,
    readyState: 2,
    videoWidth: 640,
    videoHeight: 480,
    played: false,
    async play() {
      this.played = true;
    },
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage() {},
        getImageData(x, y, width, height) {
          return { data: new Uint8ClampedArray(width * height * 4), width, height };
        },
      };
    },
  };

  const statuses = [];
  let resolveHit;
  const hit = new Promise((resolve) => {
    resolveHit = resolve;
  });

  const session = await startCameraScan({
    video,
    canvas,
    decode: async () => ({ results: [{ text: 'camera-code' }], elapsedMs: 12 }),
    onResult: (result, frame) => resolveHit({ result, frame }),
    onStatus: (kind) => statuses.push(kind),
    mediaDevices: { getUserMedia: async () => stream },
    interval: 1,
  });

  const { result, frame } = await hit;
  assert.equal(result.text, 'camera-code');
  assert.equal(frame.width, 640);
  assert.equal(frame.height, 480);
  assert.equal(frame.elapsedMs, 12);
  assert.equal(track.stopped, true);
  assert.equal(video.srcObject, null);
  assert.equal(video.played, true);
  assert.deepEqual(statuses, ['ready']);
  assert.equal(typeof session.stop, 'function');
});

test('C3 没有 mediaDevices 时明确报不支持', async () => {
  await assert.rejects(
    () =>
      startCameraScan({
        video: {},
        canvas: { getContext: () => ({}) },
        decode: async () => ({ results: [] }),
        onResult() {},
        mediaDevices: {},
      }),
    (error) => error.name === 'NotSupportedError',
  );
});

test('C4 打开前已取消则释放已经拿到的轨道', async () => {
  let started = false;
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  const controller = new AbortController();
  controller.abort();

  const session = await startCameraScan({
    video: {},
    canvas: { getContext: () => ({}) },
    decode: async () => ({ results: [] }),
    onResult() {},
    mediaDevices: {
      getUserMedia: async () => {
        started = true;
        return { getTracks: () => [track] };
      },
    },
    signal: controller.signal,
  });

  assert.equal(started, true);
  assert.equal(track.stopped, true);
  assert.equal(typeof session.stop, 'function');
});

test('C5 解码抛错时停掉轨道并上报错误', async () => {
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  const stream = { getTracks: () => [track] };
  const video = {
    srcObject: null,
    readyState: 2,
    videoWidth: 320,
    videoHeight: 240,
    async play() {},
  };
  const canvas = {
    getContext: () => ({
      drawImage() {},
      getImageData(x, y, width, height) {
        return { data: new Uint8ClampedArray(width * height * 4), width, height };
      },
    }),
  };

  let resolveError;
  const errorSeen = new Promise((resolve) => {
    resolveError = resolve;
  });

  await startCameraScan({
    video,
    canvas,
    decode: async () => {
      throw new Error('boom');
    },
    onResult() {
      assert.fail('解码失败时不该命中');
    },
    onStatus: (kind, detail) => {
      if (kind === 'error') resolveError(detail);
    },
    mediaDevices: { getUserMedia: async () => stream },
    interval: 1,
  });

  const error = await errorSeen;
  assert.match(error.message, /boom/);
  assert.equal(track.stopped, true);
  assert.equal(video.srcObject, null);
});
