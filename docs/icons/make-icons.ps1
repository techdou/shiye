# 拾页图标生成：SVG 同款设计，C# 内联编译绘制（保守 C#2 语法，兼容 PS5.1 CodeDom）
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class IconGen {
  public static Bitmap Draw(int size, bool maskable) {
    float k = size / 512f;
    if (maskable) { k = k * 0.74f; }

    Color accent = Color.FromArgb(255, 196, 82, 47);
    Color paper  = Color.FromArgb(255, 250, 248, 242);
    Color fold   = Color.FromArgb(255, 230, 217, 194);
    int[] inkAlpha = new int[] { 205, 128, 72 };
    int[] lineY    = new int[] { 256, 296, 336 };
    int[] lineW    = new int[] { 130, 94, 114 };

    Bitmap bmp = new Bitmap(size, size);
    Graphics g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;

    GraphicsPath bg = new GraphicsPath();
    if (maskable) {
      bg.AddRectangle(new Rectangle(0, 0, size, size));
    } else {
      float r = size * 0.2266f;
      bg.AddArc(0, 0, r * 2, r * 2, 180, 90);
      bg.AddArc(size - r * 2, 0, r * 2, r * 2, 270, 90);
      bg.AddArc(size - r * 2, size - r * 2, r * 2, r * 2, 0, 90);
      bg.AddArc(0, size - r * 2, r * 2, r * 2, 90, 90);
      bg.CloseFigure();
    }
    SolidBrush bAccent = new SolidBrush(accent);
    g.FillPath(bAccent, bg);
    bAccent.Dispose();
    bg.Dispose();

    if (maskable) {
      g.TranslateTransform(size / 2f, size / 2f);
      g.ScaleTransform(0.74f, 0.74f);
      g.TranslateTransform(-size / 2f, -size / 2f);
    }

    GraphicsPath page = new GraphicsPath();
    page.StartFigure();
    page.AddLine(174 * k, 106 * k, 296 * k, 106 * k);
    page.AddLine(296 * k, 106 * k, 358 * k, 168 * k);
    page.AddLine(358 * k, 168 * k, 358 * k, 376 * k);
    page.AddArc(332 * k, 376 * k, 26 * k, 26 * k, 0, 90);
    page.AddLine(332 * k, 402 * k, 174 * k, 402 * k);
    page.AddArc(148 * k, 376 * k, 26 * k, 26 * k, 90, 90);
    page.AddLine(148 * k, 376 * k, 148 * k, 132 * k);
    page.AddArc(148 * k, 106 * k, 26 * k, 26 * k, 180, 90);
    page.CloseFigure();
    SolidBrush bPaper = new SolidBrush(paper);
    g.FillPath(bPaper, page);
    bPaper.Dispose();
    page.Dispose();

    PointF[] foldPts = new PointF[4];
    foldPts[0] = new PointF(296 * k, 106 * k);
    foldPts[1] = new PointF(296 * k, 142 * k);
    foldPts[2] = new PointF(322 * k, 168 * k);
    foldPts[3] = new PointF(358 * k, 168 * k);
    GraphicsPath fp = new GraphicsPath();
    fp.AddLines(foldPts);
    fp.CloseFigure();
    SolidBrush bFold = new SolidBrush(fold);
    g.FillPath(bFold, fp);
    bFold.Dispose();
    fp.Dispose();

    PointF[] ribPts = new PointF[5];
    ribPts[0] = new PointF(216 * k, 106 * k);
    ribPts[1] = new PointF(216 * k, 216 * k);
    ribPts[2] = new PointF(244 * k, 190 * k);
    ribPts[3] = new PointF(272 * k, 216 * k);
    ribPts[4] = new PointF(272 * k, 106 * k);
    GraphicsPath rp = new GraphicsPath();
    rp.AddLines(ribPts);
    rp.CloseFigure();
    SolidBrush bAccent2 = new SolidBrush(accent);
    g.FillPath(bAccent2, rp);
    rp.Dispose();
    bAccent2.Dispose();

    for (int i = 0; i < 3; i++) {
      float rr = 8 * k;
      float x = 188 * k;
      float y = lineY[i] * k;
      float w = lineW[i] * k;
      float h = 16 * k;
      GraphicsPath lp = new GraphicsPath();
      lp.AddArc(x, y, rr * 2, rr * 2, 180, 90);
      lp.AddArc(x + w - rr * 2, y, rr * 2, rr * 2, 270, 90);
      lp.AddArc(x + w - rr * 2, y + h - rr * 2, rr * 2, rr * 2, 0, 90);
      lp.AddArc(x, y + h - rr * 2, rr * 2, rr * 2, 90, 90);
      lp.CloseFigure();
      SolidBrush bInk = new SolidBrush(Color.FromArgb(inkAlpha[i], 74, 66, 55));
      g.FillPath(bInk, lp);
      bInk.Dispose();
      lp.Dispose();
    }

    g.Dispose();
    return bmp;
  }
}
"@
Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Drawing

$bmp1 = [IconGen]::Draw(512, $false); $bmp1.Save("$dir\icon-512.png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp1.Dispose()
$bmp2 = [IconGen]::Draw(192, $false); $bmp2.Save("$dir\icon-192.png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp2.Dispose()
$bmp3 = [IconGen]::Draw(512, $true);  $bmp3.Save("$dir\icon-maskable-512.png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp3.Dispose()
Write-Host "icons done: $dir"
