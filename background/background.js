/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

const STYLE_FOR_EXTRA_TAB_CONTENTS = `
  %CONTAINER%:not(.subtree-collapsed) {
    display: none;
  }

  %CONTAINER% {
    border: 1px solid ThreeDShadow;
    background: ButtonFace;
    bottom: 0;
    color: ButtonText;
    left: 0;
    line-height: 1;
    position: absolute;
    right: 0;
  }

  %CONTAINER% > .active-tab {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    padding: 0.2em;
  }

  %CONTAINER% > .active-tab > .title {
    overflow: hidden;
    text-overflow: ".."; /*ellipsis*/;
    white-space: pre;
  }

  %CONTAINER% > .active-tab.active {
    background: ActiveCaption;
    color: CaptionText;
  }

  %CONTAINER% img {
    height: 12px;
    margin-right: 0.25em;
    max-height: 12px;
    max-width: 12px;
    width: 12px;
  }

  %CONTAINER% img[src="#"] {
    visibility: hidden;
  }
`;

const contentsForTab = new Map();
const lastActiveForTab = new Map();

async function registerToTST() {
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'register-self',
      name: browser.i18n.getMessage('extensionName'),
      //icons: browser.runtime.getManifest().icons,
      listeningTypes: [
        'sidebar-show',
        'try-expand-tree-from-focused-collapsed-tab',
        'try-expand-tree-from-focused-parent',
        'try-move-focus-from-collapsing-tree',
        'tab-mousedown',
        'tab-dblclicked'
      ]
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

        case 'try-expand-tree-from-focused-collapsed-tab':
        case 'try-expand-tree-from-focused-parent':
        case 'try-move-focus-from-collapsing-tree':
          return Promise.resolve(true);

        case 'tab-mousedown':
          if (message.originalTarget) {
            const lastActive = lastActiveForTab.get(message.tab.id);
            if (lastActive) {
              browser.tabs.update(lastActive, { active: true });
              return Promise.resolve(true); // cancel default event handling of TST
            }
          }
          break;

        case 'tab-dblclicked':
          if (message.originalTarget) {
            const lastActive = lastActiveForTab.get(message.tab.id);
            if (lastActive) {
              browser.runtime.sendMessage(TST_ID, {
                type: 'get-tree',
                tab:  lastActive
              }).then(tab => {
                for (const ancestorId of tab.ancestorTabIds) {
                  browser.runtime.sendMessage(TST_ID, {
                    type: 'expand-tree',
                    tab:  ancestorId
                  });
                }
              });
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
  reserveToUpdateTab(activeInfo.tabId);
  reserveToUpdateTab(activeInfo.previousTabId);
});

browser.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
  reserveToUpdateTab(tabId, tab);
}, { properties: ['title', 'favIconUrl'] });


function reserveToUpdateTab(tabId, lastActiveTab) {
  const timer = reserveToUpdateTab.reserved.get(tabId);
  if (timer)
    clearTimeout(timer);
  reserveToUpdateTab.reserved.set(tabId, setTimeout(() => {
    reserveToUpdateTab.reserved.delete(tabId);
    updateTab(tabId, lastActiveTab);
  }, 150));
}
reserveToUpdateTab.reserved = new Map();

async function updateTab(tabId, lastActiveTab = null) {
  const [nativeTab, tree] = await Promise.all([
    browser.tabs.get(tabId),
    browser.runtime.sendMessage(TST_ID, {
      type: 'get-tree',
      tab:  tabId
    })
  ]);
  const tab = Object.assign(nativeTab, tree);
  if (!lastActiveTab)
    lastActiveTab = tab;
  if (!tab ||
      tab.ancestorTabIds.length == 0)
    return;

  const contents = buildContentsForTab(lastActiveTab);

  for (const ancestorId of tab.ancestorTabIds) {
    contentsForTab.set(ancestorId, contents);
    lastActiveForTab.set(ancestorId, lastActiveTab.id);
    browser.runtime.sendMessage(TST_ID, {
      type:  'set-extra-tab-contents',
      id:    ancestorId,
      style: STYLE_FOR_EXTRA_TAB_CONTENTS,
      contents
    });
  }
}

function buildContentsForTab(tab) {
  return `<span class="active-tab ${tab.active ? 'active' : ''}"><img src="${tab.favIconUrl}"><span class="title" title="${sanitzeForHTML(tab.title)}">${sanitzeForHTML(tab.title)}</span></span>`;
}

function sanitzeForHTML(string) {
  return string.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function updateAllTabs(options = {}) {
  const windows = options.windowId ? [await browser.windows.get(options.windowId, { populate: true })] : (await browser.windows.getAll({ populate: true }));
  for (const window of windows) {
    const tabs = window.tabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const tab of tabs) {
      reserveToUpdateTab(tab.id, tab);
    }
  }
}
