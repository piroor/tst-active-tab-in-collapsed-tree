/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

async function registerToTST() {
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'register-self',
      name: browser.i18n.getMessage('extensionName'),
      //icons: browser.runtime.getManifest().icons,
      listeningTypes: ['sidebar-show', 'tab-mousedown']
    });
    setContents();
  }
  catch(_error) {
    // TST is not available
  }
}
registerToTST();

browser.runtime.onMessageExternal.addListener((message, sender) => {
  switch (sender.id) {
    case TST_ID:
      switch (message.type) {
        case 'ready':
          registerToTST();
          break;

        case 'sidebar-show':
          setContents({ windowId: message.windowId });
          break;

        case 'tab-mousedown':
          console.log(message);
          if (message.originalTarget) {
            return Promise.resolve(true); // cancel default event handling of TST
          }
          break;
      }
      break;
  }
});

browser.tabs.onCreated.addListener(tab => {
  setContentsTo(tab.id);
});

async function setContents(options = {}) {
  const tabs = await browser.tabs.query(options);
  for (const tab of tabs) {
    setContentsTo(tab.id);
  }
}

function setContentsTo(tabId) {
  browser.runtime.sendMessage(TST_ID, {
    type:     'set-extra-tab-contents',
    id:       tabId,
    contents: buildContentsForTab(tabId),
    style:    `
      %CONTAINER%:not(.subtree-collapsed) {
        display: none;
      }
      %CONTAINER% {
        display: flex;
        flex-direction: column;
        flex-wrap: nowrap;
        justify-content: flex-end;
      }
      %CONTAINER% > .active-tab {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
      }
    `
  });
}

function buildContentsForTab(tabId) {
  return `<span class="active-tab">***</span>`;
}
