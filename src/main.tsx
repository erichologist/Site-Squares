import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Sanitize console arguments to prevent DataCloneError in iframe environments
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

function sanitizeArg(arg: any): any {
  if (arg instanceof Error) {
    return `[Error] ${arg.name}: ${arg.message}\n${arg.stack}`;
  }
  if (arg instanceof DOMException) {
    return `[DOMException] ${arg.name}: ${arg.message}`;
  }
  if (typeof arg === 'object' && arg !== null) {
    if ('nodeType' in arg) {
      return `[DOMElement ${(arg as HTMLElement).tagName}]`;
    }
    if (arg instanceof Event) {
      return `[Event ${arg.type}]`;
    }
  }
  return arg;
}

console.error = (...args: any[]) => {
  originalConsoleError.apply(console, args.map(sanitizeArg));
};
console.log = (...args: any[]) => {
  originalConsoleLog.apply(console, args.map(sanitizeArg));
};
console.warn = (...args: any[]) => {
  originalConsoleWarn.apply(console, args.map(sanitizeArg));
};

// Also catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error("Unhandled Rejection:", event.reason);
});

const originalPostMessage = window.postMessage;
window.postMessage = function(message: any, targetOrigin: string, transfer?: Transferable[]) {
  try {
    if (message !== undefined) {
      structuredClone(message); // Test clone
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'DataCloneError') {
      originalConsoleWarn.call(console, "Caught DataCloneError on postMessage:", message);
      if (message && typeof message === 'object') {
        let safeMessage: any = { type: message.type };
        if (message.err) {
          safeMessage.err = {
            message: message.err.message ? String(message.err.message) : 'Unknown error',
            name: message.err.name ? String(message.err.name) : 'Error',
            stack: message.err.stack ? String(message.err.stack) : '',
          };
        }
        return originalPostMessage.call(window, safeMessage, targetOrigin, transfer);
      }
      return; 
    }
  }
  return originalPostMessage.call(window, message, targetOrigin, transfer);
};

createRoot(document.getElementById('root')!).render(
  <App />
);
