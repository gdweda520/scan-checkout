(() => {
  'use strict';

  const STORE_KEY = 'pos_demo_v1';

  const SEED_PRODUCTS = [
    { code: 'SP001', name: '冰美式', price: 12 },
    { code: 'SP002', name: '生椰拿铁', price: 16 },
    { code: 'SP003', name: '手工蛋挞', price: 6.5 },
    { code: 'SP004', name: '芝士贝果', price: 9 },
    { code: '6901234567890', name: '柠檬茶 500ml', price: 5 },
    { code: '6909876543210', name: '牛肉卷', price: 18 },
  ];

  /* ---------------- 工具 ---------------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const pad = (n) => String(n).padStart(2, '0');
  const initial = (name) => (name ? name.trim().slice(0, 1) : '?');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatFull(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /* ---------------- 状态 ---------------- */

  function normalize(data) {
    return {
      products: (data.products || []).map((p) => ({
        code: String(p.code || '').trim(),
        name: String(p.name || ''),
        price: round2(Math.max(0, Number(p.price) || 0)),
      })).filter((p) => p.code),
      cart: (data.cart || []).filter((c) => c && c.code).map((c) => ({
        code: String(c.code),
        qty: Math.max(1, Math.floor(Number(c.qty) || 1)),
      })),
      orders: (data.orders || []).map((o) => ({
        id: o.id || uid(),
        no: String(o.no || ''),
        items: Array.isArray(o.items) ? o.items : [],
        count: Number(o.count) || 0,
        total: round2(Number(o.total) || 0),
        createdAt: Number(o.createdAt) || Date.now(),
      })),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products)) return normalize(parsed);
      }
    } catch (e) { /* 忽略损坏的本地数据 */ }
    return normalize({ products: SEED_PRODUCTS, cart: [], orders: [] });
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* 隐私模式下写入失败，忽略 */ }
  }

  let state = loadState();
  let currentTab = 'scan';
  let lastScan = null;

  const findProduct = (code) => state.products.find((p) => p.code.toLowerCase() === String(code).toLowerCase());

  function cartLines() {
    return state.cart
      .map((entry) => {
        const p = findProduct(entry.code);
        if (!p) return null;
        return { code: p.code, name: p.name, price: p.price, qty: entry.qty, subtotal: round2(p.price * entry.qty) };
      })
      .filter(Boolean);
  }

  const sumOf = (lines) => round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const countOf = (lines) => lines.reduce((s, l) => s + l.qty, 0);

  /* ---------------- DOM ---------------- */

  const els = {
    video: $('#video'),
    scanner: $('#scanner'),
    btnCamera: $('#btn-camera'),
    btnPhoto: $('#btn-photo'),
    btnSelftest: $('#btn-selftest'),
    engineLine: $('#engine-line'),
    permLine: $('#perm-line'),
    photoInput: $('#photo-input'),
    secureHint: $('#secure-hint'),
    scanStatus: $('#scan-status'),
    manualForm: $('#manual-form'),
    manualCode: $('#manual-code'),
    demoChips: $('#demo-chips'),
    lastScanCard: $('#last-scan-card'),
    pillCount: $('#pill-count'),
    pillTotal: $('#pill-total'),
    tabCartBadge: $('#tab-cart-badge'),
    cartList: $('#cart-list'),
    cartEmpty: $('#cart-empty'),
    btnClear: $('#btn-clear'),
    checkoutBar: $('#checkout-bar'),
    checkoutCount: $('#checkout-count'),
    checkoutTotal: $('#checkout-total'),
    btnCheckout: $('#btn-checkout'),
    goodsList: $('#goods-list'),
    goodsCount: $('#goods-count'),
    goodsSearch: $('#goods-search'),
    btnAddProduct: $('#btn-add-product'),
    btnLabels: $('#btn-labels'),
    btnReset: $('#btn-reset'),
    ordersList: $('#orders-list'),
    ordersEmpty: $('#orders-empty'),
    orderStats: $('#order-stats'),
    toastWrap: $('#toast-wrap'),
    modalRoot: $('#modal-root'),
  };

  /* ---------------- 提示 ---------------- */

  let audioCtx = null;

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    els.toastWrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 240);
    }, 1600);
  }

  function feedback(ok = true) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = ok ? 1046 : 320;
      osc.connect(gain).connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) { /* 声音不是必需的 */ }
    if (navigator.vibrate) navigator.vibrate(ok ? 35 : [40, 60, 40]);
  }

  /* ---------------- 弹层 ---------------- */

  function closeSheet() {
    const mask = $('.sheet-mask');
    if (!mask) return;
    mask.classList.remove('show');
    document.body.classList.remove('no-scroll');
    setTimeout(() => mask.remove(), 220);
  }

  function openSheet({ title, body, actions = [], onMount }) {
    closeSheet();
    const mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" data-close aria-label="关闭">✕</button>
        </div>
        <div class="sheet-body">${body}</div>
        <div class="sheet-foot">
          ${actions.map((a) => `<button class="btn ${a.kind || 'ghost'}" data-action="${a.key}">${esc(a.label)}</button>`).join('')}
        </div>
      </div>`;
    els.modalRoot.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('show'));
    document.body.classList.add('no-scroll');

    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('[data-close]')) closeSheet();
    });
    actions.forEach((a) => {
      const btn = mask.querySelector(`[data-action="${a.key}"]`);
      if (btn) btn.addEventListener('click', () => (a.onClick ? a.onClick(mask) : closeSheet()));
    });
    if (onMount) onMount(mask);
    return mask;
  }

  /* ---------------- 渲染 ---------------- */

  function renderChrome() {
    const lines = cartLines();
    const total = sumOf(lines);
    const count = countOf(lines);

    els.pillCount.textContent = `${count} 件`;
    els.pillTotal.textContent = `¥${money(total)}`;
    els.checkoutCount.textContent = `${count} 件商品`;
    els.checkoutTotal.textContent = `¥${money(total)}`;
    els.checkoutBar.hidden = !(currentTab === 'cart' && count > 0);

    els.tabCartBadge.hidden = count === 0;
    els.tabCartBadge.textContent = count > 99 ? '99+' : String(count);

    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === currentTab));
    $$('.view').forEach((v) => { v.hidden = v.id !== `view-${currentTab}`; });

    els.demoChips.innerHTML = state.products.slice(0, 3).map((p) => (
      `<button class="chip" data-demo="${esc(p.code)}">${esc(p.name)} ¥${money(p.price)}</button>`
    )).join('');
  }

  function renderCart() {
    const lines = cartLines();
    els.cartList.innerHTML = lines.map((l) => `
      <div class="cart-item">
        <div class="avatar">${esc(initial(l.name))}</div>
        <div class="ci-body">
          <div class="ci-top">
            <span class="ci-name">${esc(l.name)}</span>
            <span class="ci-sum">¥${money(l.subtotal)}</span>
          </div>
          <div class="ci-bot">
            <span class="ci-price">¥${money(l.price)} / 件</span>
            <div class="stepper">
              <button data-act="dec" data-code="${esc(l.code)}" aria-label="减少">−</button>
              <span>${l.qty}</span>
              <button data-act="inc" data-code="${esc(l.code)}" aria-label="增加">+</button>
            </div>
          </div>
        </div>
      </div>`).join('');
    els.cartEmpty.hidden = lines.length > 0;
    els.cartList.hidden = lines.length === 0;
  }

  function renderGoods() {
    const q = els.goodsSearch.value.trim().toLowerCase();
    const list = state.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    els.goodsCount.textContent = `(${list.length}/${state.products.length})`;
    els.goodsList.innerHTML = list.map((p) => `
      <div class="list-item">
        <button class="item-tap" data-act="edit-product" data-code="${esc(p.code)}">
          <div class="avatar">${esc(initial(p.name))}</div>
          <div class="item-main">
            <div class="item-title">${esc(p.name)}</div>
            <div class="item-sub">${esc(p.code)}</div>
          </div>
          <div class="item-price">¥${money(p.price)}</div>
        </button>
        <button class="icon-btn del" data-act="del-product" data-code="${esc(p.code)}" aria-label="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 12.1A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>
          </svg>
        </button>
      </div>`).join('');
  }

  function renderOrders() {
    const now = new Date();
    const isToday = (o) => {
      const d = new Date(o.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    const todayOrders = state.orders.filter(isToday);
    const todayAmount = round2(todayOrders.reduce((s, o) => s + o.total, 0));

    els.orderStats.innerHTML = `
      <div class="stat"><span>今日单数</span><b>${todayOrders.length}</b></div>
      <div class="stat"><span>今日营业额</span><b>¥${money(todayAmount)}</b></div>
      <div class="stat"><span>累计单数</span><b>${state.orders.length}</b></div>`;

    els.ordersList.innerHTML = state.orders.map((o) => `
      <div class="list-item">
        <button class="item-tap" data-act="view-order" data-id="${esc(o.id)}">
          <div class="item-main">
            <div class="item-title">${esc(o.no || '未编号')}</div>
            <div class="item-sub">${esc(formatTime(o.createdAt))}</div>
          </div>
          <div class="order-total">
            <b>¥${money(o.total)}</b>
            <span>${o.count} 件</span>
          </div>
        </button>
      </div>`).join('');
    els.ordersEmpty.hidden = state.orders.length > 0;
  }

  function renderLastScan() {
    if (!lastScan) {
      els.lastScanCard.hidden = true;
      return;
    }
    els.lastScanCard.hidden = false;
    els.lastScanCard.innerHTML = `
      <div class="avatar">${esc(initial(lastScan.name))}</div>
      <div class="last-scan-main">
        <div class="t">最近加入 · ${esc(lastScan.name)}</div>
        <div class="s">¥${money(lastScan.price)} · 已加入购物车</div>
      </div>
      <button class="btn ghost sm" data-goto="cart">去结算</button>`;
  }

  function renderAll() {
    renderChrome();
    renderCart();
    renderGoods();
    renderOrders();
    renderLastScan();
  }

  /* ---------------- 商品码处理 ---------------- */

  function normalizeCode(raw) {
    let v = String(raw || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) {
      try {
        const url = new URL(v);
        v = url.searchParams.get('code') || url.searchParams.get('c')
          || decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      } catch (e) { /* 非法 URL 就当普通文本 */ }
    }
    return v.replace(/^SPOS[:|]/i, '').trim();
  }

  function addToCart(code, qty = 1) {
    const product = findProduct(code);
    if (!product) return null;
    const line = state.cart.find((c) => c.code === product.code);
    if (line) line.qty += qty;
    else state.cart.push({ code: product.code, qty });
    saveState();
    renderAll();
    return product;
  }

  function changeQty(code, delta) {
    const line = state.cart.find((c) => c.code === code);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) state.cart = state.cart.filter((c) => c.code !== code);
    saveState();
    renderAll();
  }

  function handleScan(raw) {
    const code = normalizeCode(raw);
    if (!code) return;
    const product = addToCart(code);
    if (product) {
      lastScan = { name: product.name, price: product.price, code: product.code };
      renderLastScan();
      feedback(true);
      toast(`已加入 · ${product.name} ¥${money(product.price)}`);
    } else {
      feedback(false);
      toast(`未找到商品码 ${code}`);
      openUnknownSheet(code);
    }
  }

  function openUnknownSheet(code) {
    openSheet({
      title: '这个商品码还没录入',
      body: `<p class="sheet-text">商品码 <b>${esc(code)}</b> 暂无对应商品。录入名称和价格后即可直接扫码加车。</p>`,
      actions: [
        { label: '取消', key: 'cancel' },
        {
          label: '立即录入',
          key: 'add',
          kind: 'primary',
          onClick: () => {
            closeSheet();
            switchTab('goods');
            openProductSheet(null, code);
          },
        },
      ],
    });
  }

  /* ---------------- 摄像头扫码 ---------------- */

  const camera = {
    stream: null,
    timer: null,
    detector: null,
    canvas: document.createElement('canvas'),
    running: false,
    startedAt: 0,
    lastRaw: '',
    lastAt: 0,
  };

  function setScanStatus(text, isError = false) {
    if (!els.scanStatus) return;
    els.scanStatus.hidden = false;
    els.scanStatus.classList.toggle('error', Boolean(isError));
    if (els.scanStatus.textContent !== text) els.scanStatus.textContent = text;
  }

  /* ZXing：统一解码二维码 + 各类条形码（原生 BarcodeDetector 不可用时的兜底） */
  let zxReader = null;
  let zxHints = null;

  function zxingDecode(ctx, w, h) {
    const Z = window.ZXing;
    if (!Z) return '';
    try {
      if (!zxReader) {
        zxHints = new Map();
        zxHints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
          Z.BarcodeFormat.QR_CODE,
          Z.BarcodeFormat.EAN_13,
          Z.BarcodeFormat.EAN_8,
          Z.BarcodeFormat.UPC_A,
          Z.BarcodeFormat.UPC_E,
          Z.BarcodeFormat.CODE_128,
          Z.BarcodeFormat.CODE_39,
          Z.BarcodeFormat.CODE_93,
          Z.BarcodeFormat.ITF,
          Z.BarcodeFormat.CODABAR,
          Z.BarcodeFormat.DATA_MATRIX,
          Z.BarcodeFormat.AZTEC,
          Z.BarcodeFormat.PDF_417,
        ]);
        zxHints.set(Z.DecodeHintType.TRY_HARDER, true);
        zxReader = new Z.MultiFormatReader();
      }
      // ZXing 的 RGBLuminanceSource 需要单通道灰度数据
      const rgba = ctx.getImageData(0, 0, w, h).data;
      const gray = new Uint8ClampedArray(w * h);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 1) {
        gray[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      }
      const source = new Z.RGBLuminanceSource(gray, w, h);
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(source));
      const result = zxReader.decode(bitmap, zxHints);
      return result ? String(result.getText() || '') : '';
    } catch (e) {
      return '';
    }
  }

  /* 内置自检：不依赖摄像头，直接解码页面内部生成的二维码和条形码 */
  function setEngineLine(text, isError = false) {
    if (!els.engineLine) return;
    els.engineLine.hidden = !text;
    els.engineLine.classList.toggle('error', Boolean(isError));
    els.engineLine.textContent = text;
  }

  function drawQrSample(canvas, text) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const cell = 6;
    const margin = 4;
    const size = (n + margin * 2) * cell;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (qr.isDark(y, x)) ctx.fillRect((x + margin) * cell, (y + margin) * cell, cell, cell);
      }
    }
  }

  function drawEanSample(canvas, digits) {
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
    const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
    const parity = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    const d = digits.split('').map(Number);
    const seq = parity[d[0]];
    let bits = '101';
    for (let i = 1; i <= 6; i += 1) bits += (seq[i - 1] === 'L' ? L : G)[d[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i += 1) bits += R[d[i]];
    bits += '101';

    const module = 4;
    const quiet = 12;
    canvas.width = (bits.length + quiet * 2) * module;
    canvas.height = 96;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let i = 0; i < bits.length; i += 1) {
      if (bits[i] === '1') ctx.fillRect((i + quiet) * module, 8, module, canvas.height - 16);
    }
  }

  function runScanSelfTest() {
    if (!window.ZXing) {
      setEngineLine('识别引擎未加载：请下拉强制刷新页面', true);
      return;
    }
    const canvas = document.createElement('canvas');
    let qrOk = false;
    let barOk = false;
    try {
      drawQrSample(canvas, 'SP001');
      qrOk = zxingDecode(canvas.getContext('2d', { willReadFrequently: true }), canvas.width, canvas.height) === 'SP001';
    } catch (e) { qrOk = false; }
    try {
      drawEanSample(canvas, '6901234567892');
      barOk = zxingDecode(canvas.getContext('2d', { willReadFrequently: true }), canvas.width, canvas.height) === '6901234567892';
    } catch (e) { barOk = false; }
    const ok = qrOk && barOk;
    setEngineLine(
      `引擎自检：二维码 ${qrOk ? '正常' : '失败'} · 条形码 ${barOk ? '正常' : '失败'}${ok ? '（引擎可用）' : '（请下拉强制刷新页面）'}`,
      !ok,
    );
  }

  function showSecureHint() {
    if (!els.secureHint.hidden) return;
    els.secureHint.hidden = false;
    els.secureHint.textContent = '当前不是 HTTPS 环境，手机浏览器会拒绝摄像头权限。可以改用「拍照识别」或手动输入商品码；正式使用时把页面部署到 HTTPS 即可直接扫码。';
  }

  async function startCamera() {
    if (camera.running) return;
    if (!window.isSecureContext) {
      showSecureHint();
      toast('需要 HTTPS 才能调用摄像头');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanStatus('当前浏览器不支持调用摄像头，请改用拍照识别', true);
      toast('当前浏览器不支持摄像头调用');
      return;
    }

    // 用 token 让"超时后迟到的授权结果"自动作废
    const token = (camera.startToken = (camera.startToken || 0) + 1);
    els.btnCamera.disabled = true;
    els.btnCamera.textContent = '正在启动…';
    setScanStatus('正在启动摄像头…（如弹出权限请求请点允许）');

    const timeout = setTimeout(() => {
      if (token !== camera.startToken || camera.running) return;
      camera.startToken += 1;
      stopCamera();
      setScanStatus('摄像头启动超时：可能被浏览器阻止，请改用拍照识别或手动输入', true);
      toast('摄像头启动超时');
    }, 12000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (token !== camera.startToken) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      clearTimeout(timeout);
      camera.stream = stream;
      els.video.srcObject = camera.stream;
      try {
        await els.video.play();
      } catch (e) {
        // 部分手机浏览器会拦截非手势触发的播放，点一下画面即可恢复
        toast('点一下扫码画面开始取景');
      }
      els.scanner.classList.add('live');
      els.btnCamera.disabled = false;
      els.btnCamera.textContent = '停止扫码';

      if ('BarcodeDetector' in window) {
        try {
          camera.detector = new window.BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf'],
          });
        } catch (e) {
          camera.detector = null;
        }
      }
      camera.running = true;
      camera.startedAt = Date.now();
      setScanStatus('正在识别…把二维码或条形码放进框内');
      cameraLoop();
      toast('摄像头已开启，对准商品码');
    } catch (err) {
      clearTimeout(timeout);
      if (token !== camera.startToken) return;
      const name = (err && err.name) || '';
      stopCamera();
      if (name === 'NotAllowedError') {
        setScanStatus('摄像头权限被拒绝：请在浏览器设置里允许使用相机，或改用拍照识别', true);
        toast('摄像头权限被拒绝');
        refreshPermLine();
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setScanStatus('没有找到可用的摄像头', true);
        toast('没有找到可用的摄像头');
      } else {
        setScanStatus(`摄像头开启失败：${name || '未知错误'}，可改用拍照识别`, true);
        toast('摄像头开启失败，可改用拍照识别');
      }
    }
  }

  function stopCamera() {
    camera.running = false;
    clearTimeout(camera.timer);
    camera.timer = null;
    if (camera.stream) {
      camera.stream.getTracks().forEach((t) => t.stop());
      camera.stream = null;
    }
    els.video.srcObject = null;
    els.scanner.classList.remove('live');
    els.btnCamera.disabled = false;
    els.btnCamera.textContent = '开启摄像头';
    if (els.scanStatus) {
      els.scanStatus.hidden = true;
      els.scanStatus.classList.remove('error');
    }
  }

  async function cameraLoop() {
    if (!camera.running) return;
    try {
      await detectFrame();
    } catch (err) {
      console.error('[scan]', err);
      setScanStatus(`识别出错：${(err && err.name) || '未知'}`, true);
    }
    if (!camera.running) return;
    camera.timer = setTimeout(cameraLoop, 140);
  }

  async function detectFrame() {
    const video = els.video;
    if (!video.videoWidth) {
      setScanStatus('等待摄像头画面…');
      return;
    }

    // 只解码画面中间区域：二维码在图像里占比更大，识别率明显更高
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = Math.round(vw * 0.72);
    const cropH = Math.round(vh * 0.72);
    const sx = Math.round((vw - cropW) / 2);
    const sy = Math.round((vh - cropH) / 2);
    const scale = Math.min(1, 960 / Math.max(cropW, cropH));
    const w = Math.round(cropW * scale);
    const h = Math.round(cropH * scale);

    const canvas = camera.canvas;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, w, h);

    let raw = '';
    if (camera.detector) {
      try {
        const found = await camera.detector.detect(canvas);
        if (found && found.length) raw = found[0].rawValue || '';
      } catch (e) { /* 原生识别失败时退回 ZXing */ }
    }
    if (!raw) raw = zxingDecode(ctx, w, h);
    if (!raw) {
      const hint = Date.now() - camera.startedAt > 9000 ? '还没识别到码 · 可点下方「拍照识别」' : '正在识别…把二维码或条形码放进框内';
      setScanStatus(hint);
      return;
    }

    const now = Date.now();
    if (raw === camera.lastRaw && now - camera.lastAt < 2200) return;
    camera.lastRaw = raw;
    camera.lastAt = now;
    setScanStatus(`已识别：${raw.slice(0, 20)}`);
    handleScan(raw);
  }

  function scanPhoto(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const code = zxingDecode(ctx, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      if (code) {
        setScanStatus(`已识别：${code.slice(0, 20)}`);
        handleScan(code);
      } else {
        toast('照片里没识别到码，靠近一点再拍');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast('图片读取失败');
    };
    img.src = url;
  }

  /* ---------------- 商品管理 ---------------- */

  function nextCode() {
    const used = new Set(state.products.map((p) => p.code.toUpperCase()));
    let n = 1;
    while (used.has(`SP${String(n).padStart(3, '0')}`)) n += 1;
    return `SP${String(n).padStart(3, '0')}`;
  }

  function openProductSheet(product = null, presetCode = '') {
    const isEdit = Boolean(product);
    const body = `
      <label class="field">
        <span>商品名称</span>
        <input id="f-name" maxlength="24" placeholder="例：冰美式" value="${esc(isEdit ? product.name : '')}">
      </label>
      <label class="field">
        <span>商品码</span>
        <div class="inline">
          <input id="f-code" placeholder="例：SP001 或条形码" autocomplete="off" value="${esc(isEdit ? product.code : presetCode)}">
          <button class="btn ghost sm" id="f-gen" type="button">自动生成</button>
        </div>
        <small>扫码按这个码匹配：二维码标签和商品条形码都认</small>
      </label>
      <label class="field">
        <span>单价（元）</span>
        <input id="f-price" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${isEdit ? product.price : ''}">
      </label>`;

    openSheet({
      title: isEdit ? '编辑商品' : '新增商品',
      body,
      actions: [
        { label: '取消', key: 'cancel' },
        {
          label: '保存',
          key: 'save',
          kind: 'primary',
          onClick: (sheet) => {
            const name = $('#f-name', sheet).value.trim();
            const code = $('#f-code', sheet).value.trim();
            const price = parseFloat($('#f-price', sheet).value);

            if (!name) return toast('请填写商品名称');
            if (!code) return toast('请填写商品码');
            if (!(price >= 0)) return toast('请填写正确的单价');

            const dup = state.products.find((p) => p.code.toLowerCase() === code.toLowerCase() && p !== product);
            if (dup) return toast('这个商品码已被其他商品占用');

            if (isEdit) {
              if (product.code !== code) {
                state.cart.forEach((c) => { if (c.code === product.code) c.code = code; });
              }
              Object.assign(product, { name, code, price: round2(price) });
            } else {
              state.products.push({ name, code, price: round2(price) });
            }
            saveState();
            renderAll();
            closeSheet();
            toast(isEdit ? '已保存' : '商品已添加');
          },
        },
      ],
      onMount: (sheet) => {
        $('#f-gen', sheet).addEventListener('click', () => {
          $('#f-code', sheet).value = nextCode();
        });
        setTimeout(() => $('#f-name', sheet).focus(), 150);
      },
    });
  }

  function deleteProduct(code) {
    const product = findProduct(code);
    if (!product) return;
    openSheet({
      title: '删除商品',
      body: `<p class="sheet-text">确定删除「${esc(product.name)}」（${esc(product.code)}）吗？删除后该商品码将无法扫码加车。</p>`,
      actions: [
        { label: '取消', key: 'cancel' },
        {
          label: '删除',
          key: 'del',
          kind: 'danger',
          onClick: () => {
            state.products = state.products.filter((p) => p.code !== code);
            state.cart = state.cart.filter((c) => c.code !== code);
            saveState();
            renderAll();
            closeSheet();
            toast('已删除');
          },
        },
      ],
    });
  }

  /* ---------------- 结算 / 订单 ---------------- */

  function nextOrderNo(date) {
    const key = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    const todayCount = state.orders.filter((o) => o.no.startsWith(key)).length + 1;
    return `${key}-${pad(todayCount)}`;
  }

  function openCheckoutSheet() {
    const lines = cartLines();
    if (!lines.length) return toast('购物车是空的');

    const total = sumOf(lines);
    const body = `
      <div class="co-list">
        ${lines.map((l) => `<div class="co-row"><span>${esc(l.name)}<em>×${l.qty}</em></span><b>¥${money(l.subtotal)}</b></div>`).join('')}
      </div>
      <div class="co-total"><span>应收合计</span><strong>¥${money(total)}</strong></div>
      <p class="sheet-text">确认后生成订单记录并清空购物车。</p>`;

    openSheet({
      title: '结算确认',
      body,
      actions: [
        { label: '再想想', key: 'cancel' },
        { label: '确认收款', key: 'ok', kind: 'primary', onClick: () => { closeSheet(); settle(); } },
      ],
    });
  }

  function settle() {
    const lines = cartLines();
    if (!lines.length) return;
    const now = new Date();
    const order = {
      id: uid(),
      no: nextOrderNo(now),
      items: lines.map((l) => ({ code: l.code, name: l.name, price: l.price, qty: l.qty, subtotal: l.subtotal })),
      count: countOf(lines),
      total: sumOf(lines),
      createdAt: now.getTime(),
    };
    state.orders.unshift(order);
    state.cart = [];
    lastScan = null;
    saveState();
    renderAll();
    feedback(true);
    switchTab('orders');
    toast('结算成功');
    openReceiptSheet(order, true);
  }

  function openReceiptSheet(order, justPaid = false) {
    const body = `
      <div class="receipt">
        <div class="receipt-head">
          <h4>随手收银 · 小票</h4>
          <p>${esc(formatFull(order.createdAt))}</p>
          <p>单号 ${esc(order.no)}</p>
        </div>
        <div class="receipt-items">
          ${order.items.map((i) => `<div class="r-row"><span>${esc(i.name)}<em> ×${i.qty}</em></span><span>¥${money(i.subtotal)}</span></div>`).join('')}
        </div>
        <div class="r-total"><span>合计</span><strong>¥${money(order.total)}</strong></div>
        <p class="receipt-foot">共 ${order.count} 件商品 · 谢谢惠顾</p>
      </div>`;

    openSheet({
      title: justPaid ? '收款成功' : '订单详情',
      body,
      actions: [
        { label: '关闭', key: 'close' },
        { label: '打印小票', key: 'print', kind: 'primary', onClick: () => printReceipt(order) },
      ],
    });
  }

  /* ---------------- 打印 ---------------- */

  function printWindow(title, bodyHtml, extraCss = '') {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) return toast('浏览器拦截了打印窗口，请允许弹窗');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      *{box-sizing:border-box}
      body{margin:0;padding:12px;color:#111;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
      .label{border:1px dashed #ccc;border-radius:8px;padding:6px;text-align:center;break-inside:avoid}
      .label-qr{aspect-ratio:1;display:grid;place-items:center}
      .label-qr svg{width:100%;height:100%}
      .label-name{font-size:11px;font-weight:600;margin-top:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .label-meta{font-size:9px;color:#666;font-family:monospace}
      .labels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      @page{margin:8mm}
      ${extraCss}
    </style></head><body>${bodyHtml}<script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script></body></html>`);
    win.document.close();
  }

  function printReceipt(order) {
    const body = `
      <div style="width:300px;margin:0 auto;font-family:ui-monospace,monospace">
        <div style="text-align:center;padding-bottom:10px;border-bottom:1px dashed #ccc">
          <div style="font-size:14px;font-weight:700;letter-spacing:1px">随手收银 · 小票</div>
          <div style="font-size:11px;color:#555;margin-top:4px">${esc(formatFull(order.createdAt))}</div>
          <div style="font-size:11px;color:#555">单号 ${esc(order.no)}</div>
        </div>
        <div style="padding:10px 0">
          ${order.items.map((i) => `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span>${esc(i.name)} ×${i.qty}</span><span>¥${money(i.subtotal)}</span></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px dashed #ccc;font-size:13px">
          <span>合计</span><strong style="font-size:18px">¥${money(order.total)}</strong>
        </div>
        <div style="text-align:center;font-size:11px;color:#555;padding-top:12px">共 ${order.count} 件商品 · 谢谢惠顾</div>
      </div>`;
    printWindow(`小票 ${order.no}`, body);
  }

  function makeQrSvg(text) {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
    } catch (e) {
      return '';
    }
  }

  function openLabelsSheet() {
    if (!state.products.length) return toast('还没有商品可以生成标签');
    const labels = state.products.map((p) => `
      <div class="label">
        <div class="label-qr">${makeQrSvg(p.code)}</div>
        <div class="label-name">${esc(p.name)}</div>
        <div class="label-meta">${esc(p.code)} · ¥${money(p.price)}</div>
      </div>`).join('');

    openSheet({
      title: '商品二维码标签',
      body: `<p class="sheet-text" style="margin-bottom:10px">打印后贴在商品或货架上，扫这个二维码就能识别并加车。</p><div class="labels">${labels}</div>`,
      actions: [
        { label: '关闭', key: 'close' },
        { label: '打印标签', key: 'print', kind: 'primary', onClick: () => printWindow('商品二维码标签', `<div class="labels">${labels}</div>`) },
      ],
    });
  }

  /* ---------------- 清空 / 重置 ---------------- */

  function clearCart() {
    if (!state.cart.length) return toast('购物车已经是空的');
    state.cart = [];
    lastScan = null;
    saveState();
    renderAll();
    toast('购物车已清空');
  }

  function resetData() {
    openSheet({
      title: '恢复示例数据',
      body: '<p class="sheet-text">会用内置示例商品替换当前商品、购物车和订单记录，此操作不可撤销。</p>',
      actions: [
        { label: '取消', key: 'cancel' },
        {
          label: '确认恢复',
          key: 'ok',
          kind: 'danger',
          onClick: () => {
            state = normalize({ products: SEED_PRODUCTS, cart: [], orders: [] });
            lastScan = null;
            saveState();
            renderAll();
            closeSheet();
            toast('已恢复示例数据');
          },
        },
      ],
    });
  }

  /* ---------------- 切换视图 ---------------- */

  function switchTab(tab) {
    currentTab = tab;
    if (tab !== 'scan') stopCamera();
    renderChrome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 事件绑定 ---------------- */

  function inAppBrowser() {
    return /MicroMessenger|QQ\/|AlipayClient|Weibo|baiduboxapp|DingTalk/i.test(navigator.userAgent || '');
  }

  function setPermLine(text, isError = false) {
    if (!els.permLine) return;
    els.permLine.hidden = !text;
    els.permLine.classList.toggle('error', Boolean(isError));
    els.permLine.textContent = text;
  }

  async function refreshPermLine() {
    if (!window.isSecureContext) {
      setPermLine('当前不是 HTTPS 地址：浏览器会直接禁用摄像头，只能用拍照识别或手动输入', true);
      return;
    }
    if (inAppBrowser()) {
      setPermLine('当前是 App 内置浏览器：可能不允许调用摄像头，请点右上角「在浏览器打开」', true);
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermLine('当前浏览器不支持调用摄像头，请改用拍照识别', true);
      return;
    }
    let state = 'unknown';
    try {
      const status = await navigator.permissions.query({ name: 'camera' });
      state = status.state;
    } catch (e) {
      state = 'unknown';
    }
    if (state === 'granted') setPermLine('相机权限：已允许');
    else if (state === 'denied') {
      setPermLine('相机权限：已被拒绝。安卓 Chrome 点地址栏左侧锁图标 → 权限 → 相机 → 允许；iPhone 到「设置 → Safari 浏览器 → 相机」改为允许，然后刷新本页', true);
    } else if (state === 'prompt') setPermLine('相机权限：尚未授权，点「开启摄像头」时请点允许');
    else setPermLine('相机权限：无法自动读取，点「开启摄像头」看是否弹出请求');
  }

  els.btnCamera.addEventListener('click', () => {
    if (camera.running) stopCamera();
    else startCamera();
  });

  els.scanner.addEventListener('click', () => {
    if (!camera.running) startCamera();
    else if (els.video.paused) els.video.play().catch(() => {});
  });

  // 拍照识别按钮是 <label for="photo-input">，由浏览器原生触发文件选择，不再用 JS 点击
  els.photoInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    scanPhoto(file);
  });

  els.btnSelftest.addEventListener('click', runScanSelfTest);

  if (!window.ZXing && !('BarcodeDetector' in window)) {
    setEngineLine('识别引擎未加载：请下拉强制刷新页面', true);
  }

  els.manualForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = els.manualCode.value.trim();
    if (!code) return;
    els.manualCode.value = '';
    handleScan(code);
    els.manualCode.focus();
  });

  els.demoChips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-demo]');
    if (btn) handleScan(btn.dataset.demo);
  });

  els.cartList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, code } = btn.dataset;
    if (act === 'inc') changeQty(code, 1);
    if (act === 'dec') changeQty(code, -1);
  });

  els.goodsList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, code } = btn.dataset;
    if (act === 'edit-product') {
      const product = findProduct(code);
      if (product) openProductSheet(product);
    }
    if (act === 'del-product') deleteProduct(code);
  });

  els.ordersList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="view-order"]');
    if (!btn) return;
    const order = state.orders.find((o) => o.id === btn.dataset.id);
    if (order) openReceiptSheet(order);
  });

  els.goodsSearch.addEventListener('input', renderGoods);

  els.btnAddProduct.addEventListener('click', () => openProductSheet());
  els.btnLabels.addEventListener('click', openLabelsSheet);
  els.btnReset.addEventListener('click', resetData);
  els.btnClear.addEventListener('click', clearCart);
  els.btnCheckout.addEventListener('click', openCheckoutSheet);

  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) return switchTab(tabBtn.dataset.tab);

    const goto = e.target.closest('[data-goto]');
    if (goto) return switchTab(goto.dataset.goto);
  });

  /* ---------------- 启动 ---------------- */

  if (!window.isSecureContext) showSecureHint();
  renderAll();
  refreshPermLine();
  window.__APP_READY__ = true;
})();
