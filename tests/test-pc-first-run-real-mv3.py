"""TUR058 actual Linux Chromium MV3 user GUI acceptance: local-only synthetic input.

This is not physical Windows Chrome / OAuth / remote provider / 24h acceptance.
It must FAIL if real MV3 cannot be loaded or any local GUI action fails.
"""
import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / 'extension'
HEADLESS = os.environ.get('EMBASIC_HEADLESS', '1') != '0'
CHROME = os.environ.get('CHROMIUM_PATH') or None

with sync_playwright() as playwright, TemporaryDirectory(prefix='embasic-tur058-ui-') as profile:
    kwargs = {'headless': HEADLESS, 'args': ['--no-sandbox', '--disable-dev-shm-usage',
        f'--disable-extensions-except={EXTENSION}', f'--load-extension={EXTENSION}'],
        'timeout': 30000}
    if CHROME:
        kwargs['executable_path'] = CHROME
    context = playwright.chromium.launch_persistent_context(profile, **kwargs)
    try:
        workers = context.service_workers
        if not workers:
            workers = [context.wait_for_event('serviceworker', timeout=15000)]
        worker = next((w for w in workers if w.url.startswith('chrome-extension://')
                       and w.url.endswith('/background.js')), None)
        assert worker is not None, 'NOT_RUN is not PASS: no genuine MV3 worker'
        extension_id = urlparse(worker.url).netloc
        assert worker.evaluate('() => chrome.runtime.getManifest().version') == '1.18.0'
        page = context.new_page()
        failures = []
        page.on('pageerror', lambda error: failures.append(str(error)))
        # The trial deliberately never connects or mutates a live provider.
        network = []
        def reject_network(route):
            network.append(route.request.url)
            route.abort()
        context.route('https://api.github.com/**', reject_network)
        context.route('https://www.googleapis.com/**', reject_network)
        page.goto(f'chrome-extension://{extension_id}/dashboard.html', timeout=15000)
        page.locator('#stateVaultStatus').get_by_text('KASA KURULUMU ZORUNLU').wait_for(timeout=15000)
        page.on('dialog', lambda dialog: dialog.accept())
        password = 'TUR058-only-synthetic-local-vault-1!'
        page.locator('#stateVaultPassword').fill(password)
        page.locator('#stateVaultConfirm').fill(password)
        page.locator('#stateVaultCreate').click()
        page.locator('#stateVaultStatus').get_by_text('ŞİFRELİ / AÇIK').wait_for(timeout=15000)
        page.locator('#project').fill('TUR058 Yalnız Yerel Demo')
        page.locator('#taskName').fill('Deneysel görev')
        page.locator('#instructions').fill('Hakları temiz sentetik bir paragraf hazırla; hiçbir gerçek servis kullanma.')
        page.locator('#maxRuns').fill('1')
        page.locator('#submitTask').click()
        page.locator('#statTasks').get_by_text('1', exact=True).wait_for(timeout=10000)
        page.locator('#statWaiting').get_by_text('1', exact=True).wait_for(timeout=10000)
        page.locator('button[data-tab="workspace"]').click()
        page.locator('#runsList button').first.click()
        assert 'TUR058 Yalnız Yerel Demo' in page.locator('#runPrompt').input_value()
        assert 'hakları temiz' in page.locator('#runPrompt').input_value().lower()
        result = 'Sentetik yanıt kaydedildi. SONRAKİ TUR ÖZETİ: Sadece yerel deneme.'
        page.locator('#modelOutput').fill(result)
        page.locator('#saveResult').click()
        page.locator('#statComplete').get_by_text('1', exact=True).wait_for(timeout=15000)
        assert page.locator('#modelOutput').input_value() == result
        # Genuine background snapshot and ciphertext profile, not DOM mocks.
        actual = page.evaluate('''() => new Promise((resolve, reject) =>
          chrome.runtime.sendMessage({type: 'snapshot'}, response => {
            if (chrome.runtime.lastError) reject(Error(chrome.runtime.lastError.message));
            else resolve(response);
          }))''')
        assert actual['ok'], actual
        assert len(actual['data']['tasks']) == 1 and len(actual['data']['runs']) == 1
        saved = actual['data']['runs'][0]
        assert saved['status'] == 'completed' and saved['output'] == result
        assert saved['driveSync'] == 'disabled' and saved['githubSync'] == 'disabled'
        stored = worker.evaluate('''async () => {
            const all = await chrome.storage.local.get(null);
            return {sealed: !!all.embasicSealedStateV3,
                    legacy: !!all.embasicStateV1 || !!all.embasicStateV2};
          }''')
        assert stored == {'sealed': True, 'legacy': False}, stored
        assert not network, 'Unexpected live provider network access: '+repr(network)
        assert not failures, 'Real extension GUI error(s): '+repr(failures)
        print('PASS TUR058 GENUINE LINUX CHROMIUM MV3 GUI: vault created, task queued, prompt visible, manual response saved in AES-GCM; no provider writes')
        print('NOT_RUN physical Windows, Chrome reparse, OAuth/GitHub, 24h sleep-wake, external WORM')
    finally:
        context.close()
