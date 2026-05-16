#!/usr/bin/env python3
"""
Markdown → HTML 批量轉換工具
摘要系統格式轉換規劃 v1.0

功能:
  - 讀取 Markdown 檔案
  - 透過 pandoc 轉換核心語法（若無 pandoc 則用內建 fallback）
  - 套用 templates/base.html 模板
  - 自動產生側邊 TOC
  - 輸出自包含 HTML 到 專案相關文件/

用法:
  python3 md_to_html.py                    # 轉換所有待轉 Markdown
  python3 md_to_html.py 文件摘要.md        # 轉換單一文件
  python3 md_to_html.py --all              # 轉換所有 .md（排除 html-effectiveness/ 和 templates/）
"""

import os
import re
import sys
import subprocess
from pathlib import Path
from datetime import datetime

# ── 路徑設定 ──────────────────────────────────────────────
DOCUMENTS_DIR = Path(os.environ.get("DOCS_DIR", Path(__file__).resolve().parents[1]))
TEMPLATES_DIR = DOCUMENTS_DIR / "templates"
OUTPUT_DIR = DOCUMENTS_DIR / "html"
STYLE_CSS = TEMPLATES_DIR / "style.css"
BASE_HTML = TEMPLATES_DIR / "base.html"

# ── 轉換映射定義 ──────────────────────────────────────────
# 來源 Markdown → 輸出 HTML 對應
CONVERSION_MAP = [
    ("README.md", "index.html", "技術文件總目錄"),
    ("architecture/overview.md", "architecture_overview.html", "架構總覽"),
    ("data/bigquery_architecture.md", "data_bigquery_architecture.html", "BigQuery 架構"),
    ("data/field_mapping.md", "data_field_mapping.html", "欄位對照"),
    ("ai/expert_details.md", "ai_expert_details.html", "AI 專家"),
    ("analytics/looker_studio.md", "analytics_looker_studio.html", "Looker Studio"),
]

# 不轉換的檔案（保留為 Markdown）
SKIP_FILES = {
    ".DS_Store", "README.md", "index.md",  # index.md 保留 Markdown 作為入口
    "文件摘要.md",  # 轉換後保留一份 HTML 版本，Markdown 可備查
}


def check_pandoc():
    """檢查 pandoc 是否可用"""
    try:
        subprocess.run(["pandoc", "--version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def markdown_to_html_pandoc(md_text: str, title: str) -> str:
    """使用 pandoc 轉換 Markdown → HTML"""
    body_text = re.sub(r'^#\s+.+\n+', '', md_text, count=1, flags=re.MULTILINE)
    result = subprocess.run(
        [
            "pandoc",
            "--from=markdown",
            "--to=html5",
            f"--metadata=title:{title}",
            "--standalone=false",
            "--wrap=preserve",
            "--highlight-style=pygments",
        ],
        input=body_text,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def generate_heading_id(title: str) -> str:
    """根據標題文字生成 anchor id（與 generate_toc 一致）"""
    return re.sub(r'[^\w\s-]', '', title).lower().replace(' ', '-')


def markdown_to_html_fallback(md_text: str) -> str:
    """內建 fallback：簡易 Markdown → HTML 轉換"""
    html = re.sub(r'^#\s+.+\n+', '', md_text, count=1, flags=re.MULTILINE)

    # 轉換標題（h2 加上 id 以便 TOC 連結正確）
    def h3_replacer(m):
        return f'<h3>{m.group(1)}</h3>'
    html = re.sub(r'^### (.+)$', h3_replacer, html, flags=re.MULTILINE)

    def h2_replacer(m):
        title = m.group(1)
        anchor = generate_heading_id(title)
        return f'<h2 id="{anchor}">{title}</h2>'
    html = re.sub(r'^## (.+)$', h2_replacer, html, flags=re.MULTILINE)

    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)

    # 轉換粗體/斜體
    html = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', html)
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)

    # 轉換行內程式碼
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)

    # 轉換無序列表
    lines = html.split('\n')
    in_list = False
    result_lines = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith('- '):
            if not in_list:
                result_lines.append('<ul>')
                in_list = True
            content = stripped[2:]
            # 處理列表中的 code
            content = re.sub(r'`([^`]+)`', r'<code>\1</code>', content)
            result_lines.append(f'  <li>{content}</li>')
        elif stripped.startswith('  - '):
            # 巢狀列表
            content = stripped[4:]
            content = re.sub(r'`([^`]+)`', r'<code>\1</code>', content)
            result_lines.append(f'    <li>{content}</li>')
        else:
            if in_list and not stripped.startswith('-') and not stripped.startswith('  -'):
                result_lines.append('</ul>')
                in_list = False
            if stripped:
                # 處理段落中的 inline code 和粗體
                processed = re.sub(r'`([^`]+)`', r'<code>\1</code>', stripped)
                processed = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', processed)
                if processed and not processed.startswith('<'):
                    result_lines.append(f'<p>{processed}</p>')
                elif processed:
                    result_lines.append(processed)
            else:
                result_lines.append('')

    if in_list:
        result_lines.append('</ul>')

    html = '\n'.join(result_lines)

    # 轉換分隔線
    html = re.sub(r'^---$', '<hr class="rule">', html, flags=re.MULTILINE)

    # 轉換連結 [text](url)
    html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)

    # 轉換 blockquote
    html = re.sub(r'^> (.+)$', r'<blockquote><p>\1</p></blockquote>', html, flags=re.MULTILINE)

    return html


