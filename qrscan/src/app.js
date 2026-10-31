import { decodeImageData, formatLabel, summarize } from './decode.js';
import { loadImageFile } from './image.js';
import { accentFor, overlayMarkup } from './overlay.js';
import { copyText } from './clipboard.js';
import { mapCameraError, startCameraScan } from './camera.js';
import {
  addHistory,
  clearHistory,
  HISTORY_LIMIT,
  loadHistory,
  saveHistory,
} from './history.js';

const ICONS = {
  copy: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/></svg>',
  open: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 5h7v7M15 5l-8 8"/><path d="M13 12v3.5A1.5 1.5 0 0 1 11.5 17h-7A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7H8"/></svg>',
  expand: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg>',
  info: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 9v4M10 6.6v.2"/></svg>',
};

const ACTION_LABELS = {
  url: '打开链接',
  email: '写邮件',
  phone: '拨号',
  sms: '发短信',
  geo: '查看位置',
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`;
}

function versionLabel(version) {
  if (!version) return '—';
  return /x/i.test(version) ? version.replace(/x/i, '×') : `v${version}`;
}

function resultMeta(item) {
  const parts = [];
  if (item.version) parts.push(versionLabel(item.version));
  if (item.ecLevel) parts.push(`EC ${item.ecLevel}`);
  parts.push(formatBytes(item.bytes));
  if (item.rotation) parts.push(`${item.rotation}°`);
  if (item.inverted) parts.push('反色');
  return parts.join(' · ');
}

function friendlyError(error) {
  const message = String(error?.message ?? error ?? '');
  if (/解码失败|尺寸为空|image|decode/i.test(message)) {
    return '浏览器打不开这张图片，试试 PNG / JPG / WebP。';
  }
  if (/wasm|fetch|WebAssembly/i.test(message)) {
    return '解码引擎加载失败，请刷新页面再试。';
  }
  return message || '发生未知错误，请换一张图片。';
}

function makeButton(className, icon, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.innerHTML = (ICONS[icon] ?? '') + '<span></span>';
  button.querySelector('span').textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function setButtonLabel(button, label) {
  const span = button.querySelector('span');
  if (span) span.textContent = label;
}

function makeLink(className, icon, label, href, kind) {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.rel = 'noopener noreferrer';
  if (kind === 'url') link.target = '_blank';
  link.innerHTML = (ICONS[icon] ?? '') + '<span></span>';
  link.querySelector('span').textContent = label;
  return link;
}

function appendDetail(list, label, value) {
  const row = document.createElement('div');
  row.append(element('dt', '', label), element('dd', '', value));
  list.append(row);
}

function shortText(text, max = 46) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : flat;
}

/**
 * 把页面上的 DOM 接到解码流程上。
 * 依赖都可以注入，方便在测试里替换掉图片加载、解码与剪贴板。
 */
export function bindApp(dom, deps = {}) {
  const {
    decode = decodeImageData,
    loadImage = loadImageFile,
    copy = copyText,
    log = console.error,
    warmup = true,
    startCamera = startCameraScan,
    cameraError = mapCameraError,
    storage,
    clock = () => Date.now(),
  } = deps;

  const state = {
    busy: false,
    token: 0,
    results: [],
    meta: null,
    history: loadHistory(storage),
  };

  let toastTimer;
  let dragDepth = 0;
  let cameraAbort = null;
  let cameraSession = null;
  let cameraCloseTimer = null;

  const notify = (message) => {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), 2400);
  };

  const formatHistoryTime = (at) => {
    if (!at) return '';
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date(clock());
    const time = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    if (date.toDateString() === now.toDateString()) return time;
    const day = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date);
    return `${day} ${time}`;
  };

  const renderHistory = () => {
    if (!dom.historySection || !dom.historyList) return;
    dom.historySection.hidden = state.history.length === 0;
    dom.historyList.replaceChildren();

    for (const entry of state.history) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'history-chip';
      chip.title = entry.text;
      chip.append(
        element(
          'span',
          'h-format',
          `${entry.format ? formatLabel(entry.format) : '条码'} · ${formatHistoryTime(entry.at)}`,
        ),
        element('span', 'h-text', shortText(entry.text)),
      );
      chip.addEventListener('click', async () => {
        try {
          await copy(entry.text);
          notify('已复制历史内容');
        } catch (error) {
          log(error);
          notify('复制失败，请手动选择文本');
        }
      });
      dom.historyList.append(chip);
    }
  };

  const remember = (items) => {
    const usable = items.filter((item) => item.text);
    if (!usable.length) return;

    const at = clock();
    let list = state.history;
    for (const item of usable) {
      list = addHistory(list, { text: item.text, format: item.format, at }, HISTORY_LIMIT);
    }
    state.history = list;
    saveHistory(list, storage);
    renderHistory();
  };

  const setStatus = (text, stateName = '') => {
    if (dom.previewStatusText) dom.previewStatusText.textContent = text;
    if (dom.previewStatus) {
      dom.previewStatus.classList.toggle('is-success', stateName === 'success');
      dom.previewStatus.classList.toggle('is-error', stateName === 'error');
    }
  };

  const clearOverlay = () => {
    if (!dom.previewOverlay) return;
    dom.previewOverlay.replaceChildren();
    dom.previewOverlay.removeAttribute('viewBox');
  };

  const drawOverlay = (items, width, height) => {
    if (!dom.previewOverlay) return;
    dom.previewOverlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    dom.previewOverlay.innerHTML = overlayMarkup(items, width, height);
  };

  const drawPreview = (source, width, height) => {
    if (!dom.previewCanvas) return;
    dom.previewCanvas.width = width;
    dom.previewCanvas.height = height;
    const context = dom.previewCanvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
  };

  const clearResults = () => {
    state.results = [];
    state.meta = null;
    dom.resultItems?.replaceChildren();
    if (dom.resultCount) dom.resultCount.hidden = true;
    if (dom.resultNotice) dom.resultNotice.hidden = true;
    if (dom.resultItems) dom.resultItems.hidden = true;
    if (dom.emptyState) dom.emptyState.hidden = false;
    if (dom.resultsHint) dom.resultsHint.textContent = '等待图片';
  };

  const showNotice = (title, text) => {
    state.results = [];
    if (dom.resultItems) dom.resultItems.hidden = true;
    if (dom.emptyState) dom.emptyState.hidden = true;
    if (dom.resultLoading) dom.resultLoading.hidden = true;
    if (dom.resultCount) dom.resultCount.hidden = true;
    if (dom.noticeTitle) dom.noticeTitle.textContent = title;
    if (dom.noticeText) dom.noticeText.textContent = text;
    if (dom.resultNotice) dom.resultNotice.hidden = false;
    if (dom.resultsHint) dom.resultsHint.textContent = '未识别';
  };

  const setBusy = (busy) => {
    state.busy = busy;
    dom.dropzone?.classList.toggle('is-busy', busy);
    if (busy) {
      if (dom.resultLoading) dom.resultLoading.hidden = false;
      if (dom.emptyState) dom.emptyState.hidden = true;
      if (dom.resultNotice) dom.resultNotice.hidden = true;
      if (dom.resultItems) dom.resultItems.hidden = true;
      if (dom.resultsHint) dom.resultsHint.textContent = '识别中…';
    } else {
      if (dom.resultLoading) dom.resultLoading.hidden = true;
      if (dom.resultItems) dom.resultItems.hidden = state.results.length === 0;
    }
  };

  const createResultCard = (item, index) => {
    const card = element('article', 'result-card');
    card.style.setProperty('--accent', accentFor(index));

    const top = element('div', 'result-top');
    top.append(
      element('span', 'result-index', `#${String(index + 1).padStart(2, '0')}`),
      element('span', 'format-badge', item.formatLabel),
      element('span', 'kind-badge', item.kindLabel),
      element('span', 'result-meta', resultMeta(item)),
    );
    if (item.format) top.children[1].title = item.format;

    const text = element('pre', 'result-text', item.text || '（空内容）');
    const needsClamp = item.text.length > 160 || item.text.split('\n').length > 4;
    if (needsClamp) text.classList.add('is-clamped');
    if (!item.text) text.style.color = 'var(--muted)';

    const actions = element('div', 'result-actions');
    const copyButton = makeButton('btn btn-primary btn-small', 'copy', '复制内容', async () => {
      try {
        await copy(item.text);
        setButtonLabel(copyButton, '已复制');
        notify('已复制到剪贴板');
        setTimeout(() => setButtonLabel(copyButton, '复制内容'), 1600);
      } catch (error) {
        log(error);
        notify('复制失败，请手动选择文本');
      }
    });
    actions.append(copyButton);

    if (item.href) {
      actions.append(
        makeLink(
          'btn btn-ghost btn-small',
          'open',
          ACTION_LABELS[item.kind] ?? '打开',
          item.href,
          item.kind,
        ),
      );
    }

    if (needsClamp) {
      const expandButton = makeButton('btn btn-ghost btn-small', 'expand', '展开全部', () => {
        const expanded = card.classList.toggle('is-expanded');
        setButtonLabel(expandButton, expanded ? '收起' : '展开全部');
        expandButton.setAttribute('aria-expanded', String(expanded));
      });
      expandButton.setAttribute('aria-expanded', 'false');
      actions.append(expandButton);
    }

    const details = element('dl', 'result-details');
    details.hidden = true;
    appendDetail(details, '码制', item.format);
    appendDetail(details, '版本', versionLabel(item.version));
    appendDetail(details, '纠错', item.ecLevel || '—');
    appendDetail(details, '字节', formatBytes(item.bytes));
    appendDetail(details, '旋转', `${item.rotation}°`);
    appendDetail(details, '反色', item.inverted ? '是' : '否');

    const detailButton = makeButton('btn btn-ghost btn-small', 'info', '详情', () => {
      details.hidden = !details.hidden;
      detailButton.setAttribute('aria-expanded', String(!details.hidden));
      setButtonLabel(detailButton, details.hidden ? '详情' : '收起详情');
    });
    detailButton.setAttribute('aria-expanded', 'false');
    actions.append(detailButton);

    card.append(top, text, actions, details);
    return card;
  };

  const renderResults = (items, elapsedMs) => {
    state.results = items;
    dom.resultItems?.replaceChildren();

    if (!items.length) {
      showNotice(
        '没有找到可识别的码',
        '试试更清晰、更完整的图片，或把码摆正、补上白边。也可以换一个角度再拍一张。',
      );
      return;
    }

    if (dom.emptyState) dom.emptyState.hidden = true;
    if (dom.resultNotice) dom.resultNotice.hidden = true;
    if (dom.resultLoading) dom.resultLoading.hidden = true;
    if (dom.resultItems) dom.resultItems.hidden = false;
    if (dom.resultCount) {
      dom.resultCount.textContent = String(items.length);
      dom.resultCount.hidden = false;
    }
    if (dom.resultsHint) {
      const timing = elapsedMs > 0 ? ` · ${elapsedMs} ms` : '';
      dom.resultsHint.textContent = `${items.length} 个码${timing}`;
    }
    items.forEach((item, index) => dom.resultItems?.append(createResultCard(item, index)));
  };

  const reset = () => {
    state.token += 1;
    setBusy(false);
    clearResults();
    clearOverlay();
    if (dom.dropIdle) dom.dropIdle.hidden = false;
    if (dom.dropPreview) dom.dropPreview.hidden = true;
    if (dom.previewCanvas) {
      dom.previewCanvas.width = 1;
      dom.previewCanvas.height = 1;
    }
    setStatus('正在识别…');
  };

  const pickFile = () => {
    if (!dom.fileInput) return;
    dom.fileInput.value = '';
    dom.fileInput.click();
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!isImage(file)) {
      notify('请选择图片文件');
      return;
    }

    const token = ++state.token;
    clearResults();
    clearOverlay();
    setStatus('正在识别…');
    setBusy(true);

    if (dom.dropIdle) dom.dropIdle.hidden = true;
    if (dom.dropPreview) dom.dropPreview.hidden = false;
    if (dom.previewCanvas) {
      dom.previewCanvas.width = 1;
      dom.previewCanvas.height = 1;
    }
    if (dom.previewName) dom.previewName.textContent = file.name || '剪贴板图片';
    if (dom.previewSize) dom.previewSize.textContent = '读取中…';

    try {
      const image = await loadImage(file);
      if (token !== state.token) return;

      drawPreview(image.canvas, image.width, image.height);
      if (dom.previewName) dom.previewName.textContent = file.name || '剪贴板图片';
      if (dom.previewSize) {
        dom.previewSize.textContent = `${image.originalWidth} × ${image.originalHeight}`;
      }

      const { results, elapsedMs } = await decode(image.imageData);
      if (token !== state.token) return;

      const items = results.map(summarize);
      drawOverlay(items, image.width, image.height);

      if (items.length) {
        setStatus(`识别到 ${items.length} 个码`, 'success');
      } else {
        setStatus('没有找到可识别的码', 'error');
      }
      renderResults(items, elapsedMs);
      if (items.length) remember(items);
    } catch (error) {
      if (token !== state.token) return;
      log(error);
      setStatus('图片处理失败', 'error');
      if (dom.previewSize) dom.previewSize.textContent = '无法读取';
      showNotice('这张图片没能解码', friendlyError(error));
    } finally {
      if (token === state.token) setBusy(false);
    }
  };

  const setCameraStatus = (text, error = false) => {
    if (!dom.cameraStatus) return;
    dom.cameraStatus.textContent = text;
    dom.cameraStatus.classList.toggle('is-error', error);
  };

  const stopCamera = () => {
    clearTimeout(cameraCloseTimer);
    cameraCloseTimer = null;
    cameraAbort?.abort();
    cameraAbort = null;
    cameraSession?.stop();
    cameraSession = null;
    dom.cameraVideo?.pause?.();
    if (dom.cameraVideo) dom.cameraVideo.srcObject = null;
  };

  const closeCamera = () => {
    stopCamera();
    if (dom.cameraDialog?.open) dom.cameraDialog.close();
    dom.cameraOverlay?.replaceChildren();
    if (dom.cameraHint) dom.cameraHint.hidden = false;
    if (dom.cameraScanline) dom.cameraScanline.hidden = false;
    if (dom.cameraRetry) dom.cameraRetry.hidden = true;
  };

  const openCamera = () => {
    if (!dom.cameraDialog || !dom.cameraVideo || !dom.cameraCanvas) {
      notify('当前浏览器不支持摄像头');
      return;
    }

    stopCamera();
    const wasBusy = state.busy;
    state.token += 1;
    setBusy(false);
    if (wasBusy) clearResults();

    if (!dom.cameraDialog.open) {
      if (typeof dom.cameraDialog.showModal === 'function') dom.cameraDialog.showModal();
      else dom.cameraDialog.setAttribute('open', '');
    }

    dom.cameraOverlay?.replaceChildren();
    if (dom.cameraHint) dom.cameraHint.hidden = false;
    if (dom.cameraScanline) dom.cameraScanline.hidden = false;
    if (dom.cameraRetry) dom.cameraRetry.hidden = true;
    setCameraStatus('正在打开摄像头…');

    const controller = new AbortController();
    cameraAbort = controller;

    startCamera({
      video: dom.cameraVideo,
      canvas: dom.cameraCanvas,
      decode,
      signal: controller.signal,
      onStatus: (kind, detail) => {
        if (controller.signal.aborted) return;
        if (kind === 'ready') {
          setCameraStatus('把二维码对准取景框');
          return;
        }
        if (kind === 'error') {
          log(detail);
          setCameraStatus(cameraError(detail), true);
          if (dom.cameraRetry) dom.cameraRetry.hidden = false;
          if (dom.cameraHint) dom.cameraHint.hidden = true;
          if (dom.cameraScanline) dom.cameraScanline.hidden = true;
        }
      },
      onResult: (result, frame) => {
        if (controller.signal.aborted) return;

        const items = [summarize(result)];
        drawPreview(frame.canvas, frame.width, frame.height);
        if (dom.dropIdle) dom.dropIdle.hidden = true;
        if (dom.dropPreview) dom.dropPreview.hidden = false;
        if (dom.previewName) dom.previewName.textContent = '摄像头截图';
        if (dom.previewSize) dom.previewSize.textContent = `${frame.width} × ${frame.height}`;
        drawOverlay(items, frame.width, frame.height);
        setStatus('识别到 1 个码', 'success');
        renderResults(items, frame.elapsedMs ?? 0);
        remember(items);
        setBusy(false);

        if (dom.cameraOverlay) {
          dom.cameraOverlay.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
          dom.cameraOverlay.innerHTML = overlayMarkup(items, frame.width, frame.height);
        }
        if (dom.cameraHint) dom.cameraHint.hidden = true;
        if (dom.cameraScanline) dom.cameraScanline.hidden = true;
        setCameraStatus('识别成功，正在返回结果…');
        cameraSession = null;
        cameraCloseTimer = setTimeout(closeCamera, 700);
      },
    })
      .then((session) => {
        if (controller.signal.aborted) {
          session.stop();
          return;
        }
        cameraSession = session;
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        log(error);
        setCameraStatus(cameraError(error), true);
        if (dom.cameraRetry) dom.cameraRetry.hidden = false;
      });
  };

  const hasFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const isImage = (file) =>
    Boolean(file) &&
    (String(file.type ?? '').startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|svg|bmp|avif|heic|heif)$/i.test(file.name ?? ''));

  const onDragEnter = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dom.dropzone?.classList.add('is-dragging');
  };

  const onDragOver = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dom.dropzone?.classList.remove('is-dragging');
  };

  const onDrop = (event) => {
    event.preventDefault();
    dragDepth = 0;
    dom.dropzone?.classList.remove('is-dragging');
    const files = Array.from(event.dataTransfer?.files ?? []);
    const image = files.find(isImage);
    if (image) handleFile(image);
    else if (files.length) notify('这里只接收图片文件');
  };

  const onPaste = (event) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageItem = items.find(
      (item) => item.kind === 'file' && String(item.type).startsWith('image/'),
    );
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    handleFile(file);
  };

  const init = () => {
    clearResults();
    clearOverlay();
    renderHistory();

    dom.pickBtn?.addEventListener('click', pickFile);
    dom.resetBtn?.addEventListener('click', pickFile);
    dom.dropIdle?.addEventListener('click', (event) => {
      if (event.target.closest('button, a, input')) return;
      event.stopPropagation();
      pickFile();
    });
    dom.dropzone?.addEventListener('click', (event) => {
      if (!dom.dropPreview?.hidden) return;
      if (event.target.closest('button, a, input')) return;
      pickFile();
    });

    dom.fileInput?.addEventListener('change', () => {
      const file = dom.fileInput.files?.[0];
      if (file) handleFile(file);
    });

    dom.dropzone?.addEventListener('dragenter', onDragEnter);
    dom.dropzone?.addEventListener('dragover', onDragOver);
    dom.dropzone?.addEventListener('dragleave', onDragLeave);
    dom.dropzone?.addEventListener('drop', onDrop);
    document.addEventListener('dragover', (event) => {
      if (hasFiles(event)) event.preventDefault();
    });
    document.addEventListener('drop', (event) => {
      if (hasFiles(event)) event.preventDefault();
    });
    document.addEventListener('paste', onPaste);

    dom.cameraBtn?.addEventListener('click', openCamera);
    dom.cameraClose?.addEventListener('click', closeCamera);
    dom.cameraRetry?.addEventListener('click', () => {
      stopCamera();
      openCamera();
    });
    dom.cameraDialog?.addEventListener('close', stopCamera);

    dom.historyClear?.addEventListener('click', () => {
      state.history = [];
      clearHistory(storage);
      renderHistory();
      notify('已清空历史记录');
    });

    dom.sampleBtn?.addEventListener('click', () => {
      if (deps.loadSample) deps.loadSample();
      else notify('示例图片还没准备好');
    });

    if (warmup && typeof ImageData !== 'undefined') {
      const run = () => {
        const blank = new ImageData(new Uint8ClampedArray(64 * 64 * 4).fill(255), 64, 64);
        decode(blank, { formats: ['QRCode'], deep: false, maxSymbols: 1 }).catch(() => {});
      };
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 2500 });
      } else {
        setTimeout(run, 1200);
      }
    }
  };

  return { init, handleFile, reset, renderResults, state };
}
