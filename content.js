// content.js - Traductor de chat de Twitch v2.3.2
// Cambios respecto a v2.1.0:
//  - Cola con límite de velocidad, reintentos y caché (evita los bloqueos de Google)
//  - Una sola traducción por mensaje (antes: una por fragmento + una extra por cada clon)
//  - Se traducen todas las frases del mensaje (antes solo la primera)
//  - Ajustes en memoria con storage.onChanged (sin polling y sin recargar Twitch)
//  - Escritura traducida: se intercepta Enter en el chat real de Twitch (sin caja espejo)

console.log('Traductor de chat v2.3.2 cargado');

const ajustes = {
  chatActiva: false,
  modoManualActivo: false,
  enviarActiva: false,
  langLeerCode: 'es',
  langEscribirCode: 'ru'
};

chrome.storage.local.get(Object.keys(ajustes), (r) => Object.assign(ajustes, r));
chrome.storage.onChanged.addListener((cambios, area) => {
  if (area !== 'local') return;
  for (const k in cambios) {
    if (k in ajustes && cambios[k].newValue !== undefined) ajustes[k] = cambios[k].newValue;
  }
});

const estilo = document.createElement('style');
estilo.textContent = `
  .pardi-traduccion { border-top: 1px solid rgba(255,255,255,.12); margin-top: 4px; padding-top: 4px; color: #adadb8; font-size: 14px; opacity: .85; }
  .pardi-btn-manual { background: #2f2f35; color: #efeff1; border: none; border-radius: 4px; margin-left: 6px; padding: 1px 5px; font-size: 11px; cursor: pointer; vertical-align: middle; }
  .pardi-btn-manual:hover { background: #772ce8; }
`;
(document.head || document.documentElement).appendChild(estilo);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizar = (s) => (s || '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------
// TRADUCCIÓN: llamada a Google + caché + cola con reintentos
// ---------------------------------------------------------------
const cache = new Map();

async function llamarGoogle(texto, destino) {
  const clave = destino + '|' + texto;
  if (cache.has(clave)) return cache.get(clave);

  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
    encodeURIComponent(destino) + '&dt=t&q=' + encodeURIComponent(texto);
  const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!resp.ok) throw new Error('HTTP ' + resp.status); // 429 = Google te está limitando

  const datos = await resp.json();
  const resultado = {
    // datos[0] trae un trozo por frase: hay que unirlos todos
    texto: (datos[0] || []).map((s) => s[0] || '').join(''),
    idiomaOrigen: datos[2]
  };
  cache.set(clave, resultado);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return resultado;
}

const MAX_PARALELAS = 2;
const MAX_COLA = 40; // si el chat va muy rápido, se descartan los mensajes más viejos
const cola = [];
let activas = 0;
let pausadoHasta = 0;

function traducirEnCola(texto, destino) {
  return new Promise((resolve, reject) => {
    cola.push({ texto, destino, resolve, reject, intentos: 0 });
    if (cola.length > MAX_COLA) cola.shift().reject(new Error('cola llena'));
    bombear();
  });
}

function bombear() {
  while (activas < MAX_PARALELAS && cola.length) {
    const espera = pausadoHasta - Date.now();
    if (espera > 0) { setTimeout(bombear, espera + 50); return; }
    const item = cola.shift();
    activas++;
    ejecutar(item).finally(() => { activas--; setTimeout(bombear, 100); });
  }
}

async function ejecutar(item) {
  try {
    item.resolve(await llamarGoogle(item.texto, item.destino));
  } catch (e) {
    if (item.intentos < 2) {
      item.intentos++;
      pausadoHasta = Date.now() + 3000 * item.intentos; // pausa global antes de reintentar
      cola.unshift(item);
    } else {
      item.reject(e);
    }
  }
}

function mismoIdioma(a, b) {
  if (!a || !b) return false;
  return a.toLowerCase().split('-')[0] === b.toLowerCase().split('-')[0]; // zh-CN == zh
}

// ---------------------------------------------------------------
// LECTURA: traducir los mensajes del chat
// ---------------------------------------------------------------
const SEL_FRAGMENTO = '[data-a-target="chat-message-text"]';