def normalize_generated_html(content_html: str, md_text: str = None) -> str:
    """移除 pandoc 產生的 inline table style，並套用專案表格 class。"""
    html = re.sub(r'<colgroup>.*?</colgroup>\n?', '', content_html, flags=re.DOTALL)
    html = re.sub(r'\sstyle="[^"]*"', '', html)
    html = re.sub(r'<table>', '<table class="compare">', html)
    return html


def generate_toc(md_text: str) -> str:
    """從 Markdown 標題生成側邊 TOC HTML"""
    toc_items = []
    lines = md_text.split('\n')
    for line in lines:
        m = re.match(r'^(#{2,3})\s+(.+)$', line)
        if m:
            level = len(m.group(1)) - 1  # h2=1, h3=2
            title = m.group(2).strip()
            # 生成 anchor（移除數字前綴以與 pandoc 行為一致）
            # pandoc 會移除 "01 "、"1. " 等數字前綴
            anchor = re.sub(r'^\d+[\s.]*', '', title)  # 移除開頭數字
            anchor = re.sub(r'[^\w\s-]', '', anchor).lower().replace(' ', '-')
            indent = '  ' * (level - 1)
            toc_items.append(f'{indent}<a href="#{anchor}" class="toc-link">{title}</a>')

    if not toc_items:
        return ''

    items_html = '\n'.join(toc_items)
    return f'''<nav class="toc">
{items_html}
</nav>'''


def extract_title(md_text: str) -> str:
    """從 Markdown 提取第一個 H1 作為標題，去除附註類後綴"""
    m = re.search(r'^#\s+(.+)$', md_text, re.MULTILINE)
    if m:
        raw = m.group(1).strip()
        # 去除 TOON Format 等附註
        raw = re.sub(r'\s*\(.*(?:TOON|Format|格式)\)', '', raw)
        return raw
    return "未命名文件"


