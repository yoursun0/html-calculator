(function () {
  const displayEl = document.getElementById("display");
  const menuBtn = document.getElementById("menuBtn");
  const modeMenu = document.getElementById("modeMenu");
  const modeLabel = document.getElementById("modeLabel");
  const angleLabel = document.getElementById("angleLabel");
  const sciPad = document.getElementById("sciPad");
  const app = document.querySelector(".app");
  const btnSin = document.getElementById("btnSin");
  const btnCos = document.getElementById("btnCos");
  const btnTan = document.getElementById("btnTan");
  const btnInv = document.getElementById("btnInv");
  const btnAngle = document.getElementById("btnAngle");

  const state = {
    mode: "standard",
    entry: "0",
    acc: null,
    op: null,
    fresh: true,
    error: false,
    memory: 0,
    memSet: false,
    angle: "DEG",
    inv: false,
    frames: [],
  };

  function formatNum(n) {
    if (!Number.isFinite(n)) throw new Error("bad");
    if (Object.is(n, -0)) n = 0;
    const abs = Math.abs(n);
    let text;
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
      text = n.toExponential(8).replace(/\.?0+e/, "e");
    } else {
      text = String(Number(n.toPrecision(12)));
    }
    if (text.length > 16) text = Number(n.toPrecision(10)).toString();
    return text;
  }

  function current() {
    const n = Number(state.entry);
    if (!Number.isFinite(n)) throw new Error("bad");
    return n;
  }

  function paint() {
    displayEl.textContent = state.error ? "Error" : state.entry;
    document.querySelector('[data-act="mc"]').disabled = !state.memSet;
    document.querySelector('[data-act="mr"]').disabled = !state.memSet;
  }

  function fail() {
    state.error = true;
    state.entry = "0";
    state.acc = null;
    state.op = null;
    state.fresh = true;
    state.frames = [];
    paint();
  }

  function setEntry(n) {
    state.entry = formatNum(n);
    state.fresh = true;
    state.error = false;
    paint();
  }

  function recoverIfError() {
    if (!state.error) return;
    state.error = false;
    state.entry = "0";
    state.acc = null;
    state.op = null;
    state.fresh = true;
    state.frames = [];
  }

  function inputDigit(d) {
    recoverIfError();
    if (state.fresh || state.entry === "0") {
      state.entry = d;
      state.fresh = false;
    } else if (state.entry.replace("-", "").length < 16) {
      state.entry += d;
    }
    paint();
  }

  function inputDot() {
    recoverIfError();
    if (state.fresh) {
      state.entry = "0.";
      state.fresh = false;
    } else if (!state.entry.includes(".")) {
      state.entry += ".";
    }
    paint();
  }

  function toggleSign() {
    if (state.error) return;
    if (state.entry === "0") return;
    state.entry = state.entry.startsWith("-") ? state.entry.slice(1) : "-" + state.entry;
    paint();
  }

  function backspace() {
    if (state.error) return;
    if (state.fresh) return;
    const neg = state.entry.startsWith("-");
    const body = neg ? state.entry.slice(1) : state.entry;
    const next = body.slice(0, -1);
    state.entry = next === "" || next === "-" ? "0" : (neg ? "-" : "") + next;
    if (state.entry === "-") state.entry = "0";
    if (state.entry === "0") state.fresh = true;
    paint();
  }

  function clearEntry() {
    state.error = false;
    state.entry = "0";
    state.fresh = true;
    paint();
  }

  function clearAll() {
    state.error = false;
    state.entry = "0";
    state.acc = null;
    state.op = null;
    state.fresh = true;
    state.frames = [];
    paint();
  }

  function applyBinary(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") {
      if (b === 0) throw new Error("div0");
      return a / b;
    }
    if (op === "^") return Math.pow(a, b);
    return b;
  }

  function commitPending(nextOp) {
    const right = current();
    if (state.op == null || state.acc == null) {
      state.acc = right;
    } else if (!state.fresh) {
      state.acc = applyBinary(state.acc, state.op, right);
      state.entry = formatNum(state.acc);
    }
    state.op = nextOp;
    state.fresh = true;
    paint();
  }

  function equals() {
    if (state.error) return;
    try {
      while (state.frames.length) closeParen();
      if (state.op == null || state.acc == null) {
        setEntry(current());
        return;
      }
      const result = applyBinary(state.acc, state.op, current());
      state.acc = null;
      state.op = null;
      setEntry(result);
    } catch (e) {
      fail();
    }
  }

  function unary(fn) {
    if (state.error) return;
    try {
      setEntry(fn(current()));
    } catch (e) {
      fail();
    }
  }

  function percent() {
    if (state.error) return;
    try {
      const x = current();
      if (state.op && state.acc != null && (state.op === "+" || state.op === "-")) {
        setEntry(state.acc * (x / 100));
        state.fresh = true;
      } else {
        setEntry(x / 100);
      }
    } catch (e) {
      fail();
    }
  }

  function toRad(n) {
    return state.angle === "DEG" ? (n * Math.PI) / 180 : n;
  }

  function fromRad(n) {
    return state.angle === "DEG" ? (n * 180) / Math.PI : n;
  }

  function trig(kind) {
    unary((x) => {
      if (state.inv) {
        if (kind === "sin" || kind === "cos") {
          if (x < -1 || x > 1) throw new Error("domain");
        }
        const r = kind === "sin" ? Math.asin(x) : kind === "cos" ? Math.acos(x) : Math.atan(x);
        return fromRad(r);
      }
      const r = toRad(x);
      if (kind === "sin") return Math.sin(r);
      if (kind === "cos") return Math.cos(r);
      return Math.tan(r);
    });
  }

  function factorial(n) {
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n || n > 170) throw new Error("fact");
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function openParen() {
    if (state.error) return;
    state.frames.push({ acc: state.acc, op: state.op, entry: state.entry });
    state.acc = null;
    state.op = null;
    state.entry = "0";
    state.fresh = true;
    paint();
  }

  function closeParen() {
    if (state.error) return;
    if (!state.frames.length) {
      fail();
      return;
    }
    let value;
    try {
      value = state.op != null && state.acc != null ? applyBinary(state.acc, state.op, current()) : current();
    } catch (e) {
      fail();
      return;
    }
    const frame = state.frames.pop();
    state.acc = frame.acc;
    state.op = frame.op;
    state.entry = formatNum(value);
    state.fresh = true;
    paint();
  }

  function memoryWrite(n) {
    state.memory = n;
    state.memSet = true;
    paint();
  }

  function onMemory(act) {
    if (state.error && act !== "mc") return;
    try {
      if (act === "mc") {
        state.memory = 0;
        state.memSet = false;
        paint();
      } else if (act === "mr") {
        if (!state.memSet) return;
        setEntry(state.memory);
      } else if (act === "ms") {
        memoryWrite(current());
        state.fresh = true;
      } else if (act === "mplus") {
        memoryWrite((state.memSet ? state.memory : 0) + current());
        state.fresh = true;
      } else if (act === "mminus") {
        memoryWrite((state.memSet ? state.memory : 0) - current());
        state.fresh = true;
      }
    } catch (e) {
      fail();
    }
  }

  function setMode(mode) {
    state.mode = mode;
    const sci = mode === "scientific";
    app.dataset.mode = mode;
    modeLabel.textContent = sci ? "科學" : "標準";
    sciPad.hidden = !sci;
    angleLabel.hidden = !sci;
    modeMenu.querySelectorAll("button").forEach((btn) => {
      btn.setAttribute("aria-current", btn.dataset.mode === mode ? "true" : "false");
    });
    closeMenu();
  }

  function closeMenu() {
    modeMenu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const open = modeMenu.hidden;
    modeMenu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setInv(on) {
    state.inv = on;
    btnSin.textContent = on ? "sin⁻¹" : "sin";
    btnCos.textContent = on ? "cos⁻¹" : "cos";
    btnTan.textContent = on ? "tan⁻¹" : "tan";
    btnInv.classList.toggle("is-on", on);
  }

  function toggleAngle() {
    state.angle = state.angle === "DEG" ? "RAD" : "DEG";
    btnAngle.textContent = state.angle;
    angleLabel.textContent = state.angle;
  }

  document.querySelector(".pad").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    if (btn.dataset.digit) inputDigit(btn.dataset.digit);
    else if (btn.dataset.op) {
      if (state.error) return;
      try { commitPending(btn.dataset.op); } catch (e) { fail(); }
    } else if (btn.dataset.act === "dot") inputDot();
    else if (btn.dataset.act === "sign") toggleSign();
    else if (btn.dataset.act === "bs") backspace();
    else if (btn.dataset.act === "ce") clearEntry();
    else if (btn.dataset.act === "c") clearAll();
    else if (btn.dataset.act === "eq") equals();
    else if (btn.dataset.act === "pct") percent();
    else if (btn.dataset.act === "invx") unary((x) => { if (x === 0) throw new Error("div0"); return 1 / x; });
    else if (btn.dataset.act === "sq") unary((x) => x * x);
    else if (btn.dataset.act === "sqrt") unary((x) => { if (x < 0) throw new Error("sqrt"); return Math.sqrt(x); });
  });

  document.querySelector(".mem-row").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn || btn.disabled) return;
    onMemory(btn.dataset.act);
  });

  sciPad.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "lparen") openParen();
    else if (act === "rparen") closeParen();
    else if (act === "pi") { recoverIfError(); setEntry(Math.PI); }
    else if (act === "e") { recoverIfError(); setEntry(Math.E); }
    else if (act === "sin") trig("sin");
    else if (act === "cos") trig("cos");
    else if (act === "tan") trig("tan");
    else if (act === "inv") setInv(!state.inv);
    else if (act === "log") unary((x) => { if (x <= 0) throw new Error("log"); return Math.log10(x); });
    else if (act === "ln") unary((x) => { if (x <= 0) throw new Error("ln"); return Math.log(x); });
    else if (act === "pow") {
      if (state.error) return;
      try { commitPending("^"); } catch (e) { fail(); }
    } else if (act === "tenx") unary((x) => Math.pow(10, x));
    else if (act === "fact") unary(factorial);
    else if (act === "abs") unary((x) => Math.abs(x));
    else if (act === "angle") toggleAngle();
  });

  menuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleMenu();
  });
  modeMenu.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    setMode(btn.dataset.mode);
  });
  document.addEventListener("click", (ev) => {
    if (modeMenu.hidden) return;
    if (!modeMenu.contains(ev.target) && ev.target !== menuBtn) closeMenu();
  });

  setMode("standard");
  paint();
})();
