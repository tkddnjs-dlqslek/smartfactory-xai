# -*- coding: utf-8 -*-
"""슬라이드 5·6용 Tab01 하단 섹션(NLG 보고서 · 이상 이력) 캡처.
Tab01 scrollHeight=1474 → scroll 574 ~ 1474 사이 구간 저장.
실행: C:/anaconda/python.exe scripts/capture_fullpage.py
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
from PIL import Image

SHOTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "output", "_pptx_shots")
BASE_URL = "https://smartfactory-xai.vercel.app"


async def shoot(page, scroll_y, filename):
    await page.evaluate(f"window.scrollTo(0, {scroll_y})")
    await page.wait_for_timeout(600)
    out_path = os.path.join(SHOTS, filename)
    await page.screenshot(path=out_path)
    img = Image.open(out_path)
    print(f"  {filename}: {img.size}")
    img.close()


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1600, "height": 900},
                                        device_scale_factor=1)
        page = await ctx.new_page()

        print("Render 웜업 및 Tab01 로드...")
        sys.stdout.flush()
        await page.goto(BASE_URL + "/dashboard", wait_until="networkidle", timeout=90000)
        await page.wait_for_timeout(4000)

        doc_h = await page.evaluate("() => document.documentElement.scrollHeight")
        print(f"Tab01 scrollHeight={doc_h}")
        sys.stdout.flush()

        # ── 슬라이드 5: NLG 보고서가 보이는 위치 (3열 섹션 상단 기준)
        # scrollHeight=1474, viewport=900 → 하단 3열 섹션 시작 ≈ scroll 470~530
        print("\n[Slide 5] NLG 보고서 섹션 캡처...")
        sys.stdout.flush()
        await shoot(page, max(0, doc_h - 900), "03_tab1_danger_nlg.png")

        # ── 슬라이드 6: 이상 감지 이력 섹션 (같은 스크롤 위치 — 3열 섹션에 함께 있음)
        # 같은 스크린샷이지만 파일명 분리해 각 슬라이드에서 교체 가능하게 유지
        print("\n[Slide 6] 이상 감지 이력 섹션 캡처 (라이브 스트림 모드)...")
        sys.stdout.flush()
        # ▶ LIVE 시작 버튼 클릭 시도
        try:
            btn = page.locator("button:has-text('▶'), button:has-text('LIVE'), a:has-text('▶ LIVE')").first
            await btn.click(timeout=4000)
            await page.wait_for_timeout(6000)  # 몇 샷 스트리밍
            print("  LIVE 시작 성공")
        except Exception as e:
            print(f"  LIVE 시작 실패(정적 캡처 사용): {e}")
        sys.stdout.flush()
        await shoot(page, max(0, doc_h - 900), "05_tab1_live_nlg.png")

        await browser.close()
        print("\n완료")

asyncio.run(main())
