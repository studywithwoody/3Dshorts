# 3Dshorts

用程式做直式 3D 短片的引擎。沒有 AI 影片模型：每一幀都由 three.js 在無頭 Chrome 裡畫出來，時間軸完全由腳本決定，同一份腳本會得到同一組畫面。

這版附兩支示範：

- **Cube Pets**（10 秒）：四隻 [Kenney Cube Pets](https://kenney.nl/assets/cube-pets)（狗、貓、小雞、豬）在草地上玩球、輪流叫，鏡頭大約每 1 秒切一次。
- **凌晨的 AI 助教**（30 秒）：滑板少年在凌晨一點的書房對著數學作業，傳訊息、搜尋、把題目交給 AI 助教，最後自己解出來。角色與家具都是 Kenney 的低多邊形 CC0 素材，對白是免費的 Edge TTS 繁體中文語音。

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

助教片：

```bash
npm run render -- scripts/ai-tutor-ad.json
```

成品在 `out/ai-tutor-ad.mp4`，已提交的版本在 `examples/ai-tutor-ad.mp4`。`npm test` 會同時檢查兩支腳本（助教片讀的是已提交的語音快取，不會打網路）。

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
| `assets/models/` | Cube Pets GLB、主角 FBX、Furniture Kit GLB |
| `assets/fonts/` | 字幕用的 Nunito 與 Noto Sans TC |
| `assets/licenses/` | 素材授權全文 |
| `cache/tts/` | Edge TTS 的 mp3 與逐詞時間戳，重跑不必再連線 |
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

## 凌晨的 AI 助教

腳本是 `scripts/ai-tutor-ad.json`。`scene` 設成 `study` 之後，引擎會改走語音管線：每一句先合成語音，再用實際長度排鏡頭，而不是用腳本裡的 `beat` 當台詞長度。`beat` 是這一幕的目標秒數；語音比較短時，剩下的時間變成停頓，最後再把整片縮放到 `duration`（這裡是 30 秒）。

### 語音

預設供應者是 Microsoft Edge 的線上語音，不需要 API 金鑰。本機要有 `python3` 和 `edge-tts`（`pip install --user edge-tts`）。腳本裡的聲音：

| 角色 | 聲音 |
| --- | --- |
| 學生 | `zh-TW-YunJheNeural` |
| AI 助教 | `zh-TW-HsiaoChenNeural` |
| 旁白 | `zh-TW-HsiaoYuNeural` |

`tts.provider` 可以換成 `elevenlabs`。`src/tts/elevenlabs.mjs` 目前是同一個回傳格式的佔位：沒有 `ELEVENLABS_API_KEY` 會直接失敗，有金鑰也還沒接上 HTTP。接上之後只要回傳 `{ audio, sampleRate, words, sentences }`，嘴型與字幕會沿用同一套逐詞時間。

Edge 偶爾會對某一句回 `NoAudioReceived`。合成器會換幾個語速再試，成功的 mp3 與逐詞 JSON 寫進 `cache/tts/`，檔名是 `provider + voice + rate + text` 的雜湊。這些快取已提交，沒有網路也能重渲。

字幕用 Noto Sans TC（字重 700 的子集），畫在 WebGL 截圖之上，所以中文不會變成豆腐。

### 換掉結尾 logo

品牌只寫在腳本的 `brand`，舞台跟字幕都讀這裡：

```json
"brand": {
  "name": "AI 學習平台",
  "icon": "spark",
  "color": "#F6C453"
}
```

改 `name` 就是畫面上的字。`icon` 目前只認 `spark`（一顆四角星）。`color` 是圖示的填色。改完重新渲染即可，不用改程式。

### 畫面裡的字

手機、考卷、搜尋頁、AI 面板上的繁體中文都在 `src/screen-copy.mjs`。這些是 CanvasTexture，會進 WebGL 截圖；HTML 疊層不會被拍到。

## 授權

- **Cube Pets**：Kenney《Cube Pets》2.0，[CC0](https://creativecommons.org/publicdomain/zero/1.0/)。原文在 `assets/licenses/Kenney-Cube-Pets-CC0.txt`。
- **主角**：Kenney《Animated Characters: Protagonists》，CC0。用到的是 `characterMedium.fbx`、`skaterMaleA.png`，以及 `idle`、`jump`、`run`。原文在 `assets/licenses/Kenney-Animated-Characters-Protagonists-CC0.txt`。
- **書房**：Kenney《Furniture Kit》2.0，CC0。只收了實際用到的 GLB（地板、牆、窗、床、書櫃、書、植物、地毯、書桌、椅子、檯燈、筆電、枕頭、邊桌）。原文在 `assets/licenses/Kenney-Furniture-Kit-CC0.txt`。
- **字幕字型**：Nunito 與 Noto Sans TC，SIL Open Font License。全文在 `assets/licenses/Nunito-OFL.txt` 與 `assets/licenses/NotoSansTC-OFL.txt`。
- **聲音與配樂**：寵物片的擬聲、助教片的夜間配樂、訊息提示音與拍桌聲都是這個專案自己合成的，沒有第三方錄音。

感謝 [Kenney](https://kenney.nl)。

## 限制

- Cube Pets 的聲音是風格化合成，不是真實動物錄音。同步靠整段音效的振幅包絡。
- 助教片的嘴是頭骨上的一塊程序網格，跟著逐詞時間開合，不是骨架的 blendshape。這包角色沒有坐姿，學生是站在書桌前；`run` 片段只有約 0.04 秒，沒有拿來用。
- 手機與牆上時鐘不是 Furniture Kit 裡的模型：手機是一塊低多邊形方塊，時鐘是畫上去的平面。筆電外殼是家具包的模型，螢幕上的介面是另外貼的 CanvasTexture。
- 鏡頭是規則切的，不是人工分鏡表。每一鏡大約 0.8–3 秒。
- Cube Pets 特寫時，其他角色會先讓出畫面（硬切看不出移動），直式構圖才不會互相擋住。
- 軟體 WebGL（SwiftShader）的陰影和抗鋸齒可能和有 GPU 的 Chrome 有細微差別。請固定 Chrome 版本再比較像素。
- Edge TTS 服務不穩定，所以倉庫帶著語音快取。ElevenLabs 只留了相同介面，還沒有真正送出請求。
