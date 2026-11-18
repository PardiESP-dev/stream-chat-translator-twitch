// background.js - Service Worker v2.3.0
const URL_FORMULARIO_DESINSTALACION = "https://docs.google.com/forms/d/e/1FAIpQLScxlsHZKriIaOMlBCzt5nZ6jQMfSPV213eI5DWFq7suyCmvIA/viewform";

// Al instalar, abrir pantalla de bienvenida
chrome.runtime.onInstalled.addListener((detalles) => {
  if (detalles.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("bienvenida.html")
    });
  }
});

// Configurar URL de salida/desinstalación
chrome.runtime.setUninstallURL(URL_FORMULARIO_DESINSTALACION, () => {
  if (chrome.runtime.lastError) {
    console.warn("Error URL desinstalación:", chrome.runtime.lastError.message);
  }
});