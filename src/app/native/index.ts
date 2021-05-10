import {registerPlugin} from '@capacitor/core';

import type {NativePlugin} from './definitions';

const AikumaNative = registerPlugin<NativePlugin>('AikumaNative', {
	web: () => import('./web').then(m => new m.NativePluginWeb()),
});

export * from './definitions';
export {AikumaNative};
