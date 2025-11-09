# Assets

このディレクトリには、拡張機能で使用するアセットファイルを配置します。

## Icons

以下のサイズのアイコン画像が必要です：

- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

### アイコン作成方法

1. 適切な画像編集ツール（Photoshop、GIMP、Figma等）を使用
2. GitHub風のデザインで作成
3. 背景は透過（PNG形式）

### 仮アイコンの作成

開発中は、以下のようなシンプルなアイコンを使用できます：

```bash
# ImageMagickを使用した仮アイコン作成例
convert -size 16x16 xc:#0969da icon16.png
convert -size 48x48 xc:#0969da icon48.png
convert -size 128x128 xc:#0969da icon128.png
```

または、オンラインツールを使用：
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/

