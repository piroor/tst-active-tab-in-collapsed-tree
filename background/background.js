/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

const STYLE_FOR_EXTRA_TAB_CONTENTS = `
  tab-item:not(.subtree-collapsed) ::part(%EXTRA_CONTENTS_PART% container) {
    display: none;
  }

  ::part(%EXTRA_CONTENTS_PART% container) {
    border: 1px solid ThreeDShadow;
    background: ButtonFace;
    bottom: 0;
    color: ButtonText;
    left: 0;
    line-height: 1;
    position: absolute;
    right: 0;
  }

  ::part(%EXTRA_CONTENTS_PART% tab) {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    padding: 0.2em;
  }

  ::part(%EXTRA_CONTENTS_PART% title) {
    overflow: hidden;
    text-overflow: ".."; /*ellipsis*/;
    white-space: pre;
  }

  ::part(%EXTRA_CONTENTS_PART% tab active) {
    background: ActiveCaption;
    color: CaptionText;
  }

  ::part(%EXTRA_CONTENTS_PART% favicon) {
    height: 12px;
    margin-right: 0.25em;
    max-height: 12px;
    max-width: 12px;
    width: 12px;
  }

  ::part(%EXTRA_CONTENTS_PART% favicon sanitized) {
    visibility: hidden;
  }
`;

const contentsForTab = new Map();
const lastActiveForTab = new Map();
const parentForTab = new Map();
let lastExpandingTree;

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
        'tab-clicked',
        'tab-dblclicked',
        'tree-attached',
        'tree-detached',
        'tree-collapsed-state-changed'
      ],
      style: STYLE_FOR_EXTRA_TAB_CONTENTS
    });
    updateAllTabs();
  }
  catch(_error) {
    // TST is not available
  }
}
registerToTST();

let lastExpandingTreeClearTimer;

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

        case 'try-expand-tree-from-focused-parent':
          //if (!lastActiveForTab.get(message.tab.id))
          //  return;
          lastExpandingTree = message.tab.id;
          return;

        case 'try-expand-tree-from-focused-collapsed-tab':
        case 'try-move-focus-from-collapsing-tree':
          return Promise.resolve(true);

        case 'tab-mousedown':
          if (message.button != 0 ||
              message.twisty ||
              message.soundButton ||
              message.closebox ||
              message.altKey ||
              message.ctrlKey ||
              message.metaKey ||
              message.shiftKey)
            return;
          if (message.originalTarget) {
            const lastActive = lastActiveForTab.get(message.tab.id);
            if (lastActive) {
              browser.tabs.update(lastActive, { active: true });
              return Promise.resolve(true); // cancel default event handling of TST
            }
          }
          else if (!message.tab.states.includes('subtree-collapsed')) {
            // Clear last active descendant for a parent tab
            // when it is clicked/focused while it is expanded.
            reserveToUpdateTab(message.tab.id);
          }
          break;

        case 'tab-clicked':
          if (message.button == 1 &&
              message.originalTarget) {
            const lastActive = lastActiveForTab.get(message.tab.id);
            if (lastActive) {
              browser.tabs.remove(lastActive);
              return Promise.resolve(true); // cancel default event handling of TST
            }
          }
          break;

        case 'tab-dblclicked':
          if (message.button != 0 ||
              message.twisty ||
              message.soundButton ||
              message.closebox ||
              message.altKey ||
              message.ctrlKey ||
              message.metaKey ||
              message.shiftKey)
            return;
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

        case 'tree-attached':
          if (message.tab.active)
            reserveToUpdateTab(message.tab.id);
          break;

        case 'tree-detached':
          if (lastActiveForTab.get(message.oldParent.id) == message.tab.id)
            reserveToUpdateTab(message.oldParent.id);
          break;

        case 'tree-collapsed-state-changed': {
          const lastActiveId = lastActiveForTab.get(message.tab.id);
          if (lastActiveId &&
              message.collapsed)
            browser.runtime.sendMessage(TST_ID, {
              type: 'get-tree',
              tab:  lastActiveId
            }).then(tryUpdateSuccessorTabFor);
          if (lastExpandingTreeClearTimer)
            clearTimeout(lastExpandingTreeClearTimer);
          lastExpandingTreeClearTimer = setTimeout(() => {
            lastExpandingTreeClearTimer = null;
            lastExpandingTree = null;
          }, 250);
        }; break;
      }
      break;
  }
});

browser.tabs.onRemoved.addListener(async tabId => {
  const parentId = parentForTab.get(tabId);
  if (parentId) {
    const lastActiveId = lastActiveForTab.get(parentId);
    if (lastActiveId && lastActiveId == tabId) {
      browser.runtime.sendMessage(TST_ID, {
        type: 'get-tree',
        tab:  parentId
      }).then(async tab => {
        if (!tab)
          return;
        for (const ancestorId of [parentId].concat(tab.ancestorTabIds)) {
          const lastActiveId = lastActiveForTab.get(ancestorId);
          if (lastActiveId == tabId) {
            // Clear these information immediately to prevent updating by tree-detached.
            contentsForTab.delete(ancestorId);
            lastActiveForTab.delete(ancestorId);
            reserveToUpdateTab(ancestorId, null, { clear: true });
          }
        }
      }).catch(console.error);
    }
  }
  contentsForTab.delete(tabId);
  lastActiveForTab.delete(tabId);
  parentForTab.delete(tabId);
});

