/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '/common/common.js';

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

const STYLE_FOR_EXTRA_TAB_CONTENTS = `
  tab-item:not(.subtree-collapsed) ::part(%EXTRA_CONTENTS_PART% container) {
    visibility: collapse;
  }

  ::part(%EXTRA_CONTENTS_PART% container) {
    background: var(--tabbar-bg, var(--bg-color, ButtonFace));
    border: 1px solid var(--tab-border);
    bottom: 0;
    left: 0;
    line-height: 1;
    position: absolute;
    right: 0;

    --throbber-size: 12px;
    --favicon-size: 12px;
    --tab-surface: var(--tab-surface-regular);
    --tab-text: var(--tab-text-regular);
  }

  ::part(%EXTRA_CONTENTS_PART% tab) {
    border-left: var(--tab-highlighter-size) solid transparent;
    background: var(--tab-surface);
    color: var(--tab-text);
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    padding: 0.2em;
    position: relative;
    transition: background 0.25s ease-out;
  }
  ::part(%EXTRA_CONTENTS_PART% tab):hover {
    --tab-surface: var(--tab-surface-hover);
    border-left-color: var(--tab-highlighter-inactive);
  }

  ::part(%EXTRA_CONTENTS_PART% title) {
    overflow: hidden;
    text-overflow: ".."; /*ellipsis*/;
    white-space: pre;
  }

  ::part(%EXTRA_CONTENTS_PART% tab active) {
    --tab-surface: var(--tab-surface-active);
    --tab-text: var(--tab-text-active);
    border-left-color: var(--tab-highlighter);
    text-shadow: var(--tab-text-shadow);
  }
  ::part(%EXTRA_CONTENTS_PART% tab active):hover {
    --tab-surface: var(--tab-surface-active-hover);
    border-left-color: var(--tab-highlighter);
  }

  ::part(%EXTRA_CONTENTS_PART% favicon) {
    height: var(--favicon-size);
    margin-right: 0.25em;
    max-height: var(--favicon-size);
    max-width: var(--favicon-size);
    width: var(--favicon-size);
  }

  ::part(%EXTRA_CONTENTS_PART% favicon sanitized) {
    visibility: hidden;
  }

  ::part(%EXTRA_CONTENTS_PART% multiselected-highlighter) {
    background: var(--multiselected-color);
    bottom: 0;
    left: 0;
    opacity: var(--multiselected-color-opacity);
    position: absolute;
    right: 0;
    top: 0;
    z-index: 100;
  }

  /* throbber */

  tab-item.subtree-collapsed ::part(%EXTRA_CONTENTS_PART% throbber) {
    margin-right: 0.25em;

    display: inline-block;
    font-size: var(--throbber-size);
    height: var(--throbber-size);
    min-height: var(--throbber-size);
    min-width: var(--throbber-size);
    max-height: var(--throbber-size);
    max-width: var(--throbber-size);
    overflow: hidden;
    padding: 0;
    pointer-events: none;
    position: relative;
    width: var(--throbber-size);
  }

  tab-item.subtree-collapsed ::part(%EXTRA_CONTENTS_PART% throbber-image active) {
    --throbber-color: var(--throbber-color-active);
  }

  tab-item.subtree-collapsed ::part(%EXTRA_CONTENTS_PART% throbber-image) {
    height: var(--throbber-size);
    position: absolute;
    width: calc(var(--throbber-size) * 60);
    animation: throbber 1.05s var(--throbber-animation-steps) infinite;

    fill: var(--throbber-color);
    box-shadow: 0 0 2px var(--throbber-shadow-color);
    -moz-context-properties: fill;
    background: url("/sidebar/styles/throbber.svg") no-repeat;
  }
  :root.simulate-svg-context-fill tab-item.subtree-collapsed ::part(%EXTRA_CONTENTS_PART% throbber-image) {
    background: var(--throbber-color);
    mask: url("/sidebar/styles/throbber.svg") no-repeat left center / 100%;
  }
`;

