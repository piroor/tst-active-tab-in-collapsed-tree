# TST Active Tab in Collapsed Tree

[![Build Status](https://travis-ci.org/piroor/tst-active-tab-in-collapsed-tree.svg?branch=trunk)](https://travis-ci.org/piroor/tst-active-tab-in-collapsed-tree)

Installable package is available at https://addons.mozilla.org/firefox/addon/tst-active-tab-in-collapsed-tr/

----

Provides UI to show last active tab in a collapsed tree in Tree Style Tab.

<strong>This is a helper addon for the <a href="https://addons.mozilla.org/firefox/addon/tree-style-tab/">Tree Style Tab</a> 3.4.0 and later, and depends on the <a href="https://github.com/piroor/treestyletab/wiki/Tab-Extra-Contents-API">Tab Extra Contents API</a> introduced at TST 3.4.0.</strong>

If you use TST mainly for grouping tabs for each task, you may be suffered from too much collapsing/expanding trees on switching tasks. This helper addons provides small tab on a collapsed tree, it allows you to access the last active tab in the tree directly without expanding the tree.

Please note that you need to use `:part()` pseudo element selector to apply your custom styling to the active tab indicator. For example:

```css
::part(extra-contents-by-tst-active-tab-in-collapsed-tree_piro_sakura_ne_jp tab) {
   background-color: red !important;
}
```

Available part names can be inspected with the [remote debugger for Tree Style Tab](https://github.com/piroor/treestyletab/wiki/How-to-inspect-tree-of-tabs#how-to-inspect-the-sidebar). (You need to run the debugger for Tree Style Tab, not for TST Active Tab in Collapsed Tree.)

----

Tree Style Tabに対し、折りたたまれたツリー内で最後にアクティブだったタブを表示するUIを提供します。

<strong>このアドオンは<a href="https://addons.mozilla.org/firefox/addon/tree-style-tab/">Tree Style Tab</a> 3.4.0以降用のヘルパーアドオンで、TST 3.4.0以降で導入された<a href="https://github.com/piroor/treestyletab/wiki/Tab-Extra-Contents-API">Tab Extra Contents API</a>に依存しています。</strong>

TSTをタスクごとのタブのグループ分けに使っている場合、タスクを切り替える度にツリーを開閉しないといけないのが煩わしいかもしれません。このヘルパーアドオンは、折りたたまれたツリーの上に小さなタブを表示し、ツリーを展開しなくても、そのツリーの中で最後にアクティブだったタブに直接アクセスできるようにします。