browser.tabs.onActivated.addListener(async activeInfo => {
  const [tab, previousTab] = await browser.runtime.sendMessage(TST_ID, {
    type: 'get-tree',
    tabs: [activeInfo.tabId, activeInfo.previousTabId]
  });
  if (previousTab.states.includes('collapsed') ||
      !previousTab.states.includes('subtree-collapsed'))
    reserveToUpdateTab(activeInfo.previousTabId);

  reserveToUpdateTab(activeInfo.tabId);
  tryUpdateSuccessorTabFor(tab);
});

browser.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
  reserveToUpdateTab(tabId, tab);
}, { properties: ['title', 'favIconUrl'] });


function reserveToUpdateTab(tabId, lastActiveTab, options = {}) {
  const timer = reserveToUpdateTab.reserved.get(tabId);
  if (timer)
    clearTimeout(timer);
  reserveToUpdateTab.reserved.set(tabId, setTimeout(() => {
    reserveToUpdateTab.reserved.delete(tabId);
    updateTab(tabId, lastActiveTab, options);
  }, 150));
}
reserveToUpdateTab.reserved = new Map();

async function updateTab(tabId, lastActiveTab = null, { initializing = false, clear = false } = {}) {
  const [nativeTab, tree] = await Promise.all([
    browser.tabs.get(tabId),
    browser.runtime.sendMessage(TST_ID, {
      type: 'get-tree',
      tab:  tabId
    })
  ]);
  if (!nativeTab)
    return;

  const tab = Object.assign(nativeTab, tree);
  if (!lastActiveTab)
    lastActiveTab = tab;

  // Clear last active descendant when a parent tab
  // itself gets focused while it is completely expanded.
  if (clear ||
      initializing ||
      tab.children.length == 0 ||
      (tabId != lastExpandingTree &&
       (!tab.states.includes('collapsed') &&
        !tab.states.includes('subtree-collapsed'))))
    reserveToSetContents(tabId, null, null);

  if (tab.ancestorTabIds.length == 0) {
    parentForTab.delete(tab.id);
    return;
  }

  parentForTab.set(tab.id, tab.ancestorTabIds[0]);

  const contents = !clear && lastActiveTab && buildContentsForTab(lastActiveTab);
  let lastAncestor = null;
  for (const ancestorId of tab.ancestorTabIds) {
    reserveToSetContents(ancestorId, lastActiveTab.id, contents);
    if (lastAncestor)
      parentForTab.set(lastAncestor, ancestorId);
    lastAncestor = ancestorId;
  }
}

function reserveToSetContents(tabId, lastActiveTabId, contents) {
  const timer = reserveToSetContents.reserved.get(tabId);
  if (timer)
    clearTimeout(timer);
  reserveToSetContents.reserved.set(tabId, setTimeout(() => {
    reserveToSetContents.reserved.delete(tabId);
    contentsForTab.set(tabId, contents);
    lastActiveForTab.set(tabId, lastActiveTabId);

    if (lastActiveTabId)
      browser.sessions.setTabValue(tabId, 'lastActiveTabId', lastActiveTabId);
    else
      browser.sessions.removeTabValue(tabId, 'lastActiveTabId');

    browser.runtime.sendMessage(TST_ID, {
      type:  'set-extra-tab-contents',
      id:    tabId,
      contents
    });
  }, 150));
}
reserveToSetContents.reserved = new Map();

function buildContentsForTab(tab) {
  return `<span part="tab ${tab.active ? 'active' : ''}"><img part="favicon" src="${tab.favIconUrl}"><span part="title" title="${sanitzeForHTML(tab.title)}">${sanitzeForHTML(tab.title)}</span></span>`;
}

function sanitzeForHTML(string) {
  return string.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function updateAllTabs(options = {}) {
  const windows = options.windowId ? [await browser.windows.get(options.windowId, { populate: true })] : (await browser.windows.getAll({ populate: true }));
  for (const window of windows) {
    const tabs = window.tabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
    const tabsById = {};
    const lastActiveTabIds = await Promise.all(tabs.map(tab => {
      tabsById[tab.id] = tab;
      return browser.sessions.getTabValue(tab.id, 'lastActiveTabId');
    }));
    tabs.forEach((tab, index) => {
      const lastActiveTabId = lastActiveTabIds[index];
      if (lastActiveTabId) {
        const lastActiveTab = tabsById[lastActiveTabId];
        reserveToSetContents(
          tab.id,
          lastActiveTabId,
          lastActiveTab && buildContentsForTab(lastActiveTab)
        );
        if (lastActiveTab)
          parentForTab.set(lastActiveTabId, tab.id);
      }
      else {
        updateTab(tab.id, tab, { initializing: true });
      }
    });
  }
}

async function tryUpdateSuccessorTabFor(tab) {
  if (!tab)
    return;
  const ancestors = await browser.runtime.sendMessage(TST_ID, {
    type: 'get-tree',
    tabs: tab.ancestorTabIds
  });
  if (!ancestors)
    return;
  const nearestVisibleAncestor = ancestors.find(tab => !tab.states.includes('collapsed'));
  if (nearestVisibleAncestor)
    browser.tabs.update(tab.id, {
      successorTabId: nearestVisibleAncestor.id
    });
}
