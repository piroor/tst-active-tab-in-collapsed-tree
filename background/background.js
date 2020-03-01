/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

const contentsForTab = new Map();
const lastActiveForTab = new Map();

async function registerToTST() {
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'register-self',
      name: browser.i18n.getMessage('extensionName'),
      //icons: browser.runtime.getManifest().icons,
      listeningTypes: ['sidebar-show', 'tab-mousedown']
    });
    updateAllTabs();
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
          updateAllTabs({ windowId: message.windowId });
          break;

        case 'tab-mousedown':
          if (message.originalTarget) {
            const lastActive = lastActiveForTab.get(message.tab.id);
            if (lastActive) {
              browser.tabs.update(lastActive, { active: true });
              return Promise.resolve(true); // cancel default event handling of TST
            }
          }
          break;
      }
      break;
  }
});

browser.tabs.onRemoved.addListener(tabId => {
  contentsForTab.delete(tabId);
  lastActiveForTab.delete(tabId);
});

browser.tabs.onActivated.addListener(async activeInfo => {
  updateTab(activeInfo.tabId);
  updateTab(activeInfo.previousTabId);
});

browser.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
  updateTab(tabId, tab);
}, { properties: ['title', 'favIconUrl'] });


async function updateTab(tabId, lastActiveTab = null) {
  const tab = await browser.tabs.get(tabId);
  if (!lastActiveTab)
    lastActiveTab = tab;
  if (!tab ||
      !tab.openerTabId)
    return;

  const contents = buildContentsForTab(lastActiveTab);
  contentsForTab.set(tab.openerTabId, contents);
  lastActiveForTab.set(tab.openerTabId, lastActiveTab.id);

  browser.runtime.sendMessage(TST_ID, {
    type:     'set-extra-tab-contents',
    id:       tab.openerTabId,
    contents,
    style:    `
      %CONTAINER%:not(.subtree-collapsed) {
        display: none;
      }

      %CONTAINER% > .active-tab {
/*
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
*/
        border: 1px solid;
        background: ButtonFace;
        bottom: 0;
        color: ButtonText;
        left: 0;
        overflow: hidden;
        position: absolute;
        right: 0;
        text-overflow: ".."; /*ellipsis*/;
        white-space: pre;
      }

      %CONTAINER% > .active-tab.active {
        background: ActiveCaption;
        color: CaptionText;
      }

      %CONTAINER% img {
        height: 12px;
        max-height: 12px;
        max-width: 12px;
        width: 12px;
      }

      %CONTAINER% img[src="#"] {
        visibility: hidden;
      }
    `
  });

  updateTab(tab.openerTabId, lastActiveTab);
}

function buildContentsForTab(tab) {
  return `<span class="active-tab ${tab.active ? 'active' : ''}" title="${sanitzeForHTML(tab.title)}"><img src="${tab.favIconUrl}">${sanitzeForHTML(tab.title)}</span>`;
}

function sanitzeForHTML(string) {
  return string.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function updateAllTabs(options = {}) {
  const windows = await (options.windowId ? browser.windows.get(options.windowId, { populate: true }) : browser.windows.getAll({ populate: true }));
  for (const window of windows) {
    const tabs = window.tabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const tab of tabs) {
      updateTab(tab.id, tab);
    }
  }
}
