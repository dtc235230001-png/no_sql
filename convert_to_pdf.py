import os
import sys
import subprocess
from markdown_it import MarkdownIt

def convert_md_to_pdf(md_path, pdf_path, title="Tài liệu Skill"):
    if not os.path.exists(md_path):
        print(f"File not found: {md_path}")
        return False
    
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    # Process YAML frontmatter
    lines = md_text.splitlines()
    body_lines = []
    frontmatter = {}
    in_yaml = False
    yaml_lines = []
    
    for i, line in enumerate(lines):
        if i == 0 and line.strip() == '---':
            in_yaml = True
            continue
        if in_yaml:
            if line.strip() == '---':
                in_yaml = False
                continue
            yaml_lines.append(line)
        else:
            body_lines.append(line)
            
    body_text = '\n'.join(body_lines)
    
    # Initialize Markdown parser
    md = MarkdownIt('commonmark').enable('table').enable('strikethrough')
    content_html = md.render(body_text)
    
    # Build beautiful styling
    html_template = """<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
@page {{
    size: A4;
    margin: 20mm 15mm 20mm 20mm;
    @bottom-center {{
        content: counter(page);
    }}
}}
body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #24292f;
    margin: 0;
    padding: 0;
}}
.header-box {{
    background: linear-gradient(135deg, #0969da 0%, #054da7 100%);
    color: white;
    padding: 24px 28px;
    border-radius: 8px;
    margin-bottom: 24px;
}}
.header-box h1 {{
    color: white;
    margin: 0 0 10px 0;
    padding: 0;
    font-size: 18pt;
    border: none;
}}
.header-box p {{
    margin: 4px 0 0 0;
    opacity: 0.9;
    font-size: 10.5pt;
}}
h1 {{
    font-size: 18pt;
    border-bottom: 2px solid #0969da;
    padding-bottom: 8px;
    margin-top: 28px;
    margin-bottom: 16px;
    color: #0969da;
    page-break-after: avoid;
}}
h2 {{
    font-size: 14pt;
    border-bottom: 1px solid #d0d7de;
    padding-bottom: 6px;
    margin-top: 24px;
    margin-bottom: 12px;
    color: #1f2328;
    page-break-after: avoid;
}}
h3 {{
    font-size: 12pt;
    margin-top: 18px;
    margin-bottom: 8px;
    color: #24292f;
    page-break-after: avoid;
}}
h4 {{
    font-size: 11pt;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
}}
p {{
    margin-top: 0;
    margin-bottom: 10px;
    text-align: justify;
}}
table {{
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
}}
th, td {{
    border: 1px solid #d0d7de;
    padding: 7px 10px;
    text-align: left;
    vertical-align: top;
}}
th {{
    background-color: #f6f8fa;
    font-weight: 600;
    color: #1f2328;
}}
tr:nth-child(even) {{
    background-color: #fbfcfd;
}}
code {{
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9pt;
    background-color: rgba(175, 184, 193, 0.2);
    padding: 2px 5px;
    border-radius: 4px;
    color: #0969da;
}}
pre {{
    background-color: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;
    font-size: 8.5pt;
    line-height: 1.45;
    page-break-inside: avoid;
}}
pre code {{
    background-color: transparent;
    padding: 0;
    color: #24292f;
}}
blockquote {{
    border-left: 4px solid #0969da;
    color: #57606a;
    padding: 6px 16px;
    margin: 12px 0;
    background-color: #f6f8fa;
    border-radius: 0 4px 4px 0;
}}
hr {{
    border: 0;
    border-top: 1px solid #d0d7de;
    margin: 20px 0;
}}
ul, ol {{
    padding-left: 22px;
    margin-top: 0;
    margin-bottom: 12px;
}}
li {{
    margin-bottom: 4px;
}}
input[type="checkbox"] {{
    margin-right: 6px;
}}
.badge {{
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 8pt;
    font-weight: 600;
    background-color: #ddf4ff;
    color: #0969da;
}}
</style>
</head>
<body>
{content}
</body>
</html>"""

    html_out = html_template.format(title=title, content=content_html)
    temp_html = md_path + ".temp.html"
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_out)
        
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "msedge"
    ]
    
    edge_exe = None
    for ep in edge_paths:
        if os.path.exists(ep) or ep == "msedge":
            edge_exe = ep
            break
            
    abs_html = os.path.abspath(temp_html)
    abs_pdf = os.path.abspath(pdf_path)
    
    cmd = [
        edge_exe,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={abs_pdf}",
        f"file:///{abs_html}"
    ]
    
    print(f"Printing {md_path} -> {pdf_path} via Edge...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    
    if os.path.exists(temp_html):
        try:
            os.remove(temp_html)
        except:
            pass
            
    if os.path.exists(abs_pdf):
        size_kb = round(os.path.getsize(abs_pdf) / 1024, 1)
        print(f" SUCCESS: Generated {abs_pdf} ({size_kb} KB)")
        return True
    else:
        print(f" FAILED to generate {abs_pdf}")
        print("STDERR:", res.stderr)
        return False

if __name__ == "__main__":
    files = [
        ("skill.md", "skill.pdf", "SKILL: Hướng dẫn Soạn thảo Báo cáo Đồ án ICTU"),
        ("skills/build-report/SKILL.md", "skills/build-report/SKILL.pdf", "SKILL: Sinh viên Viết Báo cáo Đồ án ICTU"),
        ("skills/build-report/SKILL.md", "SKILL_build_report.pdf", "SKILL: Sinh viên Viết Báo cáo Đồ án ICTU")
    ]
    
    for src, dst, title in files:
        convert_md_to_pdf(src, dst, title)
