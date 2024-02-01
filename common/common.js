/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Configs from '/extlib/Configs.js';

export const configs = new Configs({
  heightPercentage: 60,
  closebox: true,
  theme: (() => {
    const matched = navigator.userAgent.match(/Firefox\/(\d+)\.\d+/);
    return (matched && parseInt(matched[1]) >= 89) ? 'proton' : 'photon';
  })(),

  onClick:       'focus',
  onDblClick:    'expand',
  onMiddleClick: '',

  tabDragBehavior:      'tree,detach',
  tabDragBehaviorShift: 'tree,link',

  debug: false
}, {
  localKeys: [
    'debug'
  ]
});

export function nextFrame() {
  return new Promise((resolve, _reject) => {
    window.requestAnimationFrame(resolve);
  });
}
