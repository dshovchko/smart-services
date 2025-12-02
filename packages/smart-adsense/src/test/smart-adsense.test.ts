import {describe, test, expect} from 'vitest';
import {promisifyTimeout} from '@exadel/esl/modules/esl-utils/async';
import {SmartAdsense} from '../core/smart-adsense';

describe('SmartAdsense', () => {
  const defaultConfig = {
    name: 'Adsense',
    retryDelay: 20,
    retryCount: 3,
    refreshInterval: 0,
    refreshOnResize: false,
    attrs: {crossorigin: 'anonymous'}
  };

  test('should have default config', () => {
    expect(SmartAdsense.config()).toEqual(defaultConfig);
  });

  test('should dispatch custom event on ad status change', async () => {
    document.body.innerHTML = '<div id="test"></div>';
    const $test = document.getElementById('test') as HTMLElement;
    const log: string[] = [];
    const handler = (event: CustomEvent) => {
      log.push(event.detail);
    };
    $test.addEventListener('adsense:status', handler);

    (SmartAdsense.instance as any)._onLoadScript();
    $test.dataset.adStatus = 'unfilled';
    await promisifyTimeout(30);
    expect(log).toEqual(['unfilled']);

    $test.removeEventListener('adsense:status', handler);
  });
});
