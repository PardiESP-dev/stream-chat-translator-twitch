// content.js - Motor de Traducción Simultánea Nata v2.1.0

console.log("¡Traductor Pardi (v2.1.0) en ejecución con Modo Manual y Separador Visual!");

let langLeer = 'es';
let langEscribir = 'ru';
let modoEnviarActivo = false;

async function traducirConGoogleGratis(textoOriginal, idiomaDestino) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaDestino}&dt=t&q=${encodeURIComponent(textoOriginal)}`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    if (datos && datos[0] && datos[0][0] && datos[0][0][0]) {
      return { texto: datos[0][0][0], idiomaOrigen: datos[2] };
    }
    return null;
  } catch (e) { return null; }
}

// Función auxiliar para maquetar e insertar el texto traducido con la línea separadora sutil
function insertarBloqueTraducido(contenedorMensaje, textoOriginal, textoTraducido, idiomaOrigen) {
  if (idiomaOrigen === langLeer || textoOriginal.toLowerCase() === textoTraducido.toLowerCase()) return;

  let bloqueTraduccion = contenedorMensaje.cloneNode(true);
  // Limpiamos los atributos de control y botones manuales dentro del clon
  bloqueTraduccion.querySelectorAll('[data-ya-traducido]').forEach(el => el.removeAttribute('data-ya-traducido'));
  let botonManualInterno = bloqueTraduccion.querySelector('.pardi-btn-manual');
  if (botonManualInterno) botonManualInterno.remove();

  let textoReemplazado = false;
  bloqueTraduccion.childNodes.forEach(nodo => {
    if (nodo.nodeType === Node.TEXT_NODE && nodo.textContent.trim().length > 0) {
      if (!textoReemplazado) { nodo.textContent = textoTraducido + " "; textoReemplazado = true; }
      else nodo.textContent = "";
    } else if (nodo.nodeType === Node.ELEMENT_NODE) {
      if (nodo.getAttribute('data-a-target') === 'chat-message-text' || nodo.tagName === 'SPAN') {
        if (!textoReemplazado) { nodo.innerText = textoTraducido; textoReemplazado = true; }
        else nodo.innerText = "";
      }
    }
  });

  // DISEÑO PREMIUM: Añadimos la línea separadora sutil inspirada en tu captura de pantalla
  bloqueTraduccion.style.borderTop = '1px solid rgba(255, 255, 255, 0.12)'; 
  bloqueTraduccion.style.paddingTop = '4px';      
  bloqueTraduccion.style.marginTop = '4px';      
  
  // Estilos base para la integración nativa
  bloqueTraduccion.style.color = '#adadb8';      
  bloqueTraduccion.style.fontSize = '14px';      
  bloqueTraduccion.style.display = 'block';      
  bloqueTraduccion.style.width = '100%';
  bloqueTraduccion.style.opacity = '0.85';        
  contenedorMensaje.parentNode.appendChild(bloqueTraduccion);
}

// BLOQUE 1: LECTURA (Automatizada / Manual)
setInterval(async function() {
  chrome.storage.local.get(['langLeerCode', 'chatActiva', 'modoManualActivo'], async function(resultado) {
    let estaActiva = resultado.chatActiva !== undefined ? resultado.chatActiva : false;
    if (!estaActiva) return;
    
    let modoManualActivo = resultado.modoManualActivo !== undefined ? resultado.modoManualActivo : false;
    if (resultado.langLeerCode) langLeer = resultado.langLeerCode;

    let fragmentosDeTexto = document.querySelectorAll('[data-a-target="chat-message-text"]');
    
    for (let elemento of fragmentosDeTexto) {
      if (elemento.getAttribute('data-ya-traducido') === 'true') continue;
      let contenedorMensaje = elemento.closest('.chat-line__message-body') || elemento.parentNode;
      let textoCompletoOriginal = contenedorMensaje.innerText ? contenedorMensaje.innerText.trim() : "";

      if (textoCompletoOriginal && textoCompletoOriginal.length > 0) {
        elemento.setAttribute('data-ya-traducido', 'true');

        if (modoManualActivo) {
          // --- MODO MANUAL: Creamos e inyectamos el botón inline ⇄ ---
          let btnManual = document.createElement('button');
          btnManual.className = 'pardi-btn-manual';
          btnManual.innerText = '⇄';
          
          // Estilos del botón premium inline adaptados a la estética de Twitch
          btnManual.style.backgroundColor = '#2f2f35';
          btnManual.style.color = '#efeff1';
          btnManual.style.border = 'none';
          btnManual.style.borderRadius = '4px';
          btnManual.style.marginLeft = '6px';
          btnManual.style.padding = '1px 5px';
          btnManual.style.fontSize = '11px';
          btnManual.style.cursor = 'pointer';
          btnManual.style.display = 'inline-block';
          btnManual.style.verticalAlign = 'middle';
          btnManual.style.transition = 'background-color 0.15s ease';

          // Cambiado de verde a Morado Twitch para interactividad interactiva
          btnManual.addEventListener('mouseenter', () => btnManual.style.backgroundColor = '#772ce8');
          btnManual.addEventListener('mouseleave', () => btnManual.style.backgroundColor = '#2f2f35');

          // Lógica al hacer clic en el botón manual
          btnManual.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            btnManual.innerText = '...';
            btnManual.disabled = true;
            
            let resTrad = await traducirConGoogleGratis(textoCompletoOriginal, langLeer);
            if (resTrad) {
              insertarBloqueTraducido(contenedorMensaje, textoCompletoOriginal, resTrad.texto.trim(), resTrad.idiomaOrigen);
            }
            btnManual.remove(); // Se quita el botón una vez traducido con éxito
          });

          // Agregar control de seguridad si el elemento ha sido modificado durante la espera asíncrona
          if (elemento) {
            elemento.appendChild(btnManual);
          }

        } else {
          // --- MODO AUTOMÁTICO CLÁSICO ---
          let resTrad = await traducirConGoogleGratis(textoCompletoOriginal, langLeer);
          if (resTrad) {
            insertarBloqueTraducido(contenedorMensaje, textoCompletoOriginal, resTrad.texto.trim(), resTrad.idiomaOrigen);
          }
        }
      }
    }
  });
}, 400);

// BLOQUE 2: ESCRITURA ESPEJO
setInterval(function() {
  chrome.storage.local.get(['langEscribirCode', 'enviarActiva'], function(resultado) {
    modoEnviarActivo = resultado.enviarActiva !== undefined ? resultado.enviarActiva : false;
    if (resultado.langEscribirCode) langEscribir = resultado.langEscribirCode;

    let zonaEscrituraTwitch = document.querySelector('.chat-input__textarea') || 
                               document.querySelector('.chat-input__textarea-container') ||
                               document.querySelector('.chat-input > div:first-child');
    let contenedorChatGeneral = document.querySelector('.chat-input');

    if (!zonaEscrituraTwitch || !contenedorChatGeneral) return;
    let wrapperPardi = document.getElementById('pardi-wrapper-interfaz');

    if (!modoEnviarActivo) {
      zonaEscrituraTwitch.style.removeProperty('position');
      zonaEscrituraTwitch.style.removeProperty('opacity');
      zonaEscrituraTwitch.style.removeProperty('height');
      zonaEscrituraTwitch.style.removeProperty('pointer-events');
      let botonesAbajo = contenedorChatGeneral.querySelectorAll('div:not(.chat-input__textarea):not(#pardi-wrapper-interfaz)');
      botonesAbajo.forEach(el => el.style.display = '');
      if (wrapperPardi) wrapperPardi.remove();    
      return;
    }

    if (modoEnviarActivo && !wrapperPardi) {
      zonaEscrituraTwitch.style.setProperty('position', 'absolute', 'important');
      zonaEscrituraTwitch.style.setProperty('opacity', '0.01', 'important');
      zonaEscrituraTwitch.style.setProperty('height', '1px', 'important');
      zonaEscrituraTwitch.style.setProperty('pointer-events', 'none', 'important');
      
      contenedorChatGeneral.childNodes.forEach(nodo => {
        if (nodo.nodeType === Node.ELEMENT_NODE && nodo.id !== 'pardi-wrapper-interfaz' && nodo !== zonaEscrituraTwitch) {
          nodo.style.setProperty('display', 'none', 'important');
        }
      });

      wrapperPardi = document.createElement('div');
      wrapperPardi.id = 'pardi-wrapper-interfaz';
      wrapperPardi.style.display = 'flex';
      wrapperPardi.style.alignItems = 'center';
      wrapperPardi.style.width = '100%';
      wrapperPardi.style.backgroundColor = '#18181b'; 
      wrapperPardi.style.border = '1px solid #3f3f46';
      wrapperPardi.style.borderRadius = '6px';
      wrapperPardi.style.padding = '0px 10px';
      wrapperPardi.style.boxSizing = 'border-box';
      wrapperPardi.style.marginBottom = '12px';
      wrapperPardi.style.transition = 'border 0.15s ease, background-color 0.15s ease';

      let miCajaEspejo = document.createElement('textarea');
      miCajaEspejo.id = 'pardi-caja-espejo';
      miCajaEspejo.placeholder = 'Enviar un mensaje';
      
      miCajaEspejo.style.flexGrow = '1';
      miCajaEspejo.style.height = '38px'; 
      miCajaEspejo.style.backgroundColor = 'transparent';
      miCajaEspejo.style.color = '#adadb8';
      miCajaEspejo.style.border = 'none';
      miCajaEspejo.style.fontFamily = 'Inter, Roobert, sans-serif'; 
      miCajaEspejo.style.fontSize = '13px';
      miCajaEspejo.style.resize = 'none';
      miCajaEspejo.style.outline = 'none';
      miCajaEspejo.style.padding = '10px 0px 0px 0px';
      miCajaEspejo.style.boxSizing = 'border-box';

      // Cambiado de borde verde a Borde Violeta de Twitch para enfoque
      miCajaEspejo.addEventListener('focus', function() { 
        wrapperPardi.style.border = '2px solid #9146ff'; 
        wrapperPardi.style.backgroundColor = '#000000';
        miCajaEspejo.style.color = '#efeff1';
      });
      miCajaEspejo.addEventListener('blur', function() { 
        wrapperPardi.style.border = '1px solid #3f3f46'; 
        wrapperPardi.style.backgroundColor = '#18181b';
        if(!miCajaEspejo.value) miCajaEspejo.style.color = '#adadb8';
      });

      miCajaEspejo.addEventListener('keydown', async function(evento) {
        if (evento.key === 'Enter' && !evento.shiftKey) {
          evento.preventDefault(); 
          let miTextoEspañol = miCajaEspejo.value ? miCajaEspejo.value.trim() : "";
          if (!miTextoEspañol) return;

          miCajaEspejo.disabled = true;
          miCajaEspejo.style.opacity = '0.5';

          let trad = await traducirConGoogleGratis(miTextoEspañol, langEscribir);
          let textoTraducido = trad ? trad.texto : miTextoEspañol;

          let cajaOriginalTwitch = contenedorChatGeneral.querySelector('[contenteditable="true"]') || 
                                   contenedorChatGeneral.querySelector('textarea');

          if (cajaOriginalTwitch) {
            cajaOriginalTwitch.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            cajaOriginalTwitch.dispatchEvent(new InputEvent('input', { 
              inputType: 'deleteContentBackward', 
              bubbles: true 
            }));

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', textoTraducido);

            const eventoPaste = new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true,
              composed: true
            });
            cajaOriginalTwitch.dispatchEvent(eventoPaste);

            setTimeout(function() {
              let botonEnviarTwitch = contenedorChatGeneral.querySelector('[data-a-target="chat-send-button"]') || 
                                      contenedorChatGeneral.querySelector('button[data-a-target="chat-send-button"]');
              if (botonEnviarTwitch) {
                botonEnviarTwitch.click();
              }
            }, 60);
          }

          miCajaEspejo.value = "";
          miCajaEspejo.disabled = false;
          miCajaEspejo.style.opacity = '1';
          miCajaEspejo.focus();
        }
      });

      wrapperPardi.appendChild(miCajaEspejo);
      contenedorChatGeneral.insertBefore(wrapperPardi, contenedorChatGeneral.firstChild);
    }
  });
}, 500);