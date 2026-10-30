# 3Dshorts

用程式做直式 3D 短片的引擎。沒有 AI 影片模型：每一幀都由 three.js 在無頭 Chrome 裡畫出來，時間軸完全由腳本決定，同一份腳本會得到同一組畫面。

這版附一支 10 秒示範：四隻 [Kenney Cube Pets](https://kenney.nl/assets/cube-pets)（狗、貓、小雞、豬）在草地上玩球、輪流叫，鏡頭大約每 1 秒切一次。

## 流程

1. **腳本** `scripts/*.json`：誰出場、站哪、哪一句叫、做什麼動作、叫完停多久。
2. **聲音**：內建合成的擬聲（汪、喵、唧、哼），不需要 API 金鑰。每段聲音的振幅包絡會驅動那隻動物的擠壓、伸展與點頭。
3. **鏡頭規劃**：依台詞自動切鏡。叫的時候給特寫（或腳本指定的雙人鏡），停頓夠長就切回遠景，開頭與結尾是全員遠景。每一鏡大約 0.8–3 秒。
4. **逐幀渲染**：Puppeteer 打開 headless Chrome，每幀把時間設到 `frame / fps`（不使用即時時鐘），截 1080×1920。
5. **成片**：ffmpeg 把音效疊在很輕的五聲音階配樂上（有人叫時配樂會閃避），壓到大約 -14 LUFS，再和畫面編成 H.264 MP4。

```bash
npm install
npm test
npm run render -- scripts/cube-pets-demo.json
```

成品在 `out/cube-pets-demo.mp4`。倉庫裡已提交同一支片：`examples/cube-pets-demo.mp4`（1080×1920、30fps、正好 10 秒，整合響度 -14.0 LUFS，真峰值約 -3.7 dBFS）。

## 環境

- Node.js 20 以上
- ffmpeg 與 ffprobe（含 `ebur128`、`acompressor`、`libx264`、`aac`）
- Google Chrome 或 Chromium。預設會找 `google-chrome`；否則設定 `CHROME_PATH`

渲染使用 SwiftShader 軟體 WebGL（`--use-angle=swiftshader`），所以不依賴 GPU，同一台機器、同一個 Chrome 版本重跑，畫面會一致。

## 資料夾

| 路徑 | 內容 |
| --- | --- |
| `scripts/` | 影片腳本 JSON |
| `src/cli.mjs` | `npm run render` 的進入點 |
| `src/timeline.mjs` | 把台詞換成絕對時間 |
| `src/shot-planner.mjs` | 鏡頭規劃 |
| `src/playback.mjs` | `pose = f(腳本, t)`，渲染與測試共用 |
| `src/audio.mjs` | 擬聲合成、配樂、混音、WAV |
| `src/stage/` | three.js 舞台（只負責把 pose 畫出來） |
| `assets/models/` | Cube Pets GLB 與共用 `Textures/colormap.png` |
| `assets/fonts/` | 字幕用的 Nunito |
| `assets/licenses/` | 素材授權全文 |
| `out/` | 渲染輸出（不進 git） |
| `examples/` | 已渲染的示範 MP4 |

`npm run setup-assets` 會在模型遺失時重新下載 Kenney 的 Cube Pets。一般 clone 已經含模型，不必跑。

## 寫一支新腳本

複製 `scripts/cube-pets-demo.json`。時間是秒。`intro` 之後依序排 `lines`，每一句佔 `duration + pauseAfter`。全部排完若還不到 `duration`，剩下的尾巴會播 `finale`。

```json
{
  "id": "my-episode",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "duration": 10,
  "intro": 1.0,
  "finale": "celebrate",
  "characters": [
    {
      "id": "dog",
      "model": "assets/models/animal-dog.glb",
      "position": [-0.3, 0, 0.4],
      "rotationY": 0.1,
      "scale": 0.74,
      "sound": "woof",
      "caption": "Woof!"
    }
  ],
  "lines": [
    {
      "speaker": "dog",
      "action": "hop",
      "sound": "woof",
      "caption": "Woof!",
      "duration": 1.15,
      "pauseAfter": 1.0
    }
  ]
}
```

- `sound` 目前內建 `woof`、`meow`、`cheep`、`oink`。省略時用該角色的預設音。音效長度必須小於等於這句的 `duration`。
- `action`：`hop`（跳）、`spin`（原地扭一下）、`dance`、`bounce`、`chase`（要配 `duringPause`）、`celebrate`、`gesture-positive`、`gesture-negative`。沒寫到的名字會退回 idle。
- `shot` 可覆寫這一句的鏡頭：`closeup`（預設）、`two`、`wide`。雙人鏡用 `secondary` 指定另一隻。
- `duringPause` 在叫完之後的停頓播放動作，例如 `{ "actor": "dog", "action": "chase", "target": "cat" }`。`actor` 可以是 `"*"`，表示全員。
- Cube Pets 的 GLB 都有同一組動畫：`idle`、`walk`、`run`、`dance`、`gesture-positive`、`gesture-negative`。換成同包的 `animal-bunny.glb` 等，不用改引擎。腳色模型、站位、腳本都可以換，場景燈光與草地在 `src/stage/main.js`。

只看幾個時間點、不編碼：

```bash
npm run render -- scripts/cube-pets-demo.json --preview 0.5,1.3,4.7
```

畫面格式預設 jpeg（給 ffmpeg）。要無損序列可加 `--format png`。

## 授權

- **模型**：Kenney《Cube Pets》2.0，[CC0](https://creativecommons.org/publicdomain/zero/1.0/)。原文在 `assets/licenses/Kenney-Cube-Pets-CC0.txt`。感謝 [Kenney](https://kenney.nl)。
- **字幕字型**：Nunito，SIL Open Font License。全文在 `assets/licenses/Nunito-OFL.txt`。
- **聲音與配樂**：這個專案自己合成的，沒有取用第三方錄音，可隨專案使用。

## 限制

- 聲音是風格化合成，不是真實動物錄音，也還沒接 ElevenLabs 或逐字時間戳。同步靠的是整段音效的振幅包絡。
- 鏡頭是規則切的，不是人工分鏡表。停頓太短會被併進上一鏡，避免閃切。
- 特寫時其他角色會先讓出畫面（硬切看不出移動），這樣直式構圖才不會互相擋住。
- 軟體 WebGL 的陰影和抗鋸齒可能和有 GPU 的 Chrome 有細微差別。請固定 Chrome 版本再比較像素。
- v1 的場景是草地與小球。之後的物理喜劇短劇可以沿用同一套腳本、鏡頭與渲染管線，換成會說話的角色與新布景。
