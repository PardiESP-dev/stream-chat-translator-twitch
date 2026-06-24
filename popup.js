// popup.js - Gestión de Ajustes, Idiomas, Buscador Dinámico, Temas y Multiidioma v2.2.0

const IDIOMAS_DISPONIBLES = [
  { code: 'es', name: 'Español 🇪🇸' },
  { code: 'en', name: 'Inglés 🇬🇧' },
  { code: 'ru', name: 'Ruso 🇷🇺' },
  { code: 'fr', name: 'Francés 🇫🇷' },
  { code: 'de', name: 'Alemán 🇩🇪' },
  { code: 'it', name: 'Italiano 🇮🇹' },
  { code: 'pt', name: 'Portugués 🇵🇹' },
  { code: 'ja', name: 'Japonés 🇯🇵' },
  { code: 'ko', name: 'Coreano 🇰🇷' },
  { code: 'zh', name: 'Chino 🇨🇳' },
  { code: 'ar', name: 'Árabe 🇦🇪' },
  { code: 'tr', name: 'Turco 🇹🇷' },
  { code: 'pl', name: 'Polaco 🇵🇱' },
  { code: 'nl', name: 'Neerlandés 🇳🇱' },
  { code: 'sv', name: 'Sueco 🇸🇪' },
  { code: 'fi', name: 'Finés 🇫🇮' },
  { code: 'no', name: 'Noruego 🇳🇴' },
  { code: 'da', name: 'Danés 🇩🇰' }
];

// Diccionario de traducción para la interfaz del panel
const TEXTOS_INTERFAZ = {
  es: {
    titleIn: "Traductor de Entrada",
    labelRead: "Quiero leer el chat en:",
    labelManual: "Traducción manual (Botón ⇄)",
    titleOut: "Mis Mensajes Salientes",
    labelWrite: "Quiero escribir en:",
    themeDark: "Modo Oscuro",
    themeLight: "Modo Claro",
    searchPlaceholder: "Buscar idioma..."
  },
  en: {
    titleIn: "Input Translator",
    labelRead: "I want to read the chat in:",
    labelManual: "Manual translation (Button ⇄)",
    titleOut: "My Outgoing Messages",
    labelWrite: "I want to write in:",
    themeDark: "Dark Mode",
    themeLight: "Light Mode",
    searchPlaceholder: "Search language..."
  }
};

let idiomaActivoLeer = 'es';
let idiomaActivoEscribir = 'ru';

// FUNCIÓN CLAVE: Avisa a la pestaña de Twitch para que se actualice con los cambios
function avisarYRefrescarTwitch() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
}

// Cambia dinámicamente los textos visibles del HTML según el idioma seleccionado en el panel
function aplicarIdiomaPanel(lang) {
  const textos = TEXTOS_INTERFAZ[lang] || TEXTOS_INTERFAZ['es'];
  
  document.getElementById('titleIn').textContent = textos.titleIn;
  document.getElementById('labelRead').textContent = textos.labelRead;
  document.getElementById('labelManual').textContent = textos.labelManual;
  document.getElementById('titleOut').textContent = textos.titleOut;
  document.getElementById('labelWrite').textContent = textos.labelWrite;
  
  document.getElementById('searchLeer').placeholder = textos.searchPlaceholder;
  document.getElementById('searchEscribir').placeholder = textos.searchPlaceholder;
  
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const themeBtn = document.getElementById('themeBtn');
  if (currentTheme === 'light') {
    themeBtn.textContent = textos.themeDark;
  } else {
    themeBtn.textContent = textos.themeLight;
  }
}

