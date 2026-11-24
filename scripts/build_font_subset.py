#!/usr/bin/env python3
"""
《一起做猫饼》微信小游戏 — 自动扫描源码文案并裁剪圆体字体子集脚本
功能：
  1. 扫描指定源码目录（默认 05-微信小游戏版本/src）中所有 .js / .json 文件；
  2. 提取所有中文字符、数字、拉丁字母与游戏常用标点/符号，去重排序后写入 chars.txt；
  3. 调用 fonttools (pyftsubset) 从源 TTF 字体裁剪出仅包含所需字形的轻量化子集 TTF；
  4. 输出字数统计、体积压缩比与微信小游戏接入提示。

使用示例：
  python3 build_font_subset.py \
      --src ./05-微信小游戏版本/src \
      --font ./fonts/ResourceHanRoundedCN-Bold.ttf \
      --out ./05-微信小游戏版本/assets/fonts/kissa_round.ttf
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

# 基础必备字符集（数字、大小写字母、常见标点、运算与游戏 HUD 符号）
BASE_CHARS = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
    "，。！？、；：（）【】《》“”‘’—…·×÷＋－％★☆▾▸◄►"
    "→←↑↓"
)

# 匹配需要保留的字符：中文汉字（含扩展A）、中文标点、数字、字母、常用符号
CHAR_PATTERN = re.compile(
    r"[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef0-9A-Za-z·×÷★☆→←↑↓▾▸%+\-:./!?,\s]"
)

# 额外保底文案（如动态拼接数字单位、版本标识、UI 常用状态字）
EXTRA_FALLBACK_TEXT = (
    "一起做猫饼星夜吃茶烘焙小铺街角星夜店樱花露台店月光天台店"
    "开始营业继续营业重新开始返回大厅下一关重玩本关我知道了"
    "关卡备战营业暂停营业大成功新纪录星夜小铺星夜图鉴猫饼排行榜烤盘主题玩法说明"
    "猫饼升级店面设备看板店员棋盘主题猫饼图鉴套餐配方微信好友榜全服总星榜"
    "小铺图鉴排行主题乐音切换搭档总星限时本关特色障碍格冰封格客流出战配置"
    "移位叉揉面补料升阶勺释放厨余篮连星光热潮急单未解锁使用中已收集"
    "奶团小猫饼焦糖猫爪曲奇抹茶猫耳团子蜂蜜猫猫布丁草莓猫咪大福星空猫马卡龙星冠猫神蛋糕"
    "小蜜柑眠眠星兔蜂蜜柴柴安抚猫薄荷茶星月整盘术元气烤炉暴击"
    "经典星夜琥珀盘樱花和果子盘月光星辰盘背景音乐游戏音效开关得分星尘币奖励最高上菜连击"
    "一二三四五六七八九十零百千万亿秒分时第关章阶星级研发通关解锁"
)


def strip_js_comments(text: str) -> str:
    """移除 JS 单行与多行注释，避免把注释里的生僻字打进字体包。"""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"(^|[^:\\])//.*$", r"\1", text, flags=re.MULTILINE)
    return text


def collect_chars(src_dir: Path, include_comments: bool = False) -> tuple[str, int]:
    """扫描源码目录下所有 .js/.json 文件，返回去重排序后的字符集及扫描文件数。"""
    if not src_dir.exists():
        raise FileNotFoundError(f"源码目录不存在: {src_dir}")

    chars = set(BASE_CHARS) | set(EXTRA_FALLBACK_TEXT)
    file_count = 0

    for root, _, files in os.walk(src_dir):
        for name in files:
            if not name.endswith((".js", ".json")):
                continue
            file_path = Path(root) / name
            try:
                content = file_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if not include_comments and name.endswith(".js"):
                content = strip_js_comments(content)
            for ch in CHAR_PATTERN.findall(content):
                if ch not in ("\r", "\n", "\t"):
                    chars.add(ch)
            file_count += 1

    sorted_chars = "".join(sorted(chars))
    return sorted_chars, file_count


def run_subset(font_path: Path, chars_file: Path, out_path: Path) -> None:
    """调用 fonttools (pyftsubset) 生成子集 TTF。"""
    if not font_path.exists():
        raise FileNotFoundError(
            f"源字体文件不存在: {font_path}\n"
            "请先从 https://github.com/cyanohao/resource-han-rounded/releases 下载 "
            "ResourceHanRoundedCN-Bold.ttf 并放入对应目录。"
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "fontTools.subset",
        str(font_path),
        f"--text-file={chars_file}",
        f"--output-file={out_path}",
        "--layout-features=*",
        "--no-hinting",
        "--desubroutinize",
    ]
    print("执行裁剪命令:", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise RuntimeError(
            "pyftsubset 执行失败。请确认已安装 fonttools：pip install fonttools"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="自动扫描《一起做猫饼》源码文字并裁剪微信小游戏轻量化圆体 TTF"
    )
    parser.add_argument(
        "--src",
        default="./05-微信小游戏版本/src",
        help="要扫描的小游戏源码目录（默认: ./05-微信小游戏版本/src）",
    )
    parser.add_argument(
        "--chars-out",
        default="./chars.txt",
        help="导出的去重字符表路径（默认: ./chars.txt）",
    )
    parser.add_argument(
        "--font",
        default="",
        help="原始 TTF 字体路径（如 ./ResourceHanRoundedCN-Bold.ttf）；留空则仅生成 chars.txt",
    )
    parser.add_argument(
        "--out",
        default="./05-微信小游戏版本/assets/fonts/kissa_round.ttf",
        help="输出的子集 TTF 路径（默认: ./05-微信小游戏版本/assets/fonts/kissa_round.ttf）",
    )
    parser.add_argument(
        "--include-comments",
        action="store_true",
        help="是否包含 JS 注释中的字符（默认排除注释以进一步减小体积）",
    )
    args = parser.parse_args()

    src_dir = Path(args.src)
    chars_file = Path(args.chars_out)

    sorted_chars, file_count = collect_chars(src_dir, include_comments=args.include_comments)
    chars_file.parent.mkdir(parents=True, exist_ok=True)
    chars_file.write_text(sorted_chars, encoding="utf-8")

    cjk_count = sum(1 for c in sorted_chars if "\u4e00" <= c <= "\u9fff")
    print(f"[完成] 已扫描 {file_count} 个文件，提取共 {len(sorted_chars)} 个唯一字符（其中汉字 {cjk_count} 个）")
    print(f"[输出] 字符表已保存至: {chars_file.resolve()}")

    if not args.font:
        print("[提示] 未指定 --font 参数，跳过字体裁剪。传入 --font <源TTF路径> 即可一键生成子集字体。")
        return

    font_path = Path(args.font)
    out_path = Path(args.out)
    run_subset(font_path, chars_file, out_path)

    src_kb = font_path.stat().st_size / 1024
    out_kb = out_path.stat().st_size / 1024
    ratio = (1 - out_kb / src_kb) * 100 if src_kb > 0 else 0
    print(f"[成功] 子集字体已生成: {out_path.resolve()}")
    print(f"[体积] {src_kb:.1f} KB -> {out_kb:.1f} KB（体积减少 {ratio:.1f}%）")


if __name__ == "__main__":
    main()
