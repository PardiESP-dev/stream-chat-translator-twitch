// background.js - Gestor de Eventos v2.1.0
const URL_FORMULARIO_DESINSTALACION = "https://docs.google.com/forms/d/e/1FAIpQLScxlsHZKriIaOMlBCzt5nZ6jQMfSPV213eI5DWFq7suyCmvIA/viewform";

chrome.runtime.onInstalled.addListener(function(detalles) {
  if (detalles.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("bienvenida.html")
    });
  }
});

chrome.runtime.setUninstallURL(URL_FORMULARIO_DESINSTALACION, function() {
  if (chrome.runtime.lastError) {
    console.log("Error URL desinstalación:", chrome.runtime.lastError.message);
  }
});