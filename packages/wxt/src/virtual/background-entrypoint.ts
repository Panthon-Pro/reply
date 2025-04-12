import definition from 'virtual:user-background-entrypoint';
import { setupWebSocket } from './utils/setup-web-socket';
import { logger } from '../sandbox/utils/logger';
import { browser } from 'wxt/browser';
import { keepServiceWorkerAlive } from './utils/keep-service-worker-alive';
import { reloadContentScript } from './utils/reload-content-scripts';

if (import.meta.env.COMMAND === 'serve') {
  try {
    const ws = setupWebSocket((message) => {
      if (message.event === 'wxt:reload-extension') browser.runtime.reload();
      if (message.event === 'wxt:reload-content-script' && message.data != null)
        reloadContentScript(message.data);
    });

    if (import.meta.env.MANIFEST_VERSION === 3) {
      // Tell the server the background script is loaded and ready to go
      ws.addEventListener('open', () => {
        const msg = { type: 'custom', event: 'wxt:background-initialized' };
        ws.send(JSON.stringify(msg));
      });

      // Web Socket will disconnect if the service worker is killed
      keepServiceWorkerAlive();
    }
  } catch (err) {
    logger.error('Failed to setup web socket connection with dev server', err);
  }

  browser.commands.onCommand.addListener((command) => {
    if (command === 'wxt:reload-extension') {
      browser.runtime.reload();
    }
  });
}

let result;

try {
  result = definition.main();
  // @ts-expect-error: res shouldn't be a promise, but we're checking it anyways
  if (result instanceof Promise) {
    console.warn(
      "The background's main() function return a promise, but it must be synchronous",
    );
  }
} catch (err) {
  logger.error('The background crashed on startup!');
  throw err;
}

// Return the main function's result to the background when executed via the
// scripting API. Default export causes the IIFE to return a value.
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript#return_value
// Tested on both Chrome and Firefox
export default result;