function mostrarTraduccion(linea, original, r) {
  if (mismoIdioma(r.idiomaOrigen, ajustes.langLeerCode)) return;
  const t = (r.texto || '').trim();
  if (!t || t.toLowerCase() === original.toLowerCase()) return;
  if (!linea.isConnected) return; // el mensaje ya salió del chat

  const div = document.createElement('div');
  div.className = 'pardi-traduccion';
  div.textContent = t; // textContent: nunca se interpreta como HTML ni se vuelve a traducir
  linea.appendChild(div);
}

async function traducirLinea(linea, texto) {
  try {
    const r = await traducirEnCola(texto, ajustes.langLeerCode);
    mostrarTraduccion(linea, texto, r);
  } catch (e) {
    console.debug('[Traductor] no se pudo traducir:', e.message);
  }
}

function anadirBotonManual(linea, fragmentos, texto) {
  const btn = document.createElement('button');
  btn.className = 'pardi-btn-manual';
  btn.textContent = '⇄';
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.textContent = '…';
    btn.disabled = true;
    try {
      const r = await traducirEnCola(texto, ajustes.langLeerCode);
      mostrarTraduccion(linea, texto, r);
      btn.remove();
    } catch (err) {
      btn.textContent = '⇄';
      btn.disabled = false;
    }
  });
  fragmentos[fragmentos.length - 1].appendChild(btn);
}

function procesarMensajes() {
  if (!ajustes.chatActiva) return;
  document.querySelectorAll(SEL_FRAGMENTO).forEach((frag) => {
    const linea = frag.closest('.chat-line__message') || frag.parentElement;
    if (!linea || linea.hasAttribute('data-pardi')) return;
    linea.setAttribute('data-pardi', '1'); // se marca la línea entera, no cada fragmento

    const fragmentos = linea.querySelectorAll(SEL_FRAGMENTO);
    const texto = normalizar(Array.from(fragmentos, (f) => f.textContent).join(' '));
    if (!texto || !/\p{L}/u.test(texto) || /^[!/]/.test(texto)) return; // vacío, solo emotes/números o comandos

    if (ajustes.modoManualActivo) anadirBotonManual(linea, fragmentos, texto);
    else traducirLinea(linea, texto);
  });
}
setInterval(procesarMensajes, 600);

// ---------------------------------------------------------------
// ESCRITURA: al pulsar Enter se traduce lo escrito y se envía
// ---------------------------------------------------------------
function obtenerEditor() {
  return document.querySelector('[data-a-target="chat-input"]') ||
         document.querySelector('.chat-wysiwyg-input__editor') ||
         document.querySelector('.chat-input [contenteditable="true"]') ||
         document.querySelector('.chat-input textarea');
}

function leerEditor(editor) {
  if (editor.tagName === 'TEXTAREA') return normalizar(editor.value);
  let out = '';
  const recorrer = (nodo) => {
    nodo.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) out += c.textContent;
      else if (c.nodeName === 'IMG') out += ' ' + (c.alt || '') + ' '; // emotes
      else recorrer(c);
    });
  };
  recorrer(editor);
  return normalizar(out.replace(/[\u200B\uFEFF]/g, ''));
}

let editorLogueado = false;
let estrategiaPreferida = null;

function seleccionarTodo(editor) {
  editor.focus();
  const sel = window.getSelection();
  const rango = document.createRange();
  rango.selectNodeContents(editor);
  sel.removeAllRanges();
  sel.addRange(rango);
}

// Cada estrategia intenta meter el texto en el editor; despues se comprueba que se haya quedado
const ESTRATEGIAS_ESCRITURA = [
  ['insertText', async (ed, t) => {
    document.execCommand('insertText', false, t);
  }],
  ['beforeinput', async (ed, t) => {
    ed.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'insertText', data: t, bubbles: true, cancelable: true, composed: true
    }));
  }],
  ['paste', async (ed, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }],
  ['borrar+insertText', async (ed, t) => {
    document.execCommand('delete', false, null);
    await esperar(150);
    document.execCommand('insertText', false, t);
  }]
];

// Pide a inject.js (que corre dentro de la pagina) que cambie el texto real del editor Slate
function escribirViaSlate(texto) {
  return new Promise((resolve) => {
    const fin = (r) => {
      document.removeEventListener('pardi:resultado', alRecibir);
      clearTimeout(temporizador);
      resolve(r);
    };
    const alRecibir = (ev) => {
      try { fin(JSON.parse(ev.detail)); } catch (e) { fin({ ok: false, error: 'respuesta ilegible' }); }
    };
    const temporizador = setTimeout(() => fin({ ok: false, error: 'sin respuesta (esta cargado inject.js?)' }), 800);
    document.addEventListener('pardi:resultado', alRecibir);
    document.dispatchEvent(new CustomEvent('pardi:escribir', { detail: texto }));
  });
}

