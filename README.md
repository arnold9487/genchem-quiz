# 普化期末考 練習題

純前端的考古題練習網頁，**不需要伺服器、不需要後端**，可直接部署到 GitHub Pages 給大家用。

## ✨ 功能

- **兩種模式**
  - **練習**：點選即看對錯與完整解析（所有選項的理由），答對會把該題移出錯題池
  - **測驗**：全部寫完才交卷看結果，計入作答紀錄
- **出題方式**：依序（按章節題號）／隨機／優先錯題／優先沒考過／作答次數較少
- **題數**：全部，或自訂 N 題
- **章節**：可任意勾選一或多章
- **雙語顯示**：預設顯示英文原文，題目與每個選項左側有 ▶ 箭頭可展開中文翻譯（專有名詞會附上原文，例如「金屬性 (metallic character)」）
- **化學式 / 數學式**：以 KaTeX + mhchem 即時渲染（例如 $\ce{H2SO4}$、$^{14}_{6}\text{C}$、反應式、聚合物）
- **圖片**：支援題目圖片與選項圖片
- **元素週期表**：右側邊緣有小三角形，點一下即可滑出整張週期表，任何頁面都能叫出來看
- **深色 / 淺色模式**：右上角太陽/月亮切換，會記住你的選擇
- **錯題池**：答錯 +1、答對 −1，歸零才脫離（要答錯幾次就得答對幾次才能清掉）
- **手機自適應**：手機、平板、電腦都好用

## 💾 紀錄怎麼存的？

作答紀錄**自動儲存在你「這個瀏覽器」的 localStorage**，關閉網頁、重開機都還在。

會遺失的情況：清除瀏覽器資料、無痕模式、換瀏覽器或換裝置。
要跨裝置或備份，請用設定頁的「**下載紀錄 / 上傳紀錄**」（匯出/匯入一個 JSON 檔）。

容量上限約 5–10 MB，而每題紀錄僅約 100 bytes，幾千題都不會卡。

## 🖥️ 本機預覽

因為用 `fetch()` 讀 JSON，**不能直接雙擊開 `index.html`**（瀏覽器的 CORS 限制會擋住，題目會讀不到）。請先開一個本機伺服器：

```bash
py -m http.server 8000      # 或 python -m http.server 8000
```

然後在瀏覽器開 **http://localhost:8000** （注意網址開頭要是 `http://`，不是 `file://`）。

> 部署到 GitHub Pages 後就沒這問題了，使用者直接點網址即可。

## 🚀 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "普化期末考練習題"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo名稱>.git
git push -u origin main
```

接著到 GitHub repo →  **Settings → Pages** → Source 選 `main` 分支、資料夾 `/ (root)` → Save。
等一兩分鐘，用 `https://<你的帳號>.github.io/<repo名稱>/` 開啟即可分享給大家。

（已附 `.nojekyll`，GitHub Pages 不會用 Jekyll 處理，圖片與 JSON 都能正常讀取。）

## 📁 檔案結構

```
index.html              主頁
css/style.css           樣式（含深色模式變數）
js/app.js               全部邏輯（最上方 CHAPTER_FILES 可增減章節）
CH15.json … CH21.json   各章題庫
img/                    題目 / 選項圖片
Periodic_table_zh-tw.svg 元素週期表
.nojekyll               讓 GitHub Pages 不跑 Jekyll
```

## ➕ 新增章節

1. 把新的 `CHxx.json` 放到根目錄（欄位格式同現有檔）。
2. 圖片放 `img/`，JSON 內路徑寫成 `img/檔名.png`。
3. 編輯 `js/app.js` 最上方的 `CHAPTER_FILES`，加一行：
   ```js
   { file: "CH22.json", name: "Ch22 章節名稱" },
   ```

## 📝 資料格式注意事項

- 每題物件欄位：`單元`、`題號`、`類型`、`答案`（a–f 小寫）、`原題目`、`中文題目(全翻)`、`選項a原文/翻譯/理由`（a–f）。
- **公式請包在 `$...$` 裡**，化學式用 mhchem，例如 `$\\ce{H2SO4}$`、`$\\ce{2H2 + O2 -> 2H2O}$`；數學用一般 LaTeX，例如 `$\\Delta H$`、`$10^{-3}$`。
- **JSON 字串內的 LaTeX 反斜線一定要寫成雙反斜線**：`\\ce`、`\\Delta`、`\\frac`、`\\times`。（只寫一個 `\` 會被 JSON 默默吃掉或解析錯誤。）
- 圖片欄位：`"題目圖片": "img/x.png"`（多張用陣列 `["img/a.png","img/b.png"]`）、`"選項a圖片": "img/y.png"`。
