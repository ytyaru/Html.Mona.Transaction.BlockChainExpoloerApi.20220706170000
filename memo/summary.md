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

　DBは自分のアドレス単位で作成する。テーブル結合やデータを最小限にするため。

* DB（name=自分のアドレス）
    * last
    * sendPartners
    * receivePartners
    * transactions

　もし複数アカウントあれば複数DB作成することで対応できる仕様。ただし今は複垢で動作確認していない。

テーブル|説明
--------|----
`last`|このアドレスの集計データや最後に取得した時点での情報（次回の取得ページネーションで使う）
`sendPartners`|このアドレスで支払った相手ごとの集計
`receivePartners`|このアドレスで受け取った相手ごとの集計
`transactions`|このアドレスの取引データ

1. 指定アドレスの全取引データを取得する
1. 取引が支払いか受け取りかを判断する
1. それぞれに応じて集計する
1. それぞれに応じてDBにセットする

　すでにDBにデータがあり前回の続きから実行すべき場合は条件分岐してうまいことやる。

### `last`

　このアドレスの集計データや最後に取得した時点での情報（次回の取得ページネーションで使う）

列名|型|説明
----|--|----
`id`|number|主キー。
`count`|number|取引回数
`lastBlockHeight`|number|最新承認済み取引のブロックの高さ`height` ([`/api/v2/address/`][]の引数にする)
`lastTxId`|string|最新承認済み取引の`txid` ([`/api/v2/address/`][]の戻り値から取得済・未取得の判断をし書き込む要素位置を判定する)
`sendValue`|number|総支払額
`receiveValue`|number|総受取額
`fee`|number|総手数料
`balance`|number|残高
`sendCount`|number|総支払回数
`receiveCount`|number|総受取回数
`sendAddressCount`|number|総支払アドレス数
`receiveAddressCount`|number|総受取アドレス数
`bothAddressCount`|number|両思アドレス数
`firsted`|number|最初の取引のblockTime
`lasted`|number|最後の取引のblockTime

　金額は`value`に`0.1**8`を掛けた値が`MONA`になる。`value`は浮動小数点を排除し誤差をなくすため整数化した値と思われる。JavaScriptにおける整数の最大値は[MAX_SAFE_INTEGER][]で参照でき`9007199254740991`。小数点8位をとると、整数部は9千万。

　[monacoin.org][]によるとモナコインの数は`105,120,000 total coins`で1億以上。もしほぼ全モナコインを所有したらオーバーフローを起こしてしまうだろう。でもそんなことは起こりえないはず。独占したら通貨として機能していない。正常なら9千万ものコインをひとつのアドレスが所有することはないと考え、`parseInt`で整数化することにした。

[`/api/v2/address/`]:https://github.com/trezor/blockbook/blob/master/docs/api.md#get-address
[MAX_SAFE_INTEGER]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
[monacoin.org]:https://monacoin.org/

### `sendPartners`

　このアドレスで支払った相手ごとの集計。

列名|型|説明
----|--|----
`address`|string|支払相手アドレス
`value`|number|総支払額
`count`|number|総支払回数
`firsted`|datetime|最初の支払日時
`lasted`|datetime|最後の支払日時

### `receivePartners`

　このアドレスで受け取った相手ごとの集計。

列名|型|説明
----|--|----
`address`|string|受取相手アドレス
`value`|number|総受取額
`count`|number|総受取回数
`firsted`|datetime|最初の受取日時
`lasted`|datetime|最後の受取日時

### `transactions`

　このアドレスの取引データ。

列名|型|説明
----|--|----
`txid`|string|vinのそれ。主キー。
`addresses`|string|取引した相手
`isPay`|bool|真なら支払い。偽なら受け取り。
`value`|number|金額（支払額／受取額）
`fee`|number|手数料
`confirmations`|number|この取引の承認数
`blockTime`|datetime|ブロック生成日時
`blockHeight`|number|ブロックの高さ（集計には不要だがAPIを使いブロックハッシュを取得できるため一応残す）






# 番外編

　もし複数アドレスを各テーブルにぶちこむとしたら、外部キーが必要になって複雑になる。データ量も一気に増える。

## last

　自分のアドレス。集計済み値や最新IDの保存を入れておく。`address`列を追加する。

