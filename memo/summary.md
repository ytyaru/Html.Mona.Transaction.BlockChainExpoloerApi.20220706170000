# 取引データを取得してローカルに保存する

## 前回の問題

* [トランザクション情報から支払か受取かを判別する方法がわからない][]

[トランザクション情報から支払か受取かを判別する方法がわからない]:https://monaledge.com/article/434

## 今回

* [総支払額を算出する方法の考察1][]
* [総支払額を算出する方法の考察2][]

[総支払額を算出する方法の考察1]:https://monaledge.com/article/439
[総支払額を算出する方法の考察2]:https://monaledge.com/article/440

## 取引データを取得する

1. counterBlock APIで指定アドレスの全トランザクションを取得する
1. 1のvinにあるtxidをみつける
1. ブロックチェーン・エクスプローラのAPIを使って、指定vinのtxidからアドレスを取得する
1. 3が自分のアドレスなら支払い、違うなら受け取りと判断する

　取引データが支払か受取かを判断するところが今回のポイント。

## 取引データをローカルに保存する

　txidからアドレスを取得する。このとき取引数だけAPIリクエストが発生してしまう。サーバ負荷が高くなりすぎるし、応答時間もかかる。ローカルに保存したほうがよいと判断した。

### addresses

　自分のアドレス。集計済み値や最新IDの保存を入れておく。

列名|型|説明
----|--|----
`id`|number|主キー。
`address`|string|自分のアドレス。
`count`|number|取引回数
`last_block_height`|number|最後のブロックの高さ`height` ([`/api/v2/address/`][]の引数にする)
`last_txid`|string|最後の取引`txid` ([`/api/v2/address/`][]の戻り値から取得済・未取得の判断をし書き込む要素位置を判定する)
`send_value`|bool|真なら支払い。偽なら受け取り。
`receive_value`|string|取引した相手
`fee`|number|金額（支払額／受取額）
`balance`|number|手数料
`send_count`|number|総支払回数
`receive_count`|number|総受取回数
`send_address_count`|number|支払したアドレス数
`receive_address_count`|number|受取したアドレス数

　金額は`value`に`0.1**8`を掛けた値が`MONA`になる。`value`は浮動小数点を排除し誤差をなくすため整数化した値と思われる。

[`/api/v2/address/`]:https://github.com/trezor/blockbook/blob/master/docs/api.md#get-address

### send_partners

列名|型|説明
----|--|----
`aid`|number|自分のアドレスの主キー。この取引データの持ち主アドレス。外部キー
`address`|string|支払相手アドレス
`value`|number|総支払額
`count`|number|総支払回数
`firsted`|datetime|最初の支払日時
`lasted`|datetime|最後の支払日時

### receive_partners

列名|型|説明
----|--|----
`aid`|number|自分のアドレスの主キー。この取引データの持ち主アドレス。外部キー
`address`|string|受取相手アドレス
`value`|number|総受取額
`count`|number|総受取回数
`firsted`|datetime|最初の受取日時
`lasted`|datetime|最後の受取日時

### transactions

列名|型|説明
----|--|----
`aid`|number|自分のアドレスの主キー。この取引データの持ち主アドレス。外部キー
`txid`|string|vinのそれ。主キー。
`is_pay`|bool|真なら支払い。偽なら受け取り。
`addresses`|string|取引した相手
`value`|number|金額（支払額／受取額）
`fee`|number|手数料
`blockTime`|datetime|ブロック生成日時
`height`|number|ブロックの高さ（集計には不要だがAPIを使いブロックハッシュを取得できるため一応残す）

　`confirmations`=`1`（承認済み）の取引のみ取得する。