def extract_heading_content(md_text: str) -> str:
    """提取 H1 後的第一段非空白文字作為副標題"""
    parts = re.split(r'^# .+$', md_text, maxsplit=1, flags=re.MULTILINE)
    if len(parts) > 1:
        lines = parts[1].strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # 跳過附註行（> 類型:...）、分隔線、空行和純語法符號行
            if line.startswith('>') or line.startswith('#') or line.startswith('---'):
                continue
            # 跳過純語法符號行（如 ```、***）
            stripped_content = line.strip()
            if stripped_content in ('```', '---', '***', '___'):
                continue
            if stripped_content.startswith('```'):
                continue
            # 跳過列表項（以 - 或數字+. 開頭）—— 不是真正的段落
            if stripped_content.startswith('- ') or re.match(r'^\d+\.\s', stripped_content):
                continue
            # 跳過表格行（以 | 開頭）
            if stripped_content.startswith('|'):
                continue
            # 去除行內的 markdown link 語法但保留文字
            line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
            return line[:120]
    return ''


md_to_html_map = {src: dst for src, dst, _ in CONVERSION_MAP}


def fix_links_in_all_html():
    """掃描輸出目錄中所有 HTML，替換其中指向 .md 的連結為 .html

    策略：根據 MD 檔名的 stem 匹配 HTML 檔名的 stem，進行替換。
    """
    # 收集輸出目錄中所有 HTML 文件的 stem → 完整文件名
    html_by_stem = {}
    for html_file in OUTPUT_DIR.glob('**/*.html'):
        html_by_stem[html_file.stem] = str(html_file.relative_to(OUTPUT_DIR))

    # 建立 MD → HTML 的完整映射（包含 stem 匹配的回退）
    md_stem_to_html = {}
    for md_src, html_dst, _ in CONVERSION_MAP:
        md_stem = Path(md_src).stem
        md_stem_to_html[md_stem] = html_dst

    # 統計修復數量
    fixed_count = 0

    for html_file in OUTPUT_DIR.glob('**/*.html'):
        html = html_file.read_text(encoding='utf-8')
        original = html

        # ── 修復 href="./xxx.md" ──
        def replace_href_md(m):
            nonlocal fixed_count
            href = m.group(1)
            if not (href.startswith('./') or href.startswith('.\\')):
                return m.group(0)
            if not href.endswith('.md'):
                return m.group(0)
            bare = href[2:]  # 去掉 ./ 前綴

            # 1) 精確匹配：直接用 md 文件名查找
            if bare in md_to_html_map:
                fixed_count += 1
                return f'href="./{md_to_html_map[bare]}"'

            # 2) stem 匹配
            bare_stem = Path(bare).stem
            if bare_stem in md_stem_to_html:
                fixed_count += 1
                return f'href="./{md_stem_to_html[bare_stem]}"'

            # 3) 在輸出目錄的 HTML 中查找同名 stem
            if bare_stem in html_by_stem:
                fixed_count += 1
                return f'href="./{html_by_stem[bare_stem]}"'

            return m.group(0)

        html = re.sub(r'href="([^"]*\.md)"', replace_href_md, html)

        # ── 修復 Markdown 語法連結 [text](./xxx.md) ──
        def replace_md_syntax_link(m):
            nonlocal fixed_count
            full = m.group(0)
            inner = m.group(1)  # text
            href_match = re.search(r'\(([^)]+)\)', full)
            if not href_match:
                return full
            href = href_match.group(1)
            if not (href.startswith('./') or href.startswith('.\\')):
                return full
            if not href.endswith('.md'):
                return full
            bare = href[2:]

            # 精確匹配
            if bare in md_to_html_map:
                fixed_count += 1
                return f'[{inner}](./{md_to_html_map[bare]})'

            # stem 匹配
            bare_stem = Path(bare).stem
            if bare_stem in md_stem_to_html:
                fixed_count += 1
                return f'[{inner}](./{md_stem_to_html[bare_stem]})'
            if bare_stem in html_by_stem:
                fixed_count += 1
                return f'[{inner}](./{html_by_stem[bare_stem]})'

            return full

        html = re.sub(r'\[([^\]]+)\]\(\.[^)]+\.md\)', replace_md_syntax_link, html)

        if html != original:
            html_file.write_text(html, encoding='utf-8')
            print(f"  🔗 已修復連結: {html_file.name}")

    print(f"  📊 共修復 {fixed_count} 個 .md 連結")