async function escribirEnEditor(editor, texto) {
  if (!editorLogueado) {
    editorLogueado = true;
    console.log('[Traductor] editor de Twitch:', {
      etiqueta: editor.tagName,
      contenteditable: editor.getAttribute('contenteditable'),
      slate: editor.hasAttribute('data-slate-editor'),
      lexical: editor.hasAttribute('data-lexical-editor'),
      dataATarget: editor.getAttribute('data-a-target'),
      clase: editor.className
    });
  }

  if (editor.tagName === 'TEXTAREA') {
    editor.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(editor, texto);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  if (editor.hasAttribute('data-slate-editor')) {
    const r = await escribirViaSlate(texto);
    if (r.ok) {
      await esperar(150); // margen para que React repinte la caja
      console.log('[Traductor] texto guardado dentro del editor de Twitch:', JSON.stringify(r.estado));
      if (normalizar(r.estado) === normalizar(texto)) return true;
      console.warn('[Traductor] el editor no guardo el texto esperado');
    } else {
      console.warn('[Traductor] puente con el editor no disponible:', r.error);
    }
  }

  const orden = estrategiaPreferida
    ? [estrategiaPreferida, ...ESTRATEGIAS_ESCRITURA.filter((e) => e !== estrategiaPreferida)]
    : ESTRATEGIAS_ESCRITURA;

  for (const estrategia of orden) {
    const [nombre, intentar] = estrategia;
    seleccionarTodo(editor);
    await esperar(150); // Slate y similares sincronizan la seleccion con retraso
    await intentar(editor, texto);
    await esperar(200); // margen para que el editor revierta el cambio si no lo acepto
    if (leerEditor(editor) === normalizar(texto)) {
      estrategiaPreferida = estrategia;
      console.log('[Traductor] texto escrito con la estrategia:', nombre);
      return true;
    }
    console.warn('[Traductor] la estrategia no funciono:', nombre, '| el editor contiene:', leerEditor(editor));
  }
  return false;
}

async function pulsarEnviar(editor) {
  // Se espera a que Twitch active el botón (antes se hacía clic a ciegas a los 60 ms)
  for (let i = 0; i < 20; i++) {
    const btn = document.querySelector('[data-a-target="chat-send-button"]');
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
      btn.click();
      return;
    }
    await esperar(50);
  }
  // Plan B: simular Enter
  const ev = new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
  });
  ev.__pardi = true;
  editor.dispatchEvent(ev);
}

let enviando = false;

document.addEventListener('keydown', async (e) => {
  if (e.__pardi || !ajustes.enviarActiva) return;
  // Enter solo; Shift+Enter, Ctrl/Alt y composición IME (chino, japonés, ruso...) pasan de largo
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.isComposing || e.keyCode === 229) return;

  const editor = obtenerEditor();
  if (!editor || !editor.contains(e.target)) return;

  if (enviando) { // segundo Enter mientras se traduce: se traga para que no salga sin traducir
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  const original = leerEditor(editor);
  if (!original || /^[!/]/.test(original)) return; // vacío o comando: lo gestiona Twitch

  e.preventDefault();
  e.stopImmediatePropagation();
  enviando = true;
  try {
    let final = original;
    try {
      const r = await llamarGoogle(original, ajustes.langEscribirCode);
      if (r.texto && r.texto.trim()) final = r.texto.trim();
    } catch (err) {
      console.debug('[Traductor] no se pudo traducir el mensaje saliente, se envía tal cual:', err.message);
    }
    console.log('[Traductor] mensaje:', JSON.stringify(original), '->', JSON.stringify(final), '(idioma: ' + ajustes.langEscribirCode + ')');
    const ed = obtenerEditor() || editor;
    const ok = await escribirEnEditor(ed, final);
    if (!ok) console.warn('[Traductor] No se pudo escribir la traduccion en el editor de Twitch');
    console.log('[Traductor] la caja contiene justo antes de enviar:', JSON.stringify(leerEditor(ed)));
    await pulsarEnviar(ed);
  } finally {
    enviando = false;
  }
}, true); // true = fase de captura: actúa antes que los manejadores de Twitch