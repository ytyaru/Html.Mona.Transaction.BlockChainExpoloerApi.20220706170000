class MonaTransactionViewerFromDb {
    constructor(my, dbs) { // my: 自分のアドレス
        this.my = my
        this.dbs = dbs
        this.register = new ProfileRegister()
        this.gen = new ProfileGenerator()
    }
    async generate() {
        this.txs = await this.dbs.get(this.my).dexie.transactions.toArray()
        //this.last = await this.dbs.get(this.my).dexie.last.toArray()
        this.last = await this.dbs.get(this.my).dexie.last.get(1)
        console.debug(this.txs)
        console.debug(this.last)
        const pays = await this.makePayPeoples()
        const receives = await this.makeReceivedPeoples()
        console.debug(pays)
        console.debug(receives)
        this.profiles = await this.register.get()
        for (let i=0; i<this.profiles.length; i++) {
            this.profiles[i].profile = JSON.parse(this.profiles[i].profile)
        }
        console.debug(this.profiles)
        //const svgGen = new CircleSvgGenerator(this.my, this.profiles)
        const svgGen = new CircleSvgGeneratorFromDb(this.my, this.profiles)
        return this.makeTerm()
             + '<br>'
             //+ this.makePayBalanceAmount(json)
             + this.makeBalancePeopleTable()
             + this.#makeCalcTable(pays, receives)
             + await this.#makeMpChainTable()
             + '<br>'
             + svgGen.generate(pays)
             + svgGen.generate(receives)
             //+ this.makePeoplesTable(pays, '支払')
             + this.makePeoplesTable(pays, true)
             + '<br>'
             + this.makePeoplesTable(receives, false)
             //+ this.makePeoplesTable(receives, '受取')
             //+ this.makePeoplesTable(this.makePayPeoples(json), '支払')
             //+ '<br>'
             //+ this.makePeoplesTable(this.makeReceivedPeoples(json), '受取')
    }
    makeTerm() { // 日時（最後の取引〜最初の取引）
        //const firsted = new Date(json.result[0].time * 1000)
        //const lasted = new Date(json.result[json.result.length-1].time * 1000)
        const lasted = new Date(this.last.lasted * 1000);
        const firsted = new Date(this.last.firsted * 1000);
        const count = this.last.count
        //const payCnt = this.last.sendCount
        //const recCnt = this.last.receiveCount
        const payCnt = this.txs.filter(tx=>tx.isPay).length
        const recCnt = this.txs.filter(tx=>!tx.isPay).length
        return this.#makeTime(lasted) + '〜' + this.#makeTime(firsted)
                + `　<span><span id="transaction-count">${count}</span>回</span>`
                + `（<span><span id="pay-count">${payCnt}</span>出</span>`
                + `　<span><span id="received-count">${recCnt}</span>入</span>）`
//                + `　<span><span id="transaction-count">${json.result.length}</span>回</span>`
//                + `（<span><span id="pay-count">${this.calcTotalPayCount(json)}</span>出</span>`
//                + `　<span><span id="received-count">${this.calcTotalReceivedCount(json)}</span>入</span>）`
    }

    #makeTime(date) { // date型
        //console.debug(date)
        const iso = date.toISOString()
        const month = (date.getMonth()+1).toString().padStart(2, '0')
        const dates = date.getDate().toString().padStart(2, '0')
        //const hours = date.getHours().toString().padStart(2, '0')
        //const minutes = date.getMinutes().toString().padStart(2, '0')
        //const seconds = date.getSeconds().toString().padStart(2, '0')
        const format = `${date.getFullYear()}-${month}-${dates}`
        //const format = `${date.getFullYear()}-${month}-${date} ${hours}:${minutes}:${seconds}`
        return `<time datetime="${iso}" title="${iso}">${format}</time>`
    }
    //makeBalancePeopleTable(json) { return `<table><tr><td>${this.makePayBalanceAmount(json)}</td><td>${this.makePeopleTotalTable(json)}</td></tr></table>` }
    makeBalancePeopleTable() { return `<table><caption><a href="https://github.com/trezor/blockbook/blob/master/docs/api.md#get-address">API</a>取得値</caption><tr><td>${this.makePayBalanceAmount()}</td><td>${this.makePeopleTotalTable()}</td></tr></table>` }
    makePayBalanceAmount() {
        /*
        const pay = this.calcTotalPay(json)
        console.debug(pay)
        const received = this.calcTotalReceived(json)
        console.debug(received)
        const balance = this.calcBalance(received, pay) // received - pay
        console.debug(balance)
        return `<table><tr><th>支払総額</th><td class="num"><span id="total-pay">${pay.toFixed(8)}</span> MONA</td></tr><tr><th>受取総額</th><td class="num"><span id="balance">${received.toFixed(8)}</span> MONA</td></tr><tr><th>残高</th><td class="num"><span id="balance">${balance.toFixed(8)}</span> MONA</td></tr></table>`
        */
        const pay = this.#toMona(this.last.sendValue)
        const receive = this.#toMona(this.last.receiveValue)
        const balance = this.#toMona(this.last.balance)
        return `<table>
<tr><th>支払総額</th><td class="num"><span id="total-pay">${pay}</span> MONA</td></tr>
<tr><th>受取総額</th><td class="num"><span id="total-receive">${receive}</span> MONA</td></tr>
<tr><th>残高</th><td class="num"><span id="balance">${balance}</span> MONA</td></tr></table>`
    }
    // 整数値valueからMONA単位に変換する
    #toMona(value) { return (value * (0.1**8)).toFixed(8) }
    makePeopleTotalTable() { // 支払人数,受取人数
        /*
        const pays = this.makePayPeoples(json)
        const receives = this.makeReceivedPeoples(json)
        // 積集合
        // https://zenn.dev/nananaoto/articles/3c49bcf18017b472b9ff
        const both = pays.map(p=>p.address).filter((p) => receives.map(r=>r.address).includes(p))
        return `<table>
<tr><th>支払人数</th><td class="num"><span id="total-pay-peoples">${pays.length}</span>人</td></tr>
<tr><th>受取人数</th><td class="num"><span id="total-receive-peoples">${receives.length}</span>人</td></tr>
<tr><th>両思人数</th><td class="num"><span id="total-pay-receive-peoples">${both.length}</span>人</td></tr>
</table>`
        */
        return `<table>
<tr><th>支払人数</th><td class="num"><span id="total-pay-peoples">${this.last.sendAddressCount}</span>人</td></tr>
<tr><th>受取人数</th><td class="num"><span id="total-receive-peoples">${this.last.receiveAddressCount}</span>人</td></tr>
<tr><th>両思人数</th><td class="num"><span id="total-pay-receive-peoples">${this.last.bothAddressCount}</span>人</td></tr>
</table>`
    }
    //makePeoplesTable(results, caption) {
    makePeoplesTable(results, isPay) {
        console.debug(results)
        const trs = []
        for (const r of results) {
            const profile = this.getProfile(r.address)
            console.debug(profile)
            if (profile) {
                if (profile.hasOwnProperty('error')) { profile = null }
                else { profile.profile['address'] = profile.address }
            }
            //if (profile && profile.hasOwnProperty('error')) { profile = null }
            //else if (profile) {profile.profile['address'] = profile.address}
            //const tdAddrContent = (profile) ? this.gen.generate(profile) : r.address
            //const tdAddr = `<td class="user-total-pay-address">${r.address}</td>`
            //const tdAddr = `<td class="user-total-pay-address">${this.gen.generate(profile)}</td>`

            /*
            const tdAddr = `<td class="user-total-pay-address">${(profile) ? this.gen.generate(profile.profile) : r.address}</td>`
            const tdValues = `<td><span class="user-total-pay-amount">${r.sum.toFixed(8)}</span></td>`
            const tdHistory = `<td>${this.makePayWhenValueTable(r.history)}</td>`
            */
            const tdAddr = `<td class="user-total-pay-address">${(profile) ? this.gen.generate(profile.profile) : r.address}</td>`
            const tdValues = `<td><span class="user-total-pay-amount">${this.#toMona(r.value)}</span></td>`
            const tdHistory = `<td>${this.makePayWhenValueTable(r.address, isPay)}</td>`
            trs.push(`<tr>${tdAddr}${tdValues}${tdHistory}</tr>`)
        }
        return `<table><caption>${(isPay) ? '支払' : '受取'}</caption>` + trs.join('') + '</table>'
        //return `<table><caption>${caption}</caption>` + trs.join('') + '</table>'
    }
    makePayWhenValueTable(address, isPay) {
        const targets = this.txs.filter(tx=>tx.isPay===isPay && tx.addresses===address).sort((a,b)=>b.blockTime - a.blockTime)
        return '<table>' + targets.map(t=>`<tr><td class="num">${this.#toMona(t.value - ((isPay) ? t.fee : 0))} MONA</td><td>${this.#makeTime(new Date(t.blockTime * 1000))}</td></tr>`).join('') + '</table>'
    }
    /*
    makePayWhenValueTable(history) {
        return '<table>' + history.map(d=>`<tr><td class="num">${d.value.toFixed(8)} MONA</td><td>${this.#makeTime(d.time)}</td></tr>`).join('') + '</table>'
    }
    */
    async makePayPeoples() {
        const partners = await this.dbs.get(this.my).dexie.sendPartners.toArray()
        return partners.sort((a,b)=>b.value - a.value)
    }
    async makeReceivedPeoples() {
        const partners = await this.dbs.get(this.my).dexie.receivePartners.toArray()
        return partners.sort((a,b)=>b.value - a.value)
    }
    getProfile(address) {
        const i = this.profiles.findIndex(p=>p.address===address)
        if (-1 == i) { return null }
        console.debug(this.profiles[i])
        if(typeof this.profiles[i].profile === 'string' || this.profiles[i].profile instanceof String) {
            this.profiles[i].profile = JSON.parse(this.profiles[i].profile)
        }
        return this.profiles[i]
    }
    #makeCalcTable(pays, receives) {
        //const _pay = pays.map(p=>p.value).reduce((sum,v)=>sum+v)
        //const _fee = this.txs.filter(tx=>tx.isPay).map(tx=>tx.fee).reduce((sum,v)=>sum+v)
        //const _rec = receives.map(r=>r.value).reduce((sum,v)=>sum+v)
        const _pay = (0===pays.length) ? 0 : pays.map(p=>p.value).reduce((sum,v)=>sum+v)
        const _fee = (0===pays.length) ? 0 : this.txs.filter(tx=>tx.isPay).map(tx=>tx.fee).reduce((sum,v)=>sum+v)
        const _rec = (0===receives.length) ? 0 : receives.map(r=>r.value).reduce((sum,v)=>sum+v)
        const pay = this.#toMona(_pay + _fee)     // 支払総額＋手数料
        const fee = this.#toMona(_fee)            // 手数料
        const receive = this.#toMona(_rec)        // 受取総額
        const balance = this.#toMona(_rec - _pay - _fee) // 残高
        return `<table><caption><a href="https://github.com/trezor/blockbook/blob/master/docs/api.md#get-transaction">tx</a>から自力計算した結果</caption>
<tr><th>支払総額</th><td class="num"><span id="total-pay">${pay}</span> MONA</td></tr><tr><th>内手数料</th><td class="num">${fee} MONA</td></tr>
<tr><th>手数料比</th><td class="num">${((_fee/_pay)*100).toFixed(2)}%</td></tr>
<tr><th>受取総額</th><td class="num"><span id="total-receive">${receive}</span> MONA</td></tr>
<tr><th>残高</th><td class="num"><span id="balance">${balance}</span> MONA</td></tr></table>`
    }
    async #makeMpChainTable() { // https://nemlog.nem.social/blog/56861
        const adrrs = await window.mpurse.mpchain('address', {address: this.my});
        const balances = await window.mpurse.mpchain('balances', {address: this.my});
        const summary = `<table><caption><a href="https://github.com/tadajam/mpurse#mpchain">mpurse</a>経由<a href=>mpchain</a>取得値</caption>
<tr><th>残高 MONA</th><td class="num"><span id="mpchain-balance-mona">${adrrs.mona_balance}</span> MONA</td></tr>
<tr><th>残高 XMP</th><td class="num"><span id="mpchain-balance-xmp">${adrrs.xmp_balance}</span> XMP</td></tr>
<tr><th>残高 独自トークン</th><td class="num"><span id="mpchain-balance-nft">${balances.data.length}</span></td></tr></table>`
        const trs = []
        trs.push(`<tr><th>名前</th><th>枚数</th><th>見積額(MONA)</th><th>説明</th></tr>`)
        for (const balance of balances.data) {
            trs.push(`<tr><td>${balance.asset}</td><td>${balance.quantity}</td><td>${balance.estimated_value.mona}</td><td>${balance.description}</td></tr>`)
            //trs.push(`<tr><td>${balance.asset}</td><td>${balance.quantity}</td><td>${balance.estimated_value.mona}</td><td>${balance.}</td><td>${balance.description}</td><td>${balance.description}</td></tr>`)
        }
        const details = `<details><summary>独自トークン一覧</summary><table><caption>独自トークン</caption>${trs.join('')}</table></details>`
        return summary + details
    }
    /*
    #calcReceive(receives) { // 受取総額を算出する
        //const partners = await this.dbs.get(this.my).dexie.receivePartners.toArray()
        //return this.#toMona(this.partners.map(p=>p.value).reduce((sum,v)=>sum+v))
        return this.#toMona(receives.map(r=>r.value).reduce((sum,v)=>sum+v))
    }
    #calcPay(pays) { // 支払総額を算出する
        //const partners = await this.dbs.get(this.my).dexie.sendPartners.toArray()
        //return this.#toMona(this.partners.map(p=>p.value).reduce((sum,v)=>sum+v))
        return this.#toMona(pays.map(p=>p.value).reduce((sum,v)=>sum+v))
    }
    #calcFee(pays) { // 総手数料を算出する
        return this.#toMona(this.txs.filter(tx=>tx.isPay).map(tx=>tx.fee).reduce((sum,v)=>sum+v))
    }
    */
    /*
    makePayPeoples(json) { return this.makePeoples(json.result.filter(r=>this.isPay(r.vout))) }
    makeReceivedPeoples(json) { return this.makePeoples(json.result.filter(r=>!this.isPay(r.vout))) }
    makePeoples(results, isPay) {
        const datas = []
        for (const r of results) {
            // voutの配列が3つある取引データが存在した。このとき[1]にアドレスがなかった。最初[0]と最後[2]の要素にはアドレスがあった
            //const addr = r.vout[(this.my == r.vout[0].scriptPubKey.addresses[0]) ? 1 : 0].scriptPubKey.addresses[0]
            const addr = r.vout[(this.my == r.vout[0].scriptPubKey.addresses[0]) ? r.vout.length-1 : 0].scriptPubKey.addresses[0]
            const i = datas.findIndex(a=>a.address==addr)
            const history = (-1 < i) ? datas[i].history : []
            const sum = (-1 < i) ? datas[i].sum : 0
            if (-1 < i) {
                datas[i].sum += r.vout[0].value
                datas[i].history.push({time:new Date(r.time * 1000), value:r.vout[0].value})
            }
            else {datas.push({address:addr, sum:r.vout[0].value, history:[{time:new Date(r.time * 1000), value:r.vout[0].value}]})}
        }
        return datas.sort((a,b)=>b.sum - a.sum)
    }
    calcTotalPayCount(json) { // 支払総回数を算出する
        return json.result.filter(r=>this.isPay(r.vout)).length
    }
    calcTotalReceivedCount(json) { // 受取総回数を算出する
        return json.result.filter(r=>!this.isPay(r.vout)).length
    }
    calcTotalPay(json) { // 支払総額を算出する
        return json.result.filter(r=>this.isPay(r.vout)).map(r=>r.vout[0].value).reduce((sum,v)=>sum+v)
    }
    calcTotalReceived(json) { // 受取総額を算出する
        return json.result.filter(r=>!this.isPay(r.vout)).map(r=>r.vout[0].value).reduce((sum,v)=>sum+v)
    }
    calcBalance(received, pay) { // 残高を算出する
        return received - pay
    }
    isPay(vout) { // この取引情報は支払いであるか（真:支払、偽:受取）
        //console.debug(vout)
        //console.debug(vout[1].scriptPubKey)
        //return (vout[1].scriptPubKey.addresses[0] == this.my)
        return (vout[vout.length-1].scriptPubKey.addresses[0] == this.my) // voutの配列が3つある取引データが存在した。このとき[1]にアドレスがなかった。最初と最後の要素にはアドレスがあった。
    }
    */
}