function poblarSelectores(filtroLeer = '', filtroEscribir = '') {
  const selectLeer = document.getElementById('langLeer');
  const selectEscribir = document.getElementById('langEscribir');

  selectLeer.innerHTML = '';
  selectEscribir.innerHTML = '';

  // 1. POBLAR TRADUCCIÓN DE ENTRADA
  IDIOMAS_DISPONIBLES.forEach(lang => {
    if (lang.name.toLowerCase().includes(filtroLeer.toLowerCase())) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      if (lang.code === idiomaActivoLeer) opt.selected = true;
      selectLeer.appendChild(opt);
    }
  });

  // 2. POBLAR TRADUCCIÓN DE SALIDA
  if ('sin traducir'.includes(filtroEscribir.toLowerCase()) || 'español'.includes(filtroEscribir.toLowerCase())) {
    const optNativa = document.createElement('option');
    optNativa.value = 'es';
    optNativa.textContent = 'Sin Traducir (Español) 🇪🇸';
    if (idiomaActivoEscribir === 'es') optNativa.selected = true;
    selectEscribir.appendChild(optNativa);
  }

  IDIOMAS_DISPONIBLES.forEach(lang => {
    if (lang.code !== 'es' && lang.name.toLowerCase().includes(filtroEscribir.toLowerCase())) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      if (lang.code === idiomaActivoEscribir) opt.selected = true;
      selectEscribir.appendChild(opt);
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const chatActiva = document.getElementById('chatActiva');
  const enviarActiva = document.getElementById('enviarActiva');
  const modoManual = document.getElementById('modoManual');
  const langLeer = document.getElementById('langLeer');
  const langEscribir = document.getElementById('langEscribir');
  const contenedorManual = document.getElementById('contenedorManual');
  const searchLeer = document.getElementById('searchLeer');
  const searchEscribir = document.getElementById('searchEscribir');
  const themeBtn = document.getElementById('themeBtn');
  const appLangSelector = document.getElementById('appLangSelector');

  // Cargar estados de memoria (Incluyendo el Tema Visual e Idioma de la App)
  chrome.storage.local.get([
    'chatActiva', 'enviarActiva', 'modoManualActivo', 'langLeerCode', 'langEscribirCode', 'theme', 'appLanguage'
  ], function(data) {
    if (data.chatActiva !== undefined) chatActiva.checked = data.chatActiva;
    if (data.enviarActiva !== undefined) enviarActiva.checked = data.enviarActiva;
    if (data.modoManualActivo !== undefined) modoManual.checked = data.modoManualActivo;
    
    if (data.langLeerCode) idiomaActivoLeer = data.langLeerCode;
    if (data.langEscribirCode) idiomaActivoEscribir = data.langEscribirCode;

    // Aplicar el tema guardado
    const temaActual = data.theme || 'dark';
    document.documentElement.setAttribute('data-theme', temaActual);

    // Aplicar idioma del panel
    const idiomaPanel = data.appLanguage || 'es';
    appLangSelector.value = idiomaPanel;
    aplicarIdiomaPanel(idiomaPanel);

    poblarSelectores();
    gestionarEstadoManual(chatActiva.checked);
  });

  // GESTIÓN DEL SELECTOR DE IDIOMA DEL PANEL (ES / EN)
  appLangSelector.addEventListener('change', function() {
    const seleccion = appLangSelector.value;
    chrome.storage.local.set({ 'appLanguage': seleccion }, function() {
      aplicarIdiomaPanel(seleccion);
    });
  });

  // LÓGICA DEL BOTÓN DE CAMBIO DE TEMA
  themeBtn.addEventListener('click', function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    
    const idiomaActual = appLangSelector.value;
    themeBtn.textContent = newTheme === 'light' ? TEXTOS_INTERFAZ[idiomaActual].themeDark : TEXTOS_INTERFAZ[idiomaActual].themeLight;
    
    chrome.storage.local.set({ 'theme': newTheme });
  });

  // Filtrar listas al escribir
  searchLeer.addEventListener('input', (e) => {
    poblarSelectores(e.target.value, searchEscribir.value);
  });

  searchEscribir.addEventListener('input', (e) => {
    poblarSelectores(searchLeer.value, e.target.value);
  });

  // Guardar idioma y limpiar buscador
  langLeer.addEventListener('change', function() {
    idiomaActivoLeer = langLeer.value;
    chrome.storage.local.set({ 'langLeerCode': idiomaActivoLeer }, function() {
      avisarYRefrescarTwitch();
    });
    searchLeer.value = '';
    poblarSelectores('', searchEscribir.value);
  });

  langEscribir.addEventListener('change', function() {
    idiomaActivoEscribir = langEscribir.value;
    chrome.storage.local.set({ 'langEscribirCode': idiomaActivoEscribir }, function() {
      avisarYRefrescarTwitch();
    });
    searchEscribir.value = '';
    poblarSelectores(searchLeer.value, '');
  });

  function gestionarEstadoManual(activado) {
    if (activado) {
      contenedorManual.style.opacity = '1';
      modoManual.disabled = false;
    } else {
      contenedorManual.style.opacity = '0.5';
      modoManual.checked = false;
      modoManual.disabled = true;
      chrome.storage.local.set({ 'modoManualActivo': false });
    }
  }

  // Eventos con autorefresco inmediato al cambiar interruptores
  chatActiva.addEventListener('change', function() {
    chrome.storage.local.set({ 'chatActiva': chatActiva.checked }, function() {
      gestionarEstadoManual(chatActiva.checked);
      avisarYRefrescarTwitch();
    });
  });

  modoManual.addEventListener('change', function() {
    chrome.storage.local.set({ 'modoManualActivo': modoManual.checked }, function() {
      avisarYRefrescarTwitch();
    });
  });

  enviarActiva.addEventListener('change', function() {
    chrome.storage.local.set({ 'enviarActiva': enviarActiva.checked }, function() {
      avisarYRefrescarTwitch();
    });
  });
});