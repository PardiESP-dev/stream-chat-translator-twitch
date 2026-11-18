// inject.js - se ejecuta DENTRO de la página de Twitch (world: MAIN)
// Habla directamente con el editor Slate del chat para cambiar su texto interno de verdad.
// content.js le manda el texto con el evento 'pardi:escribir' y recibe 'pardi:resultado'.
(() => {
  if (window.__pardiInject) return;
  window.__pardiInject = true;

  function encontrarEditorSlate() {
    const el = document.querySelector('[data-a-target="chat-input"][data-slate-editor]') ||
               document.querySelector('[data-slate-editor="true"]');
    if (!el) return { error: 'no hay ningun editor Slate en la pagina' };

    const clave = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    if (!clave) return { error: 'el elemento no tiene fiber de React' };

    const esEditor = (e) => e && typeof e.apply === 'function' && Array.isArray(e.children);
    const vistos = [];
    let fiber = el[clave];
    while (fiber) {
      const p = fiber.memoizedProps;
      if (p && typeof p === 'object') {
        if (esEditor(p.editor)) return { editor: p.editor };
        if (vistos.length < 12) vistos.push(Object.keys(p).join(','));
      }
      if (fiber.stateNode && esEditor(fiber.stateNode.editor)) return { editor: fiber.stateNode.editor };
      fiber = fiber.return;
    }
    return { error: 'no se encontro el editor en React. Props vistas: ' + vistos.join(' | ') };
  }

  function textoDe(nodos) {
    return nodos.map((n) => {
      if (typeof n.text === 'string') return n.text;
      return n.children ? textoDe(n.children) : '';
    }).join('');
  }

  function primerPunto(children) {
    const path = [];
    let nodo = { children };
    while (nodo.children && nodo.children.length) { path.push(0); nodo = nodo.children[0]; }
    return { path, offset: 0 };
  }

  function ultimoPunto(children) {
    const path = [];
    let nodo = { children };
    while (nodo.children && nodo.children.length) {
      const i = nodo.children.length - 1;
      path.push(i);
      nodo = nodo.children[i];
    }
    return { path, offset: typeof nodo.text === 'string' ? nodo.text.length : 0 };
  }

  function reemplazarTodo(editor, texto) {
    // 1) seleccionar todo el contenido dentro del estado de Slate
    editor.apply({
      type: 'set_selection',
      properties: editor.selection ? { ...editor.selection } : null,
      newProperties: { anchor: primerPunto(editor.children), focus: ultimoPunto(editor.children) }
    });
    // 2) escribir: con la seleccion expandida, Slate borra lo anterior y pone el texto nuevo
    editor.insertText(texto);
  }

  document.addEventListener('pardi:escribir', (ev) => {
    let respuesta;
    try {
      const r = encontrarEditorSlate();
      if (r.error) {
        respuesta = { ok: false, error: r.error };
      } else {
        reemplazarTodo(r.editor, String(ev.detail || ''));
        respuesta = { ok: true, estado: textoDe(r.editor.children) }; // lo que Slate tiene guardado de verdad
      }
    } catch (e) {
      respuesta = { ok: false, error: String((e && e.message) || e) };
    }
    document.dispatchEvent(new CustomEvent('pardi:resultado', { detail: JSON.stringify(respuesta) }));
  });
})();