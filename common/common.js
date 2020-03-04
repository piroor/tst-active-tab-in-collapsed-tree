/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Configs from '/extlib/Configs.js';

export const configs = new Configs({
  onClick:       'focus',
  onDblClick:    'expand',
  onMiddleClick: 'close',

  tabDragBehavior:      'tree,detach',
  tabDragBehaviorShift: 'tree,link'
}, {
  localKeys: [
  ]
});