def convert_file(src_name: str, entry: tuple) -> Path | None:
    """轉換單一 Markdown 文件為 HTML"""
    src_name, dst_name, category = entry
    src_file = DOCUMENTS_DIR / src_name

    if not src_file.exists():
        print(f"  ⚠️  源文件不存在: {src_file}")
        return None

    md_text = src_file.read_text(encoding='utf-8')
    title = extract_title(md_text)
    subtitle = extract_heading_content(md_text)
    toc = generate_toc(md_text)

    # 選擇轉換引擎
    if check_pandoc():
        print(f"  🔧 使用 pandoc 轉換: {src_name}")
        content_html = markdown_to_html_pandoc(md_text, title)
    else:
        print(f"  🔧 使用內建 fallback 轉換: {src_name}")
        content_html = markdown_to_html_fallback(md_text)
    content_html = normalize_generated_html(content_html)

    # 讀取模板
    template = BASE_HTML.read_text(encoding='utf-8')

    # 替換模板佔位符
    html = template
    html = html.replace('%TITLE%', title)
    html = html.replace('%CATEGORY%', category)
    html = html.replace('%SUBTITLE_BLOCK%', f'<p class="subtitle">{subtitle}</p>' if subtitle else '')
    html = html.replace('%TOC_BLOCK%', toc if toc else '<!-- no toc -->')
    html = html.replace('%CONTENT%', content_html)
    html = html.replace('%FOOTER_LEFT%', f'{category} · {datetime.now().strftime("%Y-%m-%d")}')

    # 建立輸出目錄
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 寫入 HTML（若 dst_name 含子目錄，建立對應目錄）
    out_path = OUTPUT_DIR / dst_name
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding='utf-8')
    print(f"  ✅ 已輸出: {out_path}")
    return out_path


def main():
    mode = 'map'  # 預設只轉換映射列表中的文件

    if len(sys.argv) > 1:
        if sys.argv[1] == '--all':
            mode = 'all'
        else:
            # 指定單一文件
            for arg in sys.argv[1:]:
                found = False
                for entry in CONVERSION_MAP:
                    if entry[0] == arg:
                        convert_file(arg, entry)
                        found = True
                        break
                if not found:
                    # 自動推斷輸出名稱
                    src = Path(arg)
                    dst_name = src.stem + '.html'
                    category = src.stem.replace('_', ' ').title()
                    convert_file(str(src), (arg, dst_name, category))
            return

    if mode == 'all':
        # 轉換所有 Markdown（排除特殊目錄），包含子目錄
        md_files = []
        for f in DOCUMENTS_DIR.glob('**/*.md'):
            if f.name not in SKIP_FILES and not f.name.startswith('.'):
                rel = f.relative_to(DOCUMENTS_DIR)
                dst_name = str(rel).replace('.md', '.html')
                category = f.stem.replace('_', ' ').title()
                md_files.append((str(rel), dst_name, category))

        print(f"\n📂 發現 {len(md_files)} 個待轉換 Markdown 文件\n")
        for entry in md_files:
            convert_file(entry[0], entry)
    else:
        # 只轉換 CONVERSION_MAP 中的文件
        print(f"\n📋 轉換映射列表 ({len(CONVERSION_MAP)} 個文件)\n")
        for entry in CONVERSION_MAP:
            convert_file(entry[0], entry)

    # ── 統一修復所有 HTML 中的 .md 連結 ──
    print("\n🔗 開始修復 HTML 中的 .md 連結...")
    fix_links_in_all_html()

    # 複製樣式表到輸出目錄（相對路徑已指向 templates/）
    print(f"\n📁 樣式表位置: {STYLE_CSS}")
    print(f"📁 模板位置: {BASE_HTML}")
    print(f"\n✅ 轉換完成！HTML 文件位於: {OUTPUT_DIR}/")


if __name__ == '__main__':
    main()
