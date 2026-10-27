"""Native regression for the development-only category lab on the Pixel_7 (1080 × 2400).
Open /dev/category-lab and select Motor: spring first. No production account is used.
"""
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[3] / 'test-results' / 'mobile-categories'
OUTPUT.mkdir(parents=True, exist_ok=True)

def adb(*args):
    return subprocess.run(['adb', *map(str, args)], check=True, capture_output=True, text=True).stdout

def state(name, require_spring=True):
    adb('shell', 'uiautomator', 'dump', '/sdcard/ludora-category-check.xml')
    filename = OUTPUT / f'{name}.xml'
    adb('pull', '/sdcard/ludora-category-check.xml', filename)
    nodes = list(ET.parse(filename).iter('node'))
    texts = [node.get('text', '') for node in nodes]
    header = next(text for text in texts if text.startswith('Laborat'))
    if require_spring:
        assert 'Motor: spring' in texts, 'The test must run inside the spring lab.'
    return header, texts

def expect(index, name):
    header, texts = state(name)
    assert f'SUB {index} ' in header, (name, header)
    return header, texts

def tap(x, y):
    adb('shell', 'input', 'tap', x, y)

def swipe(x1, y1, x2, y2, duration):
    adb('shell', 'input', 'swipe', x1, y1, x2, y2, duration)

def screenshot(name):
    adb('shell', 'screencap', '-p', '/sdcard/ludora-category-check.png')
    adb('pull', '/sdcard/ludora-category-check.png', OUTPUT / f'{name}.png')

assert '1080x2400' in adb('shell', 'wm', 'size').replace(' ', ''), 'Pixel_7 dimensions required.'
header, texts = state('initial', require_spring=False)
if 'Motor: spring' in texts:
    tap(540, 380)
    header, texts = state('native-reset', require_spring=False)
if 'Motor: native' in texts:
    tap(540, 380)
    header, _ = state('spring-selected')
index = int(re.search(r'SUB (\d+)', header).group(1))
while index > 1:
    tap(250, 700)
    index -= 1
    expect(index, f'reset-{index}')

for theme in ['dark', 'light']:
    header, _ = state(f'{theme}-start')
    if f'tema: {theme}' not in header:
        tap(540, 260)
        expect(1, f'{theme}-theme')
    swipe(900, 1400, 200, 1400, 1500)
    expect(2, f'{theme}-slow')
    swipe(900, 1400, 450, 1400, 85)
    expect(3, f'{theme}-fast')
    swipe(500, 1400, 620, 1400, 1500)
    expect(3, f'{theme}-short-return')
    # Android's CANCEL exercises onFinalize without a successful onEnd.
    adb('shell', 'input', 'motionevent', 'DOWN', 900, 1400)
    adb('shell', 'input', 'motionevent', 'MOVE', 650, 1400)
    adb('shell', 'input', 'motionevent', 'MOVE', 350, 1400)
    screenshot(f'{theme}-cancel-during')
    adb('shell', 'input', 'motionevent', 'CANCEL', 350, 1400)
    expect(3, f'{theme}-cancel')
    adb('shell', 'input', 'motionevent', 'DOWN', 800, 700)
    adb('shell', 'input', 'motionevent', 'MOVE', 700, 700)
    adb('shell', 'input', 'motionevent', 'MOVE', 650, 700)
    adb('shell', 'input', 'motionevent', 'CANCEL', 650, 700)
    expect(3, f'{theme}-selector-cancel')
    tap(820, 700)
    expect(4, f'{theme}-direct-click')
    swipe(900, 1400, 200, 1400, 100)
    before, _ = expect(4, f'{theme}-last-limit')
    tap(540, 1060)
    header, _ = expect(4, f'{theme}-button')
    assert int(re.search(r'toques (\d+)', header).group(1)) == int(re.search(r'toques (\d+)', before).group(1)) + 1, header
    swipe(540, 1900, 540, 1100, 600)
    _, texts = expect(4, f'{theme}-vertical')
    assert any('linha 8' in text for text in texts), texts
    swipe(540, 1100, 540, 2000, 600)
    expect(4, f'{theme}-vertical-back')
    screenshot(f'{theme}-icons-and-content')
    for target in [3, 2, 1]:
        tap(250, 700)
        expect(target, f'{theme}-click-{target}')
    swipe(200, 1400, 900, 1400, 100)
    expect(1, f'{theme}-first-limit')
    screenshot(f'{theme}-first-page')
    print(f'PASS Android {theme}: slow/fast, short return, CANCEL, click, bounds, buttons and vertical scroll.', flush=True)