const THROBBER_ANIMATION = `
  @keyframes throbber {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-100%); }
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
            if (lastActive)
              return Promise.resolve(doActionFor(lastActive, configs.onClick));
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
            if (lastActive)
              return Promise.resolve(doActionFor(lastActive, configs.onMiddleClick));
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
            if (lastActive)
              return Promise.resolve(doActionFor(lastActive, configs.onDblClick));
          }
          break;

        case 'tree-attached':
          if (message.tab.active)
            reserveToUpdateTab(message.tab.id);
          break;

        case 'tree-detached':
          if (lastActiveForTab.get(message.oldParent.id) == message.tab.id)
            reserveToUpdateTab(message.oldParent.id, null, { clear: true });
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

    default:
      switch (message.type) {
        case 'will-cancel-expansion-from-focused-collapsed-tab':
          return Promise.resolve(true);
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
  if (tab.states.includes('collapsed'))
    tryUpdateSuccessorTabFor(tab);
});

browser.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
  reserveToUpdateTab(tabId, tab, { update: true });
}, { properties: ['title', 'favIconUrl', 'status'] });

const highlightedTabsInWindow = new Map();
const reservedOnHighlighted = new Map();

browser.tabs.onHighlighted.addListener(highlightInfo => {
  const timer = reservedOnHighlighted.get(highlightInfo.windowId);
  if (timer)
    clearTimeout(timer);

  reservedOnHighlighted.set(highlightInfo.windowId, setTimeout(async () => {
    reservedOnHighlighted.delete(highlightInfo.windowId);

    const oldHighlighted = highlightedTabsInWindow.get(highlightInfo.windowId) || new Set();
    const newHighlighted = new Set(highlightInfo.tabIds);
    for (const id of oldHighlighted) {
      if (!newHighlighted.has(id))
        browser.tabs.get(id).then(tab => reserveToUpdateTab(id, tab, { update: true }));
    }
    for (const id of newHighlighted) {
      if (!oldHighlighted.has(id))
        browser.tabs.get(id).then(tab => reserveToUpdateTab(id, tab, { update: true }));
    }
    highlightedTabsInWindow.set(highlightInfo.windowId, newHighlighted);
  }, 150));
});

browser.windows.onRemoved.addListener(windowId => {
  reservedOnHighlighted.delete(windowId);
});


function reserveToUpdateTab(tabId, lastActiveTab, options = {}) {
  const timer = reserveToUpdateTab.reserved.get(tabId);
  if (timer)
    clearTimeout(timer);
  reserveToUpdateTab.reserved.set(tabId, setTimeout(() => {
    reserveToUpdateTab.reserved.delete(tabId);
    updateTab(tabId, lastActiveTab, options);
  }, 0));
}
reserveToUpdateTab.reserved = new Map();

async function updateTab(tabId, lastActiveTab = null, { initializing = false, clear = false, update = false } = {}) {
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
    if (!update ||
        lastActiveForTab.get(ancestorId) == lastActiveTab.id)
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

    setContents(tabId);
  }, 0));
}
reserveToSetContents.reserved = new Map();

function setContents(tabId) {
  const contents = contentsForTab.get(tabId);
  if (contents)
    browser.runtime.sendMessage(TST_ID, {
      type:  'set-extra-tab-contents',
      id:    tabId,
      style: THROBBER_ANIMATION, // Gecko doesn't apply animation defined in the owner document to shadow DOM elements...
      contents
    });
  else
    browser.runtime.sendMessage(TST_ID, {
      type: 'clear-extra-tab-contents',
      id:   contents
    });
}

function buildContentsForTab(tab) {
  const active = tab.active ? 'active' : '';
  const highlighter = !tab.active && tab.highlighted ? '<span part="multiselected-highlighter"></span>' : '';
  const icon = tab.status == 'loading' ?
    `<span part="throbber loadnig"><span part="throbber-image ${active}"></span></span>` :
    `<img part="favicon" src="${tab.favIconUrl}">`;
  const label = `<span part="title ${active}" title="${sanitzeForHTML(tab.title)}">${sanitzeForHTML(tab.title)}</span>`;
  const regularActionDragData = {
    type: 'tab',
    data: {
      id:          tab.id,
      asTree:      /tree/.test(configs.tabDragBehavior),
      allowLink:   /link/.test(configs.tabDragBehavior),
      allowDetach: /detach/.test(configs.tabDragBehavior)
    }
  };
  const shiftedActionDragData = {
    type: 'tab',
    data: {
      id:          tab.id,
      asTree:      /tree/.test(configs.tabDragBehaviorShift),
      allowLink:   /link/.test(configs.tabDragBehaviorShift),
      allowDetach: /detach/.test(configs.tabDragBehaviorShift)
    }
  };
  const dragData = {
    'default':       regularActionDragData,
    'Ctrl':          regularActionDragData,
    'MacCtrl':       regularActionDragData,
    'Shift':         shiftedActionDragData,
    'Ctrl+Shift':    shiftedActionDragData,
    'MacCtrl+Shift': shiftedActionDragData
  };
  return `<span part="tab ${active}"
                draggable="true"
                data-drag-data="${sanitzeForHTML(JSON.stringify(dragData))}"
                data-tab-id="${tab.id}"
                >${icon}${label}${highlighter}</span>`;
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

async function expandTreeFor(tabId) {
  const tab = await browser.runtime.sendMessage(TST_ID, {
    type: 'get-tree',
    tab:  tabId
  });
  for (const ancestorId of tab.ancestorTabIds) {
    browser.runtime.sendMessage(TST_ID, {
      type: 'expand-tree',
      tab:  ancestorId
    });
  }
}

function doActionFor(tabId, action) {
  switch (action) {
    case 'focus':
      browser.tabs.update(tabId, { active: true });
      return true;

    case 'close':
      browser.tabs.remove(tabId);
      return true;

    case 'expand':
      expandTreeFor(tabId);
      return true;

    default:
      return false;
  }
}