列名|型|説明
----|--|----
`id`|number|主キー。
`address`|string|自分のアドレス。
`count`|number|取引回数
`lastBlockHeight`|number|最後のブロックの高さ`height` ([`/api/v2/address/`][]の引数にする)
`lastTxId`|string|最後の取引`txid` ([`/api/v2/address/`][]の戻り値から取得済・未取得の判断をし書き込む要素位置を判定する)
`sendValue`|number|総支払額
`receiveValue`|number|総受取額
`fee`|number|総手数料
`balance`|number|残高
`sendCount`|number|総支払回数
`receiveCount`|number|総受取回数
`sendAddressCount`|number|総支払アドレス数
`receiveAddressCount`|number|総受取アドレス数

## send_partners

列名|型|説明
----|--|----
`aid`|number|自分のアドレスの主キー。この取引データの持ち主アドレス。外部キー
`address`|string|支払相手アドレス
`value`|number|総支払額
`count`|number|総支払回数
`firsted`|datetime|最初の支払日時
`lasted`|datetime|最後の支払日時

　`aid`と`address`の複合キー。`aid`は`last`テーブルの`id`。そうすることで長ったらしいアドレスを使わずに済む。

### receive_partners

列名|型|説明
----|--|----
`aid`|number|自分のアドレスの主キー。この取引データの持ち主アドレス。外部キー
`address`|string|受取相手アドレス
`value`|number|総受取額
`count`|number|総受取回数
`firsted`|datetime|最初の受取日時
`lasted`|datetime|最後の受取日時

　`aid`と`address`の複合キー。`aid`は`last`テーブルの`id`。そうすることで長ったらしいアドレスを使わずに済む。

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

　`aid`と`address`の複合キー。`aid`は`last`テーブルの`id`。そうすることで長ったらしいアドレスを使わずに済む。

# 実際の結果をみた所感

　だいたい合ってる。

　ただ、[もなフォーセット][]で受け取った分の取引データがおかしい。支払いアドレスが毎回違う。そのため受取人数が異常に増えてしまった。

[もなフォーセット]:https://faucet.mona.fun/ref.php?r=5dd285977dc75d45&lang=ja

　あと、ユーザ相関図のユーザ座標もおかしい。隣同士重ならない範囲で最大件数を表示するつもりだったのに、2周目が思い切り重なっている。これはバグだった。以下のように修正した。

before
```javascript
const itemNum = (i == this.outerLen-1) ? this.partners.length - ((i==0) ? 0 : this.outerNums[i-1]) : this.outerNums[i]
```
after
```javascript
const itemNum = (i == this.outerLen-1) ? this.partners.length - ((i==0) ? 0 : this.outerNums[i-1]) : this.userIconNum[i+1]
```

## 既存バグ

### 未承認取引データの次回更新

　`last`テーブルの`lastTxId`や`lastBlockHeight`は、次回最新取引データを取得するときの始点となる。前回の続きとして機能する。状況次第ではここでバグが起きる。

　前回の続きは最後の要素でなく最後の承認済み取引にした。理由は承認後に日時などが更新される手はずだから。次回`put`で更新されるかもしれないようにした。

　おそらく未承認のまま更新されない事態も起こりうる。たとえば手数料がゼロのためマイニングされないデータが生じうる。そのデータのあとで承認データがあれば、`lastBlockHeight`が更新されてしまい、もう未承認データのデータは取得されず、更新されない。よって、別途未承認データだけを個別に取得し、更新されていないか確認する必要がある。

　現在は更新を実装していないため、更新されないバグがある。とりあえず仮実装した。未テスト。

　もし手数料ゼロなどによりマイナーの動機がなく、半永久的に承認されなければ、毎回更新チェックが走ることになる。もし未承認データ件数が多ければ、その負荷はさらにあがる。どうしようもない。

### 受取総額が高すぎる

　`20 MONA`もいかないはずなのに`29.24399590 MONA`になる。なぜこれほどの誤差が出るのか原因不明。仮に手数料も受け取ったことにしても10MONAになるとは思えない。

### 支払総額が高すぎる

　`11MONA`も支払っていないはず。せいぜい`1MONA`程度のはずなのに。

　どうやら受取総額から残高を差し引いた値として支払総額を算出しているようだ。だが、そもそも受取総額が異常に高いので、そのせいで支払総額も異常に高くなってしまったと思われる。

