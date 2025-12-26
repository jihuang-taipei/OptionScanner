import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop error (common with Recharts)
// This error is benign and occurs when ResizeObserver callback takes longer than a frame
const suppressResizeObserverError = () => {
  const errorHandler = (e) => {
    if (e.message && e.message.includes('ResizeObserver loop')) {
      const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
      const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
      if (resizeObserverErrDiv) resizeObserverErrDiv.style.display = 'none';
      if (resizeObserverErr) resizeObserverErr.style.display = 'none';
      e.stopImmediatePropagation();
      return true;
    }
  };
  
  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason && e.reason.message && e.reason.message.includes('ResizeObserver loop')) {
      e.preventDefault();
    }
  });
};

suppressResizeObserverError();

// Patch ResizeObserver to prevent the error
const OriginalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
  constructor(callback) {
    super((entries, observer) => {
      requestAnimationFrame(() => {
        callback(entries, observer);
      });
    });
  }
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
