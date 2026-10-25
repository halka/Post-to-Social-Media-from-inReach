# Post to SocialMeadia from inReach

[English](#english) | [日本語](#日本語)

---

## English

Post messages sent from a Garmin inReach satellite communicator to X (Twitter), together with the location they were sent from.

### How it works

```
inReach ──(satellite)──▶ Garmin ──(notification email)──▶ Cloudflare Email Routing
                                                              │
                                                              ▼
                                                   Cloudflare Email Worker ──▶ X
```

1. Set the inReach to send messages to an email address that Cloudflare Email Routing delivers to this Worker.
2. The Worker parses Garmin's notification email and extracts the message text and the GPS coordinates.
3. It builds a post and publishes it to X.

An example post:

```
VTECH SOUND, GREAT AGAIN 
https://maps.google.com/?q=35.683851,139.753973
xn77h0j9r
PM95vq
```

The lines are:

- the message you typed on the inReach
- a Google Maps link to the location
- the [geohash](https://en.wikipedia.org/wiki/Geohash) of the location
- the [Maidenhead locator](https://en.wikipedia.org/wiki/Maidenhead_Locator_System) of the location

The post is fitted to X's 280-character limit, counted the way X counts it with [twitter-text](https://github.com/twitter/twitter-text): Japanese and emoji count as 2, and every URL or bare domain counts as 23. If it is too long, the message is shortened and ends in "…". The location lines are kept.

When a message has no GPS fix (Garmin sends `Lat 0 Lon 0`), the Imperial Palace in Tokyo is used as the location. Emails that are not inReach notifications are posted as their first non-empty line.

### Setup

Requirements: a Cloudflare account with Email Routing enabled on your domain, [Wrangler](https://developers.cloudflare.com/workers/wrangler/), and an X developer app with read and write access.

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Create `wrangler.toml`. This repository does not include one. For example:

   ```toml
   name = "inreach2socialmedia"
   main = "worker/index.ts"
   compatibility_date = "2026-10-01"

   [vars]
   allowed = '{"address": ["no.reply.inreach@garmin.com"]}'
   GEOHASH_PRECISION = "9"
   MAIDENHEAD_PRECISION = "6"
   # INREACH_SUBJECT_TRIGGER = "さんからのinReachメッセージ"
   ```

3. Store the X API credentials as secrets:

   ```sh
   npx wrangler secret put X_API_KEY
   npx wrangler secret put X_API_SECRET
   npx wrangler secret put X_API_ACCESS_TOKEN
   npx wrangler secret put X_API_ACCESS_TOKEN_SECRET
   ```

4. Deploy, then add an Email Routing rule that sends your chosen address to this Worker:

   ```sh
   npx wrangler deploy
   ```

### Configuration

| Variable | Default | Description |
|---|---|---|
| `allowed` | (required) | JSON `{"address": [...]}` of the sender addresses that may post. Compared case-insensitively. Mail from any other sender is rejected. |
| `GEOHASH_PRECISION` | `9` (about 5 m) | Geohash length, 1–12. |
| `MAIDENHEAD_PRECISION` | `6` (5 × 2.5 arc minutes, about 7 × 5 km in Japan) | Maidenhead locator length: 2, 4, 6, 8 or 10. |
| `INREACH_SUBJECT_TRIGGER` | `さんからのinReachメッセージ` | Text in the subject that marks an inReach notification. The sender's name is the part of the subject before it. The default matches Garmin's Japanese notification; set this to match the subject of yours if it differs. |
| `X_API_KEY`, `X_API_SECRET`, `X_API_ACCESS_TOKEN`, `X_API_ACCESS_TOKEN_SECRET` | (required) | X API credentials. Store them with `wrangler secret put`. |

An invalid precision is logged and replaced by the default.

> **Note:** The sender check uses the email's `From:` header, which a sender can forge. Keep the receiving address private.

### Using the parser as a library

The parser in `src/` has no Cloudflare dependency. It works with any source of decoded email, such as postal-mime, the Gmail API or Google Apps Script.

```ts
import { parseInReachFields } from "inreach-mail-parser";

const result = parseInReachFields(
  { subject, text, from },
  { geohashPrecision: 9, maidenheadPrecision: 6 },
);
// {
//   sender: "HALKA", message: "…", latitude: 35.683851, longitude: 139.753973,
//   geohash: "xn77h0j9r", maidenhead: "PM95vq",
//   replyUrl: "https://inreachlink.com/…", subject: "…", from: "…"
// }
// It returns null when the subject is not an inReach notification.
```

The package also exports `parseInReachContent(subject, body)`, `parseInReachText(text)`, `isInReachSubject`, `extractMessageText`, `extractCoordinates`, `encodeGeohash`, `decodeGeohash` and `encodeMaidenhead`.

### Development

```sh
npm run build   # compile src/ to dist/
```

### License

[MIT](LICENSE)

---

## 日本語

Garmin inReach（衛星通信機）から送ったメッセージを、送信した場所の情報と一緒に X（Twitter）へ投稿します。

### 仕組み

```
inReach ──(衛星)──▶ Garmin ──(通知メール)──▶ Cloudflare Email Routing
                                                  │
                                                  ▼
                                       Cloudflare Email Worker ──▶ X
```

1. inReach のメッセージ送信先に、Cloudflare Email Routing でこの Worker に届くメールアドレスを設定します。
2. Worker が Garmin の通知メールを解析し、メッセージ本文と GPS の座標を取り出します。
3. 投稿文を組み立てて X に投稿します。

投稿の例：

```
御所
ｳﾞｫｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰｰﾝ
https://maps.google.com/?q=35.683851,139.753973
xn77h0j9r
PM95vq
```

各行の内容は次のとおりです。

- inReach で入力したメッセージ
- その場所の Google マップのリンク
- その場所の [geohash](https://ja.wikipedia.org/wiki/ジオハッシュ)
- その場所の [Maidenhead ロケーター](https://en.wikipedia.org/wiki/Maidenhead_Locator_System)（グリッドロケーター）

投稿文は X の 280 字制限に収まるように調整します。文字数は [twitter-text](https://github.com/twitter/twitter-text) を使って X と同じ方法で数えます（日本語と絵文字は 2、URL やドメイン名は長さに関係なく 23）。長すぎる場合はメッセージを短くして末尾を「…」にします。位置情報の行は残します。

GPS の位置が取れなかったメッセージ（Garmin が `Lat 0 Lon 0` を送ってきた場合）は、皇居の座標を使います。inReach の通知ではないメールは、本文の最初の空でない行を投稿します。

### セットアップ

必要なもの：独自ドメインで Email Routing を有効にした Cloudflare アカウント、[Wrangler](https://developers.cloudflare.com/workers/wrangler/)、読み書き権限のある X の開発者アプリ。

1. 依存パッケージをインストールします。

   ```sh
   npm install
   ```

2. `wrangler.toml` を作ります（このリポジトリには含まれていません）。例：

   ```toml
   name = "inreach2socialmedia"
   main = "worker/index.ts"
   compatibility_date = "2026-10-01"

   [vars]
   allowed = '{"address": ["no.reply.inreach@garmin.com"]}'
   GEOHASH_PRECISION = "9"
   MAIDENHEAD_PRECISION = "6"
   # INREACH_SUBJECT_TRIGGER = "さんからのinReachメッセージ"
   ```

3. X API の認証情報をシークレットとして登録します。

   ```sh
   npx wrangler secret put X_API_KEY
   npx wrangler secret put X_API_SECRET
   npx wrangler secret put X_API_ACCESS_TOKEN
   npx wrangler secret put X_API_ACCESS_TOKEN_SECRET
   ```

4. デプロイし、Email Routing で受信用アドレスをこの Worker に送るルールを追加します。

   ```sh
   npx wrangler deploy
   ```

### 設定

| 変数 | 初期値 | 説明 |
|---|---|---|
| `allowed` | （必須） | 投稿を許可する送信元アドレスの JSON（`{"address": [...]}`）。大文字・小文字は区別しません。これ以外の送信元からのメールは拒否します。 |
| `GEOHASH_PRECISION` | `9`（約 5 m） | geohash の桁数。1〜12。 |
| `MAIDENHEAD_PRECISION` | `6`（経度 5 分 × 緯度 2.5 分、日本で約 7 × 5 km） | Maidenhead ロケーターの文字数。2・4・6・8・10 のいずれか。 |
| `INREACH_SUBJECT_TRIGGER` | `さんからのinReachメッセージ` | inReach の通知メールだと判定するための、件名に含まれる文字列。件名のこの文字列より前の部分を送信者名として使います。初期値は Garmin の日本語の通知メールに合わせてあります。件名が違う場合は、実際の件名に合わせて設定してください。 |
| `X_API_KEY`、`X_API_SECRET`、`X_API_ACCESS_TOKEN`、`X_API_ACCESS_TOKEN_SECRET` | （必須） | X API の認証情報。`wrangler secret put` で登録してください。 |

桁数の設定が不正な場合は、ログに警告を出して初期値を使います。

> **注意：** 送信元のチェックにはメールの `From:` ヘッダーを使っています。このヘッダーは送信者が偽装できるので、受信用アドレスは公開しないでください。

### 解析部分をライブラリとして使う

`src/` の解析処理は Cloudflare に依存していません。postal-mime、Gmail API、Google Apps Script など、デコード済みのメールを渡せる環境ならどこでも使えます。

```ts
import { parseInReachFields } from "inreach-mail-parser";

const result = parseInReachFields(
  { subject, text, from },
  { geohashPrecision: 9, maidenheadPrecision: 6 },
);
// {
//   sender: "HALKA", message: "…", latitude: 35.683851, longitude: 139.753973,
//   geohash: "xn77h0j9r", maidenhead: "PM95vq",
//   replyUrl: "https://inreachlink.com/…", subject: "…", from: "…"
// }
// 件名が inReach の通知でない場合は null を返します。
```

ほかに `parseInReachContent(subject, body)`、`parseInReachText(text)`、`isInReachSubject`、`extractMessageText`、`extractCoordinates`、`encodeGeohash`、`decodeGeohash`、`encodeMaidenhead` を公開しています。

### 開発

```sh
npm run build   # src/ を dist/ にコンパイル
```

### ライセンス

[MIT](LICENSE)
